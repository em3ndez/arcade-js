// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveSoundVoicesFromOccupancy — the marching-formation hum, driven straight off enemy count.
 *
 * WHAT IT IS
 *   An effect produced not by the sound driver but directly from the gameplay-frame pipeline: a hum whose
 *   "thickness" tracks how many attackers are still standing in the formation. It writes its own sound
 *   hardware latches rather than composing into the shared shadows.
 *
 * ROLE IN THE MACHINE
 *   Runs only on even frames (bit 0 of the frame flag loc_4007 clear). It folds the six-by-ten flag grid
 *   OCCUPANCY_GRID (0x4123, rows 16 bytes apart) into an 8-bit tally seeded at 1, then lights the three
 *   voice-0..2 write latches SOUND_W_REG0..2 (0x6800-0x6802) one at a time — stopping the instant the
 *   running tally drains to zero, so the number of lit latches (capped at three) rises with how full the
 *   block still is — and zeros every latch past the stopping point. As the formation empties the hum
 *   thins. It also raises the near-empty flag loc_4224 (consumed downstream by expireActivityGatedTimer)
 *   once the tally has all but run out.
 *
 * ROM 0x16b8.  Grounding: [seen].
 *
 * LIVE-OUT: SOUND_W_REG0..2 lit/cleared; loc_4224 set to the near-empty flag.
 */
import { loc_4007, OCCUPANCY_GRID, loc_4224, SOUND_W_REG0, SOUND_W_REG1, SOUND_W_REG2 } from "./names.js";

// occupancy grid: 6 rows of 10 cols, rows spaced 16 bytes apart
const ROWS = 6, COLS = 10, ROW_STRIDE = 16;

export function driveSoundVoicesFromOccupancy(m) {
  const { mem8 } = m;

  // Act only on even frames (bit 0 of the frame flag clear); the effect updates at half frame rate.
  if (mem8[loc_4007] & 0x01) return;

  // Sum the whole occupancy grid into an 8-bit wrapping tally, seeded at 1. Each set cell is one live
  // attacker's contribution, so a fuller formation yields a larger tally.
  let tally = 1;
  for (let row = 0; row < ROWS; row++) {
    const base = OCCUPANCY_GRID + row * ROW_STRIDE;
    for (let col = 0; col < COLS; col++) tally = (tally + mem8[base + col]) & 0xff;
  }

  // Light one latch per unit of tally, stopping the instant it drains to zero (so at most three latches,
  // fewer as the formation empties). Predecrement mirrors the Z80's "dec then test" loop.
  const latch = [SOUND_W_REG0, SOUND_W_REG1, SOUND_W_REG2];
  let i = 0;
  for (; i < latch.length; i++) {
    tally = (tally - 1) & 0xff;
    if (tally === 0) break;
    mem8[latch[i]] = 1;
  }
  // Silence every latch from the stopping point onward.
  for (; i < latch.length; i++) mem8[latch[i]] = 0;

  // Near-empty flag: raised once the tally has (nearly) run dry, so downstream timers know the field is
  // almost cleared.
  mem8[loc_4224] = tally < 2 ? 1 : 0;
}
