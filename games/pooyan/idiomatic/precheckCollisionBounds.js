// SPDX-License-Identifier: GPL-3.0-only
/**
 * precheckCollisionBounds — bias an actor's X coordinate and test whether its Y (plus a fixed
 * margin) still clears the bottom of the playfield.
 *
 * ROM 0x5f53. Grounding: [seen].
 *
 * A leaf pre-check run before the real collision work. It reads a 3-byte-plus actor record
 * whose base address the caller supplies: byte +0x00 is the actor's X, byte +0x02 its Y. It
 * produces a biased X and a margin-shifted Y, and reports whether that Y is still above the
 * bottom limit — a cheap "is this actor on-screen enough to bother testing?" gate.
 *
 * The X bias depends on the screen orientation. The cabinet can run its video flipped (cocktail
 * table, player-two side); FLIP_SCREEN_FLAG (0x881f) holds that state. When the flag is set
 * (non-zero) the X is nudged by +6; when it is clear the X is nudged by -2. Biasing X by the
 * orientation keeps the collision box aligned with where the sprite actually draws once the
 * hardware has mirrored the screen.
 *
 * The Y test adds a fixed +8 margin (so the check triggers a little before the actor's top edge
 * literally reaches the edge) and compares against 0xe0, the bottom row of the visible field.
 * The result is a carry flag: set when the shifted Y is still ABOVE the limit (below 0xe0),
 * clear once it has reached or passed the bottom.
 *
 * A pure leaf: two record reads plus one flag read, and it writes nothing to memory.
 *
 * LIVE-OUT: three values handed back to a caller that reads them straight out of the machine
 * registers — [E = biased X, A = biased-and-margined Y, C = (Y < 0xe0), the off-screen gate].
 * The caller consults C first (skip the actor when it has dropped off the bottom) and then uses
 * A and E as the corrected coordinates.
 */
import { FLIP_SCREEN_FLAG } from "./names.js";

// X bias when the screen is upright (flag non-zero).
const UPRIGHT_BIAS = 0x06;
// X bias when the screen is flipped (flag clear): -2, held as 0xfe in the byte.
const FLIPPED_BIAS = 0xfe; // -2 in two's complement
// Fixed vertical margin added before the bottom test, so the gate fires slightly early.
const Y_MARGIN = 0x08;
// Bottom of the visible playfield; a shifted Y at or beyond this counts as off the bottom.
const BOTTOM_LIMIT = 0xe0;

export function precheckCollisionBounds(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Pick the X bias from the live screen orientation: FLIP_SCREEN_FLAG (0x881f) non-zero picks
  // the upright bias (+6), zero picks the flipped bias (-2).
  const bias = mem8[FLIP_SCREEN_FLAG] !== 0 ? UPRIGHT_BIAS : FLIPPED_BIAS;

  // Biased X: actor record +0x00 plus the orientation bias, kept to a byte (8-bit wrap).
  const e = (mem8[rec + 0x00] + bias) & 0xff;

  // Margined Y: actor record +0x02 plus the fixed +8 margin, kept to a byte.
  const a = (mem8[rec + 0x02] + Y_MARGIN) & 0xff;

  // Off-screen gate: carry is set while the shifted Y is still above the bottom limit (0xe0),
  // i.e. the actor has not yet dropped off the bottom of the field.
  const carry = a < BOTTOM_LIMIT;

  return [m.regs.e = e, m.regs.a = a, m.regs.fC = carry];
}
