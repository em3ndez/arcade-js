// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { WAVE_RECORD_COUNT, WAVE_HOLD_TIMER } from "./names.js";
/**
 * despawnEagleAndSeedHoldOnWaveEmpty — the eagle bonus-wave record's terminal state (state 2, "retire").
 *
 * WHAT IT IS
 * ----------
 * The bonus stage flies a small wave of eagles at the player. Each eagle is tracked by one
 * fixed-size record in the enemy actor table, and the record walks through a three-state life
 * every frame: state 0 flies the eagle in to its grid slot and tallies its arrival, state 1
 * integrates its dive-or-climb until it reaches the bottom or top row, and state 2 — this routine
 * — tears the record down for good. By the time a record reaches state 2 its eagle is spent and off
 * the screen, so the only work left is to blank the record and to notice whether the wave it
 * belonged to has just emptied out.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is the terminal one of the three per-record handlers the eagle-record dispatcher selects on
 * the record's state byte. After it runs the record is gone, and the live-record count that bounds
 * the wave's per-frame record walk is one lower. When that count crosses to zero the whole wave has
 * retired — and this routine then primes the timed pause that separates one eagle wave from the
 * next, which is what lets the idle handler and the approach machine take over until the next wave
 * is seeded.
 *
 * ROM 0x73ce.  Grounding: [seen].
 *
 * LIVE-OUT: none — this is a dispatch target reached on a record's state byte, and its exit
 * registers are not read back by whatever invoked it. Its lasting effects are entirely the writes
 * it leaves in memory: the zero-filled record, the decremented live-record count at
 * WAVE_RECORD_COUNT (0x8f3c), and — only on the frame that empties the wave — the reseeded
 * countdown at WAVE_HOLD_TIMER (0x8f36).
 */

// Retiring an eagle means wiping every byte of its record so the slot reads inactive and is free
// to be reseeded by a later wave; the eagle record is a uniform 0x18-byte block and is cleared to
// all-zero. INTER_WAVE_HOLD is the number of frames the between-waves pause runs for.
const RECORD_LEN = 0x18; //     the eagle record is 0x18 bytes
const RECORD_FILL = 0x00; //    cleared to zero
const INTER_WAVE_HOLD = 0x30; // reseed value for the hold countdown

export function despawnEagleAndSeedHoldOnWaveEmpty(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — blank the retiring eagle's record. `rec` points at the head of this eagle's 0x18-byte
  // slot in the enemy actor table (ENEMY_ACTOR_TABLE, 0x8ae0). Zero-filling the whole record clears
  // its active flag, coordinates, speed and state fields in one sweep, so nothing downstream will
  // ever treat the slot as a live eagle again.
  fillByteRun(m, rec, RECORD_FILL, RECORD_LEN);

  // Step 2 — count this record out of the wave. WAVE_RECORD_COUNT (0x8f3c) is the number of eagle
  // records the per-frame driver still walks this wave (two per wave index); dropping one eagle
  // drops that tally by one. It is a plain memory byte, and this is the ROM's `dec (hl)`.
  mem8[WAVE_RECORD_COUNT] = mem8[WAVE_RECORD_COUNT] - 1;

  // If the count is still nonzero, other eagles of this wave are alive — the wave is not finished,
  // so leave the hold timer untouched and return, exactly as the ROM's `ret nz` does.
  if (mem8[WAVE_RECORD_COUNT] !== 0) return;

  // Step 3 — the wave just emptied (this record held its last eagle). Seed the inter-wave hold countdown
  // WAVE_HOLD_TIMER (0x8f36) to 0x30 frames. The idle handler drains this toward zero one step per
  // frame; while it is running it gates the eagle approach machine and blocks the next wave from
  // being seeded, so this single write is what imposes the pause between one eagle wave and the next.
  mem8[WAVE_HOLD_TIMER] = INTER_WAVE_HOLD;
}
