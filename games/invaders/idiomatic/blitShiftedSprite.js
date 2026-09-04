// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";

/**
 * blitShiftedSprite — draw a pixel-aligned sprite by pushing it through the hardware bit shifter.
 *
 * WHAT IT IS
 *   The overwriting member of the four shifted-sprite blitters. A sprite's horizontal position is a
 *   pixel coordinate, not a byte address, so to land it at any of the eight pixels within a byte the
 *   source bytes are fed through the mw8080bw board's MB14241 bit shifter. For each of B source rows
 *   this writes the source byte to output port 0x04, reads the shifted result back from input port
 *   0x03 and stores it, then writes a zero to port 0x04 and reads the other overlapping half — the two
 *   halves a shifted sprite occupies — laying them into two adjacent screen bytes (dst and dst+1)
 *   before stepping the destination down one screen row (0x20). Being the OVERWRITE blitter it stores
 *   both halves straight in, clobbering whatever was underneath (contrast orBlitShiftedSprite, which
 *   merges; eraseShiftedSprite, which clears; drawSpriteWithCollision, which OR-blits with a hit test).
 *
 * ROLE IN THE MACHINE
 *   Callers seat the shift alignment via seatBlitPosition (0x1474) — this routine's first act — which
 *   sends L's low three bits to port 0x02 as the shifter's alignment offset and folds HL into a
 *   video-RAM address through coordToScreenAddr. From there the loop does the actual draw. It is the
 *   spine of alien/animation drawing (drawPendingAlien, stepAnimationFrame). Inputs: DE = source
 *   graphic pointer, B = row count. Writes video RAM; drives shifter ports 0x02/0x03/0x04.
 *
 * ROM 0x15d3.  Grounding: [seen].
 *
 * LIVE-OUT: HL = base (the seated top-left screen address), DE = source advanced past the B rows,
 *   B = 0 (drained by the row loop).
 */
export function blitShiftedSprite(m, de = m.regs.de, b = m.regs.b) {
  // Seat the blit: seatBlitPosition sends L&7 to shifter port 0x02 (the sub-byte alignment) and folds
  // the coordinate in HL into a video-RAM address. `base` is that top-left screen address.
  const base = seatBlitPosition(m);
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass
  // Walk source rows and screen rows in lockstep: source runs forward one byte at a time, the screen
  // pointer drops one full row (0x20 bytes) per iteration.
  let src = de;
  let dst = base;
  for (let i = 0; i < rows; i++) {
    // Feed this row's source byte into the shifter and read back the low (left) half at the seated
    // alignment; store it at the current screen byte.
    m.io.portOut(0x04, m.mem8[src]);
    m.mem8[dst] = m.io.portIn(0x03);
    // Feed a zero and read back the high (right) half the shift spilled into the neighbouring byte;
    // store it one byte to the right (dst+1). Together the two bytes hold the pixel-shifted row.
    m.io.portOut(0x04, 0);
    m.mem8[u16(dst + 1)] = m.io.portIn(0x03);
    // Advance to the next source byte and drop the destination one screen row (stride 0x20).
    src = u16(src + 1);
    dst = u16(dst + 0x20);
  }
  // Live-out: HL = seated base, DE = source past the sprite, B drained to 0.
  return [(m.regs.hl = base), (m.regs.de = src), (m.regs.b = 0)];
}
