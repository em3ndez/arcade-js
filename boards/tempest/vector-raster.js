// SPDX-License-Identifier: GPL-3.0-only
// Byte-exact software rasterizer for the AVG display list — a port of MAME 0.288's vector render pipeline
// as used by a headless AVI capture of a ROT270 vector screen (default beam/flicker options):
//   1. vector.cpp screen_update: each add_point becomes a container line (lastx/lasty -> point),
//      container coords cx=X/(65536*581), cy=Y/(65536*571); argb=(intensity<<24)|col; per-frame black clear.
//   2. render.cpp add_container_primitives: ROT270 (swap then flipY) -> pixel coords, target 480x640,
//      endpoints rounded to whole pixels (floor(f+0.5)) BEFORE rasterization.
//   3. rendersw.hxx draw_line: 16.16 fixed-point anti-aliased line, additive saturating blend.
// Beam width is a constant 1px (0x10000): beam_width_min==max==1.0 so the sigmoid collapses, and
// prim.width=(1/512)*480=0.9375 -> int(0.9375*65536)=61440 < 0x10000 -> clamped to 0x10000.
// Floats are reproduced in float32 (Math.fround) in MAME's evaluation order. Line refs are MAME source.

export const FRAME_W = 480;
export const FRAME_H = 640;

const VISW = 581; // screen.visible_area().width()  = 580-0+1  (tempest.cpp set_visarea(0,580,0,570))
const VISH = 571; // .height() = 570-0+1
const XSCALE = Math.fround(1.0 / (65536 * VISW)); // vector.cpp:182
const YSCALE = Math.fround(1.0 / (65536 * VISH)); // vector.cpp:183
const BEAM = 0x10000; // see header — constant 1px

// s_cosine_table: 2049 entries, u32((1/cos(atan(i/2048)))*0x10000000 + 0.5), computed in double.
// rendersw.hxx:34-36 / draw_line:436. Perpendicular beam-thickness correction vs slope.
const COSINE = (() => {
  const t = new Uint32Array(2049);
  for (let i = 0; i < 2049; i++) {
    t[i] = Math.floor((1.0 / Math.cos(Math.atan(i / 2048.0))) * 0x10000000 + 0.5) >>> 0;
  }
  return t;
})();

function mul32x32hi(a, b) {
  return Number((BigInt(a) * BigInt(b)) >> 32n); // (s64(a)*s64(b))>>32, arithmetic
}
function div32x32shift(a, b, shift) {
  return Number((BigInt(a) << BigInt(shift)) / BigInt(b)); // (s64(a)<<shift)/b, trunc toward zero
}

// container coord (0..1) for an AVG endpoint; float32 throughout (float(X) loses precision for large X,
// exactly as MAME does). xoffs=yoffs=0.
function containerX(X) { return Math.fround(Math.fround(X) * XSCALE); }
function containerY(Y) { return Math.fround(Math.fround(Y) * YSCALE); }

// ROT270 (swap then flipY) container(0..1) -> integer pixel. bx=cy, by=1-cx; px=round(bx*480), py=round(by*640).
function toPixelX(cx, cy) { return Math.floor(Math.fround(Math.fround(cy * 480.0) + 0.5)); }
function toPixelY(cx, cy) { return Math.floor(Math.fround(Math.fround(Math.fround(1.0 - cx) * 640.0) + 0.5)); }

// apply_intensity(i,col)=col.scale8(i): per channel clamphi((c*i)>>8). palette.h:64.
function scale8(col, i) {
  const r = Math.min(255, (((col >>> 16) & 0xff) * i) >> 8);
  const g = Math.min(255, (((col >>> 8) & 0xff) * i) >> 8);
  const b = Math.min(255, ((col & 0xff) * i) >> 8);
  return ((r << 16) | (g << 8) | b) >>> 0;
}

function drawAaPixel(frame, pitch, x, y, col) {
  const idx = y * pitch + x;
  const dpix = frame[idx];
  const dr = Math.min(255, ((col >>> 16) & 0xff) + ((dpix >>> 16) & 0xff));
  const dg = Math.min(255, ((col >>> 8) & 0xff) + ((dpix >>> 8) & 0xff));
  const db = Math.min(255, (col & 0xff) + (dpix & 0xff));
  frame[idx] = ((dr << 16) | (dg << 8) | db) >>> 0;
}

