// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitFrogAnimColumnOnTrigger  —  ROM 0x0F8C (0x0F8C–0x0FAE)  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   A one-shot, trigger-gated tile blit that paints a single eight-cell-tall VRAM column from a fixed
 *   ROM tile-pair pattern. Each of the eight rows copies a two-byte tile pair (a 2-wide sliver) into
 *   the frame buffer, and the whole column is drawn in one pass. The "trigger" makes it fire exactly
 *   once: it runs only when the trigger cell is armed, and it disarms the cell on the way out.
 *
 * WHERE IT SITS
 *   The frog-animation dispatcher (dispatchFrogAnimationArm, ROM 0x0FAF) fans each frame out to eleven
 *   render arms. Arm 1 — renderFrogAnimArm1 (ROM 0x1058) — is the ONLY arm that runs a pre-blit before
 *   its own render, and this is that pre-blit: it fires first, then arm 1 does its regular column render.
 *   The trigger it reads, FROG_ANIM_BLIT_TRIGGER (0x8118), is armed elsewhere — driveFrogDeathAnimation
 *   (ROM 0x16F8) mirrors FIGURE_ANIM_STEP_GATE (0x8150) bit0 into it — so the death/hop animation is what
 *   requests this repaint, and arm 1's pre-blit is what consumes the request. On the overwhelming majority
 *   of frames the trigger is clear and this routine returns immediately, touching no memory.
 *
 * LIVE-OUT
 *   Memory only. On a fired blit it writes sixteen VRAM tile cells (two per row × eight rows) and clears
 *   the trigger cell. It returns nothing and leaves no register the caller reads.
 */
import { FROG_ANIM_BLIT_TRIGGER, FROG_ANIM_COLUMN_VRAM, FROG_ANIM_TILE_PAIR_SRC } from "./names.js";

// Eight rows tall — one full tile column. The Z80 drives this with a `djnz` from B = 0x08 (ROM 0x0F94).
const ROWS = 8;

// Stepping the VRAM destination by +0x20 (32) moves down one row of Frogger's rotated framebuffer.
// In the ROM the +0x20 is assembled as two moves per row — the byte-1 write bumps the pointer by +1
// (0x0F9D), then a `BC = 0x001F` add (0x0FA4) supplies the remaining +0x1F — netting the +0x20 we do
// directly here.
const ROW_STRIDE = 32;

// Each row of the pattern is a tile PAIR: two adjacent bytes. So the ROM source advances +2 per row.
const PAIR_BYTES = 2;

export function blitFrogAnimColumnOnTrigger(m) {
  const { mem8 } = m;

  // ── Gate: is a repaint armed? ─────────────────────────────────────────────────────────
  // FROG_ANIM_BLIT_TRIGGER (0x8118) is the one-shot request flag. When it is 0 there is nothing to draw,
  // and the routine returns at once (the ROM's `ret z` at 0x0F90) without writing a single cell — which
  // is the state on almost every frame.
  if (mem8[FROG_ANIM_BLIT_TRIGGER] === 0) return;

  // ── Blit the column: eight rows of a two-byte tile pair ───────────────────────────────
  // Copy the fixed ROM pattern at FROG_ANIM_TILE_PAIR_SRC (0x1413) straight down the VRAM column based at
  // FROG_ANIM_COLUMN_VRAM (0xa806). Row `row` reads the pair at src+row*2 and writes it to dest+row*32,
  // so consecutive rows step down one framebuffer row each. (This 0xa806 column is a DIFFERENT VRAM region
  // from the two-pair figure quad at 0xa846 — it is the descending dive column the frame copier also
  // paints into.) No 16-bit wrap guard is needed: the highest address touched is 0xa806 + 7*32 + 1 = 0xa8e7,
  // well inside VRAM, and the source tops out at 0x1422.
  for (let row = 0; row < ROWS; row++) {
    const dest = FROG_ANIM_COLUMN_VRAM + row * ROW_STRIDE;
    const src = FROG_ANIM_TILE_PAIR_SRC + row * PAIR_BYTES;
    mem8[dest] = mem8[src];
    mem8[dest + 1] = mem8[src + 1];
  }

  // ── Disarm: make the blit one-shot ────────────────────────────────────────────────────
  // Clear FROG_ANIM_BLIT_TRIGGER (0x8118) so the column is not repainted every frame — it fires once per
  // arming and then waits to be re-triggered (the ROM's `xor a` / store at 0x0FAB–0x0FAE).
  mem8[FROG_ANIM_BLIT_TRIGGER] = 0;
}
