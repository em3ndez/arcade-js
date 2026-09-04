// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";
import { COLLISION_FLAG } from "./names.js";

/**
 * drawSpriteWithCollision — OR-blit a hardware-shifted sprite while testing for overlap.
 *
 * WHAT IT IS
 *   Draws a sprite that can land at any pixel column (not just an 8-pixel boundary) by pushing each source
 *   byte through the board's bit shifter, and folds a hit test into the same pass: before merging each
 *   shifted byte onto the screen it ANDs it against what is already there, and any nonzero overlap latches
 *   COLLISION_FLAG. This is the blit the game reads after drawing a shot to know whether it struck something.
 *
 * ROLE IN THE MACHINE
 *   One of the four shifted blitters (see mechanisms.md, "Sprite drawing"). It is the OR-blit orBlitShiftedSprite
 *   with a collision test woven in. seatBlitPosition (ROM 0x1474) sends L's low three bits to output port
 *   0x02 as the shifter alignment and folds the coordinate into a video-RAM address. The hardware shifter is
 *   then driven per half: write a source byte to port 0x04, read the shifted result back from port 0x03;
 *   writing the byte and then a zero yields the two overlapping halves a pixel-shifted sprite occupies, which
 *   land in two adjacent screen bytes (HL and HL+1). COLLISION_FLAG (0x2061) is cleared once at the start and
 *   set to 1 on any overlap. drawAlienShotWithCollision (0x066c) seats the alien-shot descriptor and drops
 *   straight into this; the record processors also copy the resulting flag into PLAYER_SHOT_HIT for the
 *   collision resolver.
 *
 * ROM 0x1491-0x14ca.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: HL = destination one row-start past the last row, DE = source advanced past the sprite, A = the
 * last merged screen byte; COLLISION_FLAG reflects whether any bit overlapped.
 */
export function drawSpriteWithCollision(m, de = m.regs.de, b = m.regs.b, l = m.regs.l) {
  // Row count comes from B; the 8080 loop treats a count of 0 as a full wrap to 256 rows.
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass

  // Seat the pixel-shift offset (from L's low 3 bits) and get the screen address of the first row.
  let dst = seatBlitPosition(m, l); // screen address for the first row (shift offset from l)
  let src = de;

  // Start each blit assuming no collision; any overlap below flips this to 1.
  m.mem8[COLLISION_FLAG] = 0;
  let a = 0;
  for (let r = 0; r < rows; r++) {
    // Remember where this row began; both shifted halves are placed relative to it, and the next row is
    // this row-start + 0x20 (one screen column down).
    const rowStart = dst;

    // First half: feed the raw source byte to the shifter (port 0x04), read the aligned result (port 0x03).
    m.io.portOut(0x04, m.mem8[src]);
    let shifted = m.io.portIn(0x03);
    // Overlap test then OR-merge into the current screen byte (preserving whatever is already drawn).
    if (shifted & m.mem8[dst]) m.mem8[COLLISION_FLAG] = 1;
    a = shifted | m.mem8[dst];
    m.mem8[dst] = a;
    dst = u16(dst + 1);
    src = u16(src + 1);

    // Second half: feed a zero byte so the shifter emits the bits that spilled past the first byte; these
    // land in the adjacent screen byte (dst, now rowStart+1). Same overlap test and OR-merge.
    m.io.portOut(0x04, 0);
    shifted = m.io.portIn(0x03);
    if (shifted & m.mem8[dst]) m.mem8[COLLISION_FLAG] = 1;
    a = shifted | m.mem8[dst];
    m.mem8[dst] = a;

    // Step down one screen row: back to this row's start plus a 0x20 column stride.
    dst = u16(rowStart + 0x20);
  }

  // Publish the advanced pointers and last merged byte the way the 8080 leaves HL/DE/A for the caller.
  return [m.regs.hl = dst, m.regs.de = src, m.regs.a = a];
}