// draw_line (rendersw.hxx:433-528), ANTIALIAS path only (vector lines set ANTIALIAS). Endpoints are the
// pre-rounded integer pixel coords; x1=px0<<16 etc (int(px*65536) is exact since px is integral). col is
// the final 0xRRGGBB (intensity already folded).
function drawLine(frame, width, height, pitch, px0, py0, px1, py1, col) {
  let x1 = px0 << 16, y1 = py0 << 16;
  const x2 = px1 << 16, y2 = py1 << 16;
  let beam = BEAM;
  let dx = Math.abs(x1 - x2);
  let dy = Math.abs(y1 - y2);

  if (dx >= dy) {
    const sx = x1 <= x2 ? 1 : -1;
    const sy = dy === 0 ? 0 : div32x32shift(y2 - y1, dx, 16);
    if (sy < 0) dy--;
    x1 >>= 16;
    const xx = x2 >> 16;
    const bwidth = mul32x32hi(beam << 4, COSINE[Math.abs(sy) >> 5]);
    y1 -= bwidth >> 1;
    for (;;) {
      if (x1 >= 0 && x1 < width) {
        dx = bwidth;
        dy = y1 >> 16;
        if (dy >= 0 && dy < height) drawAaPixel(frame, pitch, x1, dy, scale8(col, 0xff & (~y1 >> 8)));
        dy++;
        dx -= 0x10000 - (0xffff & y1);
        const a1 = (dx >> 8) & 0xff;
        dx >>= 16;
        while (dx-- > 0) {
          if (dy >= 0 && dy < height) drawAaPixel(frame, pitch, x1, dy, col);
          dy++;
        }
        if (dy >= 0 && dy < height) drawAaPixel(frame, pitch, x1, dy, scale8(col, a1));
      }
      if (x1 === xx) break;
      x1 += sx;
      y1 += sy;
    }
  } else {
    const sy = y1 <= y2 ? 1 : -1;
    const sx = dx === 0 ? 0 : div32x32shift(x2 - x1, dy, 16);
    if (sx < 0) dx--;
    y1 >>= 16;
    const yy = y2 >> 16;
    const bwidth = mul32x32hi(beam << 4, COSINE[Math.abs(sx) >> 5]);
    x1 -= bwidth >> 1;
    for (;;) {
      if (y1 >= 0 && y1 < height) {
        dy = bwidth;
        dx = x1 >> 16;
        if (dx >= 0 && dx < width) drawAaPixel(frame, pitch, dx, y1, scale8(col, 0xff & (~x1 >> 8)));
        dx++;
        dy -= 0x10000 - (0xffff & x1);
        const a1 = (dy >> 8) & 0xff;
        dy >>= 16;
        while (dy-- > 0) {
          if (dx >= 0 && dx < width) drawAaPixel(frame, pitch, dx, y1, col);
          dx++;
        }
        if (dx >= 0 && dx < width) drawAaPixel(frame, pitch, dx, y1, scale8(col, a1));
      }
      if (y1 === yy) break;
      y1 += sy;
      x1 += sx;
    }
  }
}

// The vector.cpp:198-240 loop: iterate the add_point list, track lastx/lasty (init 0), draw a line for
// each nonzero-intensity point. Returns an RGB888 (top-to-bottom, R,G,B) frame buffer, 480x640.
export function renderFrame(points) {
  const frame = new Uint32Array(FRAME_W * FRAME_H); // 0x00RRGGBB, cleared black (add_rect background)
  let lastx = 0, lasty = 0;
  for (const p of points) {
    const intensity = Math.max(0, Math.min(255, p.intensity));
    if (intensity !== 0) {
      const col = foldColor(p.col, intensity);
      const cx0 = containerX(lastx), cy0 = containerY(lasty);
      const cx1 = containerX(p.x), cy1 = containerY(p.y);
      drawLine(
        frame, FRAME_W, FRAME_H, FRAME_W,
        toPixelX(cx0, cy0), toPixelY(cx0, cy0),
        toPixelX(cx1, cy1), toPixelY(cx1, cy1),
        col,
      );
    }
    lastx = p.x; lasty = p.y;
  }
  const rgb = new Uint8Array(FRAME_W * FRAME_H * 3);
  for (let i = 0, j = 0; i < frame.length; i++, j += 3) {
    const px = frame[i];
    rgb[j] = (px >>> 16) & 0xff;
    rgb[j + 1] = (px >>> 8) & 0xff;
    rgb[j + 2] = px & 0xff;
  }
  return rgb;
}

// Final draw_line color: col = rgb_t(int(255*r*a), ...). Channels come from add_generic's reciprocal
// multiply argb.r()*(1/255) (render.cpp:793-796) — NOT a divide (differs by a float32 ULP) — then the
// brightness/contrast/gamma pass render.cpp:2539-2542 (identity at defaults, but (x*1)+1-1 loses a
// float32 bit near 0.95, which is the red off-by-one). Then int(255*r*a) with a also bcg'd (rendersw.hxx:445).
const INV255 = Math.fround(1.0 / 255.0);
function bcg(x) {
  // apply_brightness_contrast_gamma_fp(x, b=1, c=1, g=1): pow(x,1)=x, then (x*1)+1-1, clamp01. rendutil.h:124.
  const v = Math.fround(Math.fround(x + 1.0) - 1.0);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function foldColor(argbCol, intensity) {
  const af = bcg(Math.fround(intensity * INV255));
  const chan = (c) => {
    const cf = bcg(Math.fround(c * INV255));
    return Math.trunc(Math.fround(Math.fround(255.0 * cf) * af)) & 0xff;
  };
  const r = chan((argbCol >>> 16) & 0xff);
  const g = chan((argbCol >>> 8) & 0xff);
  const b = chan(argbCol & 0xff);
  return ((r << 16) | (g << 8) | b) >>> 0;
}
