// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { POKEY2_RANDOM } from "./names.js";

/**
 * drawSignedVelocityNudge — produce a signed random velocity nudge. ROM 0xa69b.
 *
 * Role in the machine: when the game spawns a new enemy into a tube slot it needs a small
 * random sideways drift for each of the enemy's motion components. This is the seed generator
 * for that drift: a fresh random magnitude of at most 7, with its sign chosen from a caller-
 * supplied bit. spawnEnemyInSlot (0xa65b) calls it three times to seed the enemy's per-axis
 * velocity nudges (loc_323/343/363,x), then forces the middle one non-positive.
 *
 * Behavior: read POKEY2's free-running random register and keep the low three bits, a magnitude
 * in 0..7. If the incoming accumulator value has bit 0 set, two's-complement negate the magnitude
 * (u8) so the step points the other way; otherwise leave it positive. The result is written back
 * into the accumulator, so the value lands in the range [-7, +7].
 *
 * Live-out: m.regs.a holds the signed nudge (the sole result; no memory cell is written).
 * Grounding: [seen]
 */
export function drawSignedVelocityNudge(m, a = m.regs.a) {
  const { mem8 } = m;
  const negate = a & 0x01;                 // caller's bit 0 selects the sign
  let out = mem8[POKEY2_RANDOM] & 0x07;     // fresh 3-bit random magnitude, 0..7
  if (negate) out = u8(-out);               // two's-complement flip → negative step
  return (m.regs.a = out);                  // signed nudge in [-7, +7]
}
