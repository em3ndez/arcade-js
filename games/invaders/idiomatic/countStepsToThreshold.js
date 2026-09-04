// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { normalizeUpBySteps } from "./normalizeUpBySteps.js";

/**
 * countStepsToThreshold -- turn a pixel coordinate into a coarse grid-block index by counting 0x10 steps.
 *
 * WHAT IT IS
 *   The shared scaling primitive behind scaleXToBlock / scaleYToBlock. Given a starting value A and a
 *   threshold H, it counts how many whole 0x10 (16-pixel) steps it takes to lift A up to or past H, and
 *   returns that step count. Since a grid cell is 16 pixels, the count is the block index the coordinate
 *   falls in, and the residual left in A is the offset within that block.
 *
 * ROLE IN THE MACHINE
 *   Register-in/register-out (no memory touched): A = the starting coordinate, H = the threshold. Drives
 *   the screen-to-grid mapping the object logic works in -- scaleXToBlock passes the fleet reference X
 *   (loc_2009) as the starting value A and the object's X coordinate as the threshold H; scaleYToBlock
 *   passes the reference Y (loc_200a) as A and the Y coordinate as H. A coordinate that reads as an
 *   unsigned value at/above H (the wrapped/"negative" case, high bit set) is pre-normalized up into range
 *   first through normalizeUpBySteps (the ROM `cnc 0x1590` -- call when the CMP left no borrow).
 *
 * ROM 0x1554-0x1561.  Grounding: [seen].
 *
 * LIVE-OUT: A = the residual coordinate (at/past H), C = the step/block count, carry cleared.
 */
export function countStepsToThreshold(m, a = m.regs.a, h = m.regs.h) {
  let c = 0;
  // Pre-normalize the wrapped/negative case: if A already reads at or above H, lift it up in 0x10 steps
  // (counting each into C) until it is back in range, mirroring the ROM's `cnc` into normalizeUpBySteps.
  if (a >= h) [a, c] = normalizeUpBySteps(m, a, c);
  // Main count: add 0x10 and bump C until A reaches or passes the threshold -- C ends as the block index.
  while (a < h) {
    a = u8(a + 0x10);
    c = u8(c + 1);
  }
  // Carry exits CLEAR (A has reached/passed H); it is a live-out the callers read, so clear it explicitly.
  return [(m.regs.a = a), (m.regs.c = c), (m.regs.fC = false)];
}
