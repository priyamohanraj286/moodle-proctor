// ─────────────────────────────────────────────────────────────────────────────
// Image Processing Utilities
// ─────────────────────────────────────────────────────────────────────────────

export interface Point { x: number; y: number }
// Corners in order: [TopLeft, TopRight, BottomRight, BottomLeft]
export type Corners = [Point, Point, Point, Point];
export type FilterType = 'original' | 'grayscale' | 'bw' | 'enhance';

// ── Internals ─────────────────────────────────────────────────────────────────

function toGrayscale(data: Uint8ClampedArray, len: number): Uint8Array {
  const g = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const b = i * 4;
    g[i] = (0.299 * data[b] + 0.587 * data[b + 1] + 0.114 * data[b + 2]) | 0;
  }
  return g;
}

function gaussianBlur5(src: Uint8Array, w: number, h: number): Uint8Array {
  const K = [1, 4, 6, 4, 1, 4, 16, 24, 16, 4, 6, 24, 36, 24, 6, 4, 16, 24, 16, 4, 1, 4, 6, 4, 1];
  const out = new Uint8Array(w * h);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      let acc = 0;
      for (let ky = -2; ky <= 2; ky++)
        for (let kx = -2; kx <= 2; kx++)
          acc += src[(y + ky) * w + (x + kx)] * K[(ky + 2) * 5 + (kx + 2)];
      out[y * w + x] = (acc / 256) | 0;
    }
  }
  return out;
}

function sobelMagnitude(src: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -src[(y - 1) * w + x - 1] - 2 * src[y * w + x - 1] - src[(y + 1) * w + x - 1] +
         src[(y - 1) * w + x + 1] + 2 * src[y * w + x + 1] + src[(y + 1) * w + x + 1];
      const gy =
        -src[(y - 1) * w + x - 1] - 2 * src[(y - 1) * w + x] - src[(y - 1) * w + x + 1] +
         src[(y + 1) * w + x - 1] + 2 * src[(y + 1) * w + x] + src[(y + 1) * w + x + 1];
      out[y * w + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy)) | 0;
    }
  }
  return out;
}

function otsuThreshold(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, maxVar = 0, t = 0;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > maxVar) { maxVar = v; t = i; }
  }
  return t;
}

// ── Public: Document Corner Detection ─────────────────────────────────────────
/**
 * Detects the four corners of a document in the given ImageData.
 * Uses edge detection + extremal-point method.
 * Returns [TL, TR, BR, BL] in original image coordinates, or null if confidence is low.
 */
export function detectDocumentCorners(imageData: ImageData): Corners | null {
  const { data, width: W, height: H } = imageData;

  // Downscale for speed
  const SCALE = 0.3;
  const w = Math.round(W * SCALE), h = Math.round(H * SCALE);
  const small = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.round(x / SCALE), sy = Math.round(y / SCALE);
      const i = Math.min(sy, H - 1) * W + Math.min(sx, W - 1);
      const b = i * 4;
      small[y * w + x] = (0.299 * data[b] + 0.587 * data[b + 1] + 0.114 * data[b + 2]) | 0;
    }
  }

  const blurred = gaussianBlur5(small, w, h);
  const edges = sobelMagnitude(blurred, w, h);

  // Compute histogram for Otsu
  const hist = new Uint32Array(256);
  let edgeTotal = 0;
  for (const v of edges) { hist[v]++; edgeTotal++; }
  const thresh = otsuThreshold(hist, edgeTotal) * 0.5;

  // Extremal corner detection using sum/diff heuristic
  const MARGIN = Math.floor(Math.min(w, h) * 0.04);
  let tlS = Infinity, brS = -Infinity, trD = Infinity, blD = -Infinity;
  let tl = { x: MARGIN, y: MARGIN };
  let br = { x: w - MARGIN, y: h - MARGIN };
  let tr = { x: w - MARGIN, y: MARGIN };
  let bl = { x: MARGIN, y: h - MARGIN };

  let edgeCount = 0;
  for (let y = MARGIN; y < h - MARGIN; y++) {
    for (let x = MARGIN; x < w - MARGIN; x++) {
      if (edges[y * w + x] < thresh) continue;
      edgeCount++;
      const s = x + y, d = x - y;
      if (s < tlS) { tlS = s; tl = { x, y }; }
      if (s > brS) { brS = s; br = { x, y }; }
      if (d < trD) { trD = d; bl = { x, y }; }
      if (d > blD) { blD = d; tr = { x, y }; }
    }
  }

  // Confidence check: need enough edge pixels and a large-enough quad
  if (edgeCount < w * h * 0.002) return null;
  const area = Math.abs(
    tl.x * (tr.y - bl.y) + tr.x * (br.y - tl.y) +
    br.x * (bl.y - tr.y) + bl.x * (tl.y - br.y)
  ) / 2;
  if (area < w * h * 0.04) return null;

  const inv = 1 / SCALE;
  return [
    { x: tl.x * inv, y: tl.y * inv },
    { x: tr.x * inv, y: tr.y * inv },
    { x: br.x * inv, y: br.y * inv },
    { x: bl.x * inv, y: bl.y * inv },
  ];
}

