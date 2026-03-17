'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  detectDocumentCorners,
  perspectiveTransform,
  applyFilter,
  makeThumbnail,
  defaultCorners,
  type Corners,
  type Point,
  type FilterType,
} from '@/lib/imageProcessing';

const MAX_PAGES = 50;
const DETECT_INTERVAL_MS = 150;

interface DocumentScannerProps {
  pageCount: number;
  onCapture: (dataUrl: string, thumbnail: string) => void;
  onDone: () => void;
}

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'Original', value: 'original' },
  { label: 'Greyscale', value: 'grayscale' },
  { label: 'B&W', value: 'bw' },
  { label: 'Enhance', value: 'enhance' },
];

// ── Overlay Drawing ────────────────────────────────────────────────────────────
function drawOverlay(
  canvas: HTMLCanvasElement,
  corners: Corners | null,
  videoW: number,
  videoH: number
) {
  const scaleX = canvas.width / videoW;
  const scaleY = canvas.height / videoH;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pts: Corners = corners
    ? (corners.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })) as Corners)
    : defaultCorners(canvas.width, canvas.height, 0.08);

  // Dim outside the quad
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of [pts[1], pts[2], pts[3], pts[0]]) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill('evenodd');

  // Quad outline
  const accentColor = corners ? '#00e5c8' : 'rgba(255,255,255,0.4)';
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.stroke();

  // Corner handles
  const R = 10;
  pts.forEach((p) => {
    // L-shaped corner brackets
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    // draw a small L at each corner (direction depends on position)
    const dx = p.x < canvas.width / 2 ? 1 : -1;
    const dy = p.y < canvas.height / 2 ? 1 : -1;
    ctx.moveTo(p.x + dx * R, p.y);
    ctx.lineTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + dy * R);
    ctx.stroke();

    // Dot
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DocumentScanner({
  pageCount,
  onCapture,
  onDone,
}: DocumentScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cornersRef = useRef<Corners | null>(null);
  const [filter, setFilter] = useState<FilterType>('enhance');
  const [flash, setFlash] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [hasDetection, setHasDetection] = useState(false);
  const [videoDims, setVideoDims] = useState({ w: 1280, h: 720 });
  const [manualCorners, setManualCorners] = useState<Corners | null>(null);
  const draggingRef = useRef<{ idx: number; startX: number; startY: number } | null>(null);

  // ── Start Camera ────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          const { videoWidth: w, videoHeight: h } = videoRef.current;
          setVideoDims({ w, h });
        }
      } catch (err) {
        console.error('Camera error:', err);
      }
    })();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Edge Detection Loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay || video.readyState < 2) return;

      const tmp = document.createElement('canvas');
      tmp.width = video.videoWidth;
      tmp.height = video.videoHeight;
      tmp.getContext('2d')!.drawImage(video, 0, 0);

      const imgData = tmp.getContext('2d')!.getImageData(0, 0, tmp.width, tmp.height);
      const detected = detectDocumentCorners(imgData);

      // Smooth corners
      if (detected && !manualCorners) {
        const prev = cornersRef.current;
        cornersRef.current = prev
          ? (detected.map((c, i) => ({
              x: prev[i].x * 0.6 + c.x * 0.4,
              y: prev[i].y * 0.6 + c.y * 0.4,
            })) as Corners)
          : detected;
        setHasDetection(true);
      } else if (!detected && !manualCorners) {
        setHasDetection(false);
      }

      drawOverlay(
        overlay,
        manualCorners ?? cornersRef.current,
        video.videoWidth,
        video.videoHeight
      );
    }, DETECT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [manualCorners]);

  // ── Capture ─────────────────────────────────────────────────────────────────
  const capture = useCallback(async () => {
    if (!videoRef.current || capturing || pageCount >= MAX_PAGES) return;
    setCapturing(true);
    setFlash(true);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);

    const corners = manualCorners ?? cornersRef.current;
    const warped = corners ? perspectiveTransform(canvas, corners) : canvas;
    const filtered = applyFilter(warped, filter);

    const dataUrl = filtered.toDataURL('image/jpeg', 0.92);
    const thumb = makeThumbnail(filtered);

    onCapture(dataUrl, thumb);
    setManualCorners(null);
    cornersRef.current = null;

    setTimeout(() => { setFlash(false); setCapturing(false); }, 350);
  }, [capturing, pageCount, filter, manualCorners, onCapture]);

  // ── Touch-drag corner adjustment ────────────────────────────────────────────
  const handleOverlayPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const current = manualCorners ?? cornersRef.current;
      if (!current) return;

      const scaleX = overlay.width / rect.width;
      const scaleY = overlay.height / rect.height;
      const cx = px * scaleX, cy = py * scaleY;

      // Find nearest corner
      let nearest = 0, nearDist = Infinity;
      current.forEach((p, i) => {
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < nearDist) { nearDist = d; nearest = i; }
      });

      if (nearDist > 40) return;
      draggingRef.current = { idx: nearest, startX: cx, startY: cy };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [manualCorners]
  );

  const handleOverlayPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (overlay.width / rect.width);
      const py = (e.clientY - rect.top) * (overlay.height / rect.height);

      const base = manualCorners ?? cornersRef.current ?? defaultCorners(overlay.width, overlay.height);
      const next = [...base] as Corners;
      next[draggingRef.current.idx] = { x: px, y: py };
      setManualCorners(next);
    },
    [manualCorners]
  );

  const handleOverlayPointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  const remaining = MAX_PAGES - pageCount;

  return (
    <div className="fixed inset-0 bg-black flex flex-col select-none">
      {/* Flash */}
      {flash && <div className="capture-flash" />}

      {/* Camera */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {/* Detection Overlay */}
      <canvas
        ref={overlayRef}
        width={videoDims.w}
        height={videoDims.h}
        className="absolute inset-0 w-full h-full touch-none"
        onPointerDown={handleOverlayPointerDown}
        onPointerMove={handleOverlayPointerMove}
        onPointerUp={handleOverlayPointerUp}
      />

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-safe-top pb-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex flex-col">
          <span className="font-display text-xs uppercase tracking-widest text-text-secondary">
            Answer Sheet
          </span>
          <span className="font-mono text-sm text-text-primary">
            Page{' '}
            <span className="text-accent font-semibold">{pageCount + 1}</span>
            <span className="text-text-secondary"> / {MAX_PAGES}</span>
          </span>
        </div>

        {/* Detection badge */}
        <div
          className={`px-2 py-1 rounded-full text-xs font-mono transition-all ${
            hasDetection
              ? 'bg-accent/20 text-accent border border-accent/40'
              : 'bg-white/10 text-text-secondary border border-white/10'
          }`}
        >
          {hasDetection ? '◉ Auto' : '○ Manual'}
        </div>

        <button
          onClick={onDone}
          disabled={pageCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
            bg-accent/10 border border-accent/30 text-accent text-sm font-semibold
            disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          Done
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>

      {/* ── Drag hint ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex justify-center mt-1">
        <span className="text-[11px] text-white/40 font-mono">
          drag corner dots to adjust
        </span>
      </div>

      {/* ── Bottom Controls ──────────────────────────────────────────────────── */}
      <div className="relative z-10 mt-auto pb-safe-bottom px-4 pt-4 bg-gradient-to-t from-black/80 to-transparent">
        {/* Filter row */}
        <div className="flex justify-center gap-2 mb-5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-all
                ${filter === f.value
                  ? 'bg-accent text-bg font-semibold'
                  : 'bg-white/10 text-white/60 border border-white/15'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Capture row */}
        <div className="flex items-center justify-between pb-6">
          {/* Page stack preview */}
          <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/20 bg-white/5 flex items-center justify-center">
            {pageCount > 0 ? (
              <div className="text-center">
                <div className="font-mono text-accent text-lg font-bold leading-none">{pageCount}</div>
                <div className="text-[10px] text-white/40 mt-0.5">pages</div>
              </div>
            ) : (
              <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            )}
          </div>

          {/* Capture button */}
          <button
            onClick={capture}
            disabled={capturing || pageCount >= MAX_PAGES}
            className="relative w-20 h-20 flex items-center justify-center disabled:opacity-40"
          >
            {/* Outer ring */}
            <div className={`absolute inset-0 rounded-full border-2 transition-colors
              ${hasDetection ? 'border-accent' : 'border-white/50'}`}
            />
            {/* Inner circle */}
            <div className={`w-16 h-16 rounded-full transition-all active:scale-90
              ${hasDetection ? 'bg-accent' : 'bg-white'}`}
            />
          </button>

          {/* Remaining count */}
          <div className="w-14 text-center">
            <div className="font-mono text-text-secondary text-xs">{remaining}</div>
            <div className="text-[10px] text-text-muted">left</div>
          </div>
        </div>
      </div>
    </div>
  );
}
