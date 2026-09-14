// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, loc_2a, loc_2b, VELOCITY_DECAY_STEP } from "./names.js";

/**
 * stepVelocityTowardZero — decay one signed 16-bit velocity component one step toward zero. ROM 0xa75d.
 *
 * Role in the machine: when a Tempest enemy is in free flight (e.g. a flipper knocked loose, or a shot
 * flung off the rim), its per-axis velocity has to bleed off so the object drifts to a halt instead of
 * coasting forever. The velocity is a signed 16-bit value carried as whole:low in the accumulator/Y
 * register pair; this routine nudges it one fixed increment closer to zero and reports when it has
 * saturated (reached/overshot zero). decayEnemyFreeFlightVelocity ($a721) calls it once per axis and
 * clears the object's coordinate only when all axes saturate the same frame.
 *
 * Behavior: stash the incoming whole byte into loc_2b ($002b). The step magnitude is a fixed ROM constant
 * VELOCITY_DECAY_STEP ($a788 = 0x20). If the velocity is negative (whole's sign bit set) add the step and
 * carry up into whole, treating a whole-byte overflow past 0xff as the zero crossing; otherwise subtract
 * the step, borrow from whole, and treat whole going below 0 as the crossing. Write the new low byte to
 * loc_2a ($002a). On a crossing, snap the whole 16-bit value to zero (loc_2a = 0, low = whole = 0) and
 * bump the saturation counter loc_29 ($0029) so the caller can tally how many axes finished.
 *
 * Live-out: loc_2b (input whole snapshot), loc_2a (new low byte, forced to 0 on saturation), loc_29
 * (saturation counter, incremented on a crossing), and the returned [low, whole] (also written back to
 * m.regs.a / m.regs.y). Grounding: [seen].
 */
export function stepVelocityTowardZero(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_2b] = y; // snapshot the incoming whole byte
  const step = mem8[VELOCITY_DECAY_STEP]; // fixed 0x20 decay increment

  let low, whole, crossed;
  if (y & 0x80) {
    // Negative velocity: add the step, carrying up; overflow past 0xff is the zero crossing.
    low = a + step;
    whole = y + (low > 0xff ? 1 : 0);
    crossed = whole > 0xff;
  } else {
    // Non-negative velocity: subtract the step, borrowing down; going below 0 is the zero crossing.
    low = a - step;
    whole = y - (low < 0 ? 1 : 0);
    crossed = whole < 0;
  }
  mem8[loc_2a] = low; // publish the stepped low byte

  if (crossed) {
    mem8[loc_29] = mem8[loc_29] + 1; // count this axis as saturated
    mem8[loc_2a] = 0; // snap the whole 16-bit value to zero
    low = 0;
    whole = 0;
  }
  return [(m.regs.a = low & 0xff), (m.regs.y = whole & 0xff)]; // return [low, whole], mirrored into regs
}