// ── Public: Default corners (full frame) ──────────────────────────────────────
export function defaultCorners(w: number, h: number, pad = 0.06): Corners {
  const px = w * pad, py = h * pad;
  return [
    { x: px,     y: py },
    { x: w - px, y: py },
    { x: w - px, y: h - py },
    { x: px,     y: h - py },
  ];
}

// ── Public: Perspective Transform ─────────────────────────────────────────────
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M: number[][] = A.map((r, i) => [...r, b[i]]);
  for (let col = 0; col < n; col++) {
    let max = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(M[r][col]) > Math.abs(M[max][col])) max = r;
    [M[col], M[max]] = [M[max], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

function computeH(src: Point[], dst: Point[]): number[] {
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i], { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]); b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]); b.push(dy);
  }
  return [...solveLinear(A, b), 1];
}

/**
 * Applies a perspective correction to srcCanvas using the given corners.
 * Returns a new canvas with the document straightened.
 */
export function perspectiveTransform(
  srcCanvas: HTMLCanvasElement,
  corners: Corners
): HTMLCanvasElement {
  const [tl, tr, br, bl] = corners;

  const outW = Math.round(
    Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y))
  );
  const outH = Math.round(
    Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y))
  );

  const dst: Point[] = [
    { x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH },
  ];

  // H maps dst -> src (inverse mapping)
  const H = computeH(dst, [...corners]);
  const [h0, h1, h2, h3, h4, h5, h6, h7] = H;

  const srcCtx = srcCanvas.getContext('2d')!;
  const srcImgData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const srcD = srcImgData.data;
  const sW = srcCanvas.width;

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = outW; dstCanvas.height = outH;
  const dstCtx = dstCanvas.getContext('2d')!;
  const dstImgData = dstCtx.createImageData(outW, outH);
  const dstD = dstImgData.data;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const denom = h6 * x + h7 * y + 1;
      const sx = (h0 * x + h1 * y + h2) / denom;
      const sy = (h3 * x + h4 * y + h5) / denom;
      const x0 = sx | 0, y0 = sy | 0, x1 = x0 + 1, y1 = y0 + 1;
      const di = (y * outW + x) * 4;

      if (x0 < 0 || y0 < 0 || x1 >= sW || y1 >= srcCanvas.height) {
        dstD[di] = dstD[di + 1] = dstD[di + 2] = 255;
        dstD[di + 3] = 255;
        continue;
      }

      const fx = sx - x0, fy = sy - y0;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy,       w11 = fx * fy;

      for (let c = 0; c < 4; c++) {
        dstD[di + c] = (
          srcD[(y0 * sW + x0) * 4 + c] * w00 +
          srcD[(y0 * sW + x1) * 4 + c] * w10 +
          srcD[(y1 * sW + x0) * 4 + c] * w01 +
          srcD[(y1 * sW + x1) * 4 + c] * w11
        ) | 0;
      }
    }
  }

  dstCtx.putImageData(dstImgData, 0, 0);
  return dstCanvas;
}

// ── Public: Filters ───────────────────────────────────────────────────────────
/**
 * Applies a visual filter to the canvas. Returns a new canvas.
 */
export function applyFilter(src: HTMLCanvasElement, filter: FilterType): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  if (filter === 'original') return out;

  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
    if (filter === 'grayscale') {
      d[i] = d[i + 1] = d[i + 2] = g;
    } else if (filter === 'bw') {
      const v = g > 140 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    } else if (filter === 'enhance') {
      // Boost contrast + sharpen luminance
      const contrast = 1.5, brightness = -15;
      const v = Math.max(0, Math.min(255, contrast * g + brightness)) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }

  ctx.putImageData(img, 0, 0);
  return out;
}

// ── Public: Generate Thumbnail ─────────────────────────────────────────────────
export function makeThumbnail(src: HTMLCanvasElement, maxW = 300, maxH = 400): string {
  const ratio = Math.min(maxW / src.width, maxH / src.height);
  const tw = Math.round(src.width * ratio), th = Math.round(src.height * ratio);
  const thumb = document.createElement('canvas');
  thumb.width = tw; thumb.height = th;
  thumb.getContext('2d')!.drawImage(src, 0, 0, tw, th);
  return thumb.toDataURL('image/jpeg', 0.7);
}
