'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useScanStore } from '@/store/scanStore';
import QRScanner from '@/components/QRScanner';

type Stage = 'idle' | 'scanning' | 'processing' | 'error';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useScanStore((s) => s.setSession);
  const reset = useScanStore((s) => s.reset);

  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const processedRef = useRef(false);

  // ── Handle ?id= query param (scanned by native camera app) ────────────────
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && !processedRef.current) {
      processedRef.current = true;
      handleToken(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Handle scanned token ──────────────────────────────────────────────────
  const handleToken = async (token: string) => {
    setStage('processing');
    try {
      // Basic sanity check on token length
      if (token.length < 8) throw new Error('Invalid QR code');

      // TODO: Optionally validate the token format / signature here
      // For now we trust it and let the API route verify against backend

      // Extract student ID from token payload if it's a JWT
      let studentId: string | undefined;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        studentId = payload.studentId ?? payload.sub ?? payload.id;
      } catch {
        // Not a JWT — treat the whole token as the student ID
        studentId = token.slice(0, 20);
      }

      reset();
      setSession(token, studentId);
      router.push('/scan');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'QR code not recognised');
      setStage('error');
    }
  };

  const startScan = async () => {
    try {
      const perm = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setCameraPermission(perm.state === 'denied' ? 'denied' : 'granted');
      if (perm.state === 'denied') return;
    } catch {
      // Firefox doesn't support camera permission query
    }
    setStage('scanning');
  };

  const retry = () => {
    setStage('idle');
    setErrorMsg('');
    processedRef.current = false;
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg overflow-hidden">
      {/* ── Background mesh ──────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, #00e5c8 0%, transparent 50%),
                              radial-gradient(circle at 80% 80%, #0066ff 0%, transparent 50%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg, transparent, transparent 39px, #ffffff 39px, #ffffff 40px
            ), repeating-linear-gradient(
              90deg, transparent, transparent 39px, #ffffff 39px, #ffffff 40px
            )`,
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col flex-1 px-6 pt-safe-top">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="pt-10 pb-8 animate-fade-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              AI Proctor
            </span>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-text-primary leading-tight">
            Answer Sheet
            <br />
            <span className="text-accent">Scanner</span>
          </h1>
          <p className="mt-2 text-text-secondary text-sm leading-relaxed">
            Scan the QR code on your exam desk to begin uploading your answer sheet.
          </p>
        </div>

        {/* ── Main card ────────────────────────────────────────────────── */}
        <div
          className="flex-1 flex flex-col items-center justify-center animate-fade-up"
          style={{ animationDelay: '120ms' }}
        >
          {/* ── IDLE state ──────────────────────────────────────────────── */}
          {stage === 'idle' && (
            <div className="w-full flex flex-col items-center gap-8">
              {/* QR Illustration */}
              <div className="relative">
                <div
                  className="w-52 h-52 rounded-2xl border-2 border-dashed border-accent/40
                    flex items-center justify-center bg-surface"
                >
                  <QRIllustration />
                </div>
                {/* Corner accents */}
                {[
                  'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
                  'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                  'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
                  'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
                ].map((cls, i) => (
                  <div
                    key={i}
                    className={`absolute w-5 h-5 border-accent ${cls}`}
                    style={{ animation: `cornerPulse 2s ease ${i * 0.15}s infinite` }}
                  />
                ))}
              </div>

              <div className="w-full flex flex-col gap-3">
                {/* Primary: open camera */}
                <button
                  onClick={startScan}
                  className="w-full py-4 rounded-xl font-display font-bold text-base
                    bg-accent text-bg tracking-wide
                    active:scale-[0.97] transition-transform shadow-lg shadow-accent/20"
                >
                  Scan QR Code
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-text-muted font-mono">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Helper text for native camera */}
                <div className="bg-surface border border-border rounded-xl p-4 text-center">
                  <p className="text-text-secondary text-sm">
                    Use your phone's native camera app to scan the QR — it will open this page automatically.
                  </p>
                </div>
              </div>

              {cameraPermission === 'denied' && (
                <PermissionBanner />
              )}
            </div>
          )}

          {/* ── SCANNING state ──────────────────────────────────────────── */}
          {stage === 'scanning' && (
            <div className="fixed inset-0 bg-black z-50 flex flex-col">
              <div className="relative flex-1">
                <QRScanner onScan={handleToken} active />

                {/* Scan overlay UI */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Top bar */}
                  <div className="flex items-center justify-between px-4 pt-safe-top pb-3
                    bg-gradient-to-b from-black/70 to-transparent">
                    <span className="font-display text-sm font-bold text-white">
                      Scan QR Code
                    </span>
                    <button
                      className="pointer-events-auto text-white/70 text-sm underline"
                      onClick={() => setStage('idle')}
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Centre viewfinder */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-64 h-64">
                      {/* Scanning line */}
                      <div
                        className="absolute left-4 right-4 h-0.5 bg-accent/80"
                        style={{
                          top: '8px',
                          '--scan-height': '248px',
                          animation: 'scanLine 2s ease-in-out infinite',
                        } as React.CSSProperties}
                      />
                      {/* Corner brackets */}
                      {[
                        'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
                        'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
                        'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
                        'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
                      ].map((cls, i) => (
                        <div key={i} className={`absolute w-8 h-8 border-accent ${cls}`} />
                      ))}
                    </div>
                  </div>

                  {/* Bottom hint */}
                  <div className="absolute bottom-0 inset-x-0 pb-safe-bottom pb-8
                    flex justify-center bg-gradient-to-t from-black/60 to-transparent pt-8">
                    <p className="text-white/60 text-sm font-mono">
                      Point at the QR code on your exam desk
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PROCESSING state ────────────────────────────────────────── */}
          {stage === 'processing' && (
            <div className="flex flex-col items-center gap-6 animate-scale-in">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-border" />
                <div
                  className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent"
                  style={{ animation: 'spin 0.8s linear infinite' }}
                />
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-text-primary">Verifying session…</p>
                <p className="text-text-secondary text-sm mt-1">Please wait</p>
              </div>
            </div>
          )}

          {/* ── ERROR state ─────────────────────────────────────────────── */}
          {stage === 'error' && (
            <div className="w-full flex flex-col items-center gap-6 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-danger/10 border border-danger/30
                flex items-center justify-center">
                <span className="text-danger text-2xl">!</span>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-text-primary">QR Code Invalid</p>
                <p className="text-text-secondary text-sm mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={retry}
                className="w-full py-4 rounded-xl font-display font-bold text-base
                  bg-accent text-bg active:scale-[0.97] transition-transform"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="pb-safe-bottom pb-8 pt-6 text-center animate-fade-up" style={{ animationDelay: '240ms' }}>
          <p className="text-text-muted text-xs font-mono">
            Session is secured · Images are encrypted at rest
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QRIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" className="opacity-60">
      {/* Top-left finder */}
      <rect x="8" y="8" width="28" height="28" rx="3" stroke="#00e5c8" strokeWidth="3" fill="none"/>
      <rect x="14" y="14" width="16" height="16" rx="1" fill="#00e5c8" opacity="0.6"/>
      {/* Top-right finder */}
      <rect x="60" y="8" width="28" height="28" rx="3" stroke="#00e5c8" strokeWidth="3" fill="none"/>
      <rect x="66" y="14" width="16" height="16" rx="1" fill="#00e5c8" opacity="0.6"/>
      {/* Bottom-left finder */}
      <rect x="8" y="60" width="28" height="28" rx="3" stroke="#00e5c8" strokeWidth="3" fill="none"/>
      <rect x="14" y="66" width="16" height="16" rx="1" fill="#00e5c8" opacity="0.6"/>
      {/* Data modules */}
      {[
        [44,8],[50,8],[56,8],[44,14],[50,20],[56,14],[44,20],[56,20],
        [44,26],[50,26],[44,32],[56,32],[8,44],[14,44],[20,44],[26,44],
        [8,50],[20,50],[26,50],[8,56],[14,56],[20,56],[26,56],[8,62],
        [44,44],[50,44],[56,44],[62,44],[68,44],[44,50],[62,50],[44,56],
        [50,56],[56,56],[68,50],[62,56],[68,56],[44,62],[56,62],[68,62],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="4" height="4" rx="0.5" fill="#00e5c8" opacity="0.4"/>
      ))}
    </svg>
  );
}

function PermissionBanner() {
  return (
    <div className="w-full bg-danger/10 border border-danger/30 rounded-xl p-4">
      <p className="text-danger text-sm font-semibold">Camera permission denied</p>
      <p className="text-text-secondary text-xs mt-1">
        Go to your browser Settings → Site permissions → Camera, and allow access for this site.
      </p>
    </div>
  );
}
