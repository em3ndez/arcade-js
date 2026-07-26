// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintScreen — lay down a whole screen: a selectable tile layer and its colour
 * layer from ROM, the two fixed playfield edge columns and the score HUD, then arm
 * the screen's cell-animation counter.  ROM 0x0673.
 *
 * Puts a complete screen up in one shot. The playfield is a 32x32 grid of tile cells
 * with a matching colour cell each; this routine fills both:
 *   1. Waits one frame for the prior display work to settle.
 *   2. Copies a 1024-cell tile image out of ROM into the tilemap the display reads.
 *      Two tile images are baked into ROM and the low bit of the display-mode byte
 *      picks which one — so the same routine paints either screen variant.
 *   3. Waits one more frame, then copies the fixed 1024-cell colour image into the
 *      colour map, tinting the tile image.
 *   4. Stamps the two fixed edge columns (left then right) and repaints the score HUD
 *      over the freshly laid screen.
 *   5. Arms the screen's cell-animation counter to 1, which starts the per-frame
 *      recolour cycle that walks that counter down on an eight-frame period.
 *
 * Which screen the two ROM tile images represent (and what the mode bit distinguishes)
 * is not yet pinned; the name asserts only the mechanism — compose a full screen from
 * a selectable tile layer plus its colour layer, add the fixed furniture, and start
 * its animation — which is exactly what the code does.
 *
 * The frame-waits keep their stack-return boundary (they read the frame count out of
 * the machine and return through the work stack), so each is handed its count and
 * bracketed with the return slot it pops; the edge-column, HUD and animation work are
 * already idiomatic and called directly.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0673.test.js.
 * GATE:     crafted-harness — dispatched once during boot (from round setup 0x031a).
 *           The two frame-waits busy-wait on a per-frame countdown the interrupt drains
 *           in the live game; run in isolation that tick is modelled by one identical
 *           hook on both sides so the waits terminate. EQUAL on the real captured boot
 *           dispatch plus a crafted entry that flips the display-mode bit to force the
 *           other tile-image variant. Teeth: a wrong tile byte, a wrong colour byte,
 *           and a wrong animation-counter value are each caught.
 * LIVE-OUT: memory-only — the painted tilemap and colour map, the edge columns and HUD
 *           its callees paint, and the cell-animation counter left at 1. The register
 *           file it leaves is dead (the caller reloads before reading). Its exit pc/SP
 *           balance back to the caller but are excluded from the gate per the contract.
 * NAMES:    none from ram.js apply — the tilemap (0x9000) and colour map (0x8800) are
 *           hardware RAM, the tile/colour images are ROM tables, 0x8028 is the
 *           display-mode byte, and 0x805c is the cell-animation counter; all stay hex.
 */
import { waitFrames } from "./waitFrames.js";
import { loc_46f4 } from "./loc_46f4.js";
import { redrawScoreHud } from "./redrawScoreHud.js";
import { loc_47a1 } from "./loc_47a1.js";

import { LEVEL } from "./ram.js";
const VIDEO_RAM_BASE = 0x9000; // start of the 32x32 tilemap the display reads
const COLOR_RAM_BASE = 0x8800; // start of the matching per-cell colour map
const TILE_IMAGE_A = 0x0762; // ROM tile image chosen when the display-mode bit is set
const TILE_IMAGE_B = 0x0b62; // ROM tile image chosen when the display-mode bit is clear
const COLOR_IMAGE = 0x0f62; // ROM colour image (single, not selectable)
const SCREEN_CELLS = 1024; // the whole 32x32 grid (0x9000..0x93ff, 0x8800..0x8bff)
const ANIMATION_COUNTER = 0x805c; // armed to 1 to start the per-frame cell recolour cycle

export function paintScreen(m) {
  const { mem } = m;

  // Let a frame pass so the prior display setup takes, then copy the selected tile
  // image over the whole tilemap. The frame-wait reads its one-frame count out of the
  // machine and returns through the work stack, so hand it the count and the slot it pops.
  m.regs.a = 1;
  m.push16(0x0678);
  waitFrames(m);

  const tileImage = (mem.read8(LEVEL) & 1) === 1 ? TILE_IMAGE_A : TILE_IMAGE_B;
  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem.write8(VIDEO_RAM_BASE + cell, mem.read8(tileImage + cell));
  }

  // Let another frame pass, then tint the tile image with the fixed colour map.
  m.regs.a = 1;
  m.push16(0x0692);
  waitFrames(m);

  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem.write8(COLOR_RAM_BASE + cell, mem.read8(COLOR_IMAGE + cell));
  }

  // Stamp the two fixed edge columns and repaint the score HUD over the new screen.
  loc_46f4(m); // left edge column
  redrawScoreHud(m); // both players' scores + status label + HUD colour columns
  loc_47a1(m); // right edge column

  // Arm the cell-animation counter so the per-frame recolour cycle begins.
  mem.write8(ANIMATION_COUNTER, 1);

  // Model the return to the still-oracle caller through the balanced work stack.
  return m.ret();
}
