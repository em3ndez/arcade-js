// SPDX-License-Identifier: GPL-3.0-only
/**
 * startBarrelDescentAtLadder — grade a barrel against difficulty, Mario's column and the
 * ladder table and, on a pass, stamp its descent target and start it down the ladder.
 *
 * The caller hands over a search key, a discriminator, and a scan count in registers. This
 * routine looks the key up in the ladder-endpoint table; a table miss unwinds on the caller's
 * behalf, and a lookup that comes back tagged 0 rather than 1 is rejected without touching
 * anything. A tag-1 hit ALWAYS stamps the record's descent-target field with (paired slot −
 * 5), then runs a chain of gates that decide whether the barrel ALSO starts moving — bump its
 * step field, set its moving bit:
 *
 *   - A clear spawn-mode gate byte starts it immediately.
 *   - Otherwise: reject unless Mario has descended far enough that (his Y − 4) reaches the
 *     discriminator; then reject unless a difficulty-weighted random throttle passes — the
 *     low two random bits under (difficulty/2 + 1).
 *   - Then, by Mario's column against the key: exactly on it starts; past it starts if Left
 *     is held; before it starts if Right is held; failing the input test, a final random gate
 *     decides.
 *
 * The record fields are indexed off the object pointer the caller set up, so their absolute
 * addresses are runtime-dependent and stay as computed offsets.
 *
 * The name says START, not "steer": this routine stamps the destination and decides whether
 * to begin the descent. The walking itself — one row per frame until the barrel's Y reaches
 * the stamp — happens elsewhere.
 *
 * LIVE-OUT: memory-only — the three record fields.
 */

import { u8 } from "../../../core/int.js";
import { findOppositeLadderEnd } from "./findOppositeLadderEnd.js";
import { MARIO_X, MARIO_Y, DIFFICULTY, RANDOM, P1_INPUT } from "./names.js";

// Multiplexed engine-scratch gate. It carries no shared name because different routines read
// it for different roles — a velocity-mode latch in one, this spawn/movement gate here — so no
// single name would be true of both. CLEAR takes the short start path; SET routes through the
// difficulty/position/input grading below.
const SPAWN_MODE_GATE = 0x6348;

export function startBarrelDescentAtLadder(m) {
  const { regs, mem } = m;
  const rec = (off) => (regs.ix + off) & 0xffff; // a field of the object record the caller pointed at

  // Look up the key in the ladder-endpoint table; a miss unwinds on the caller's behalf, so
  // bail the same way.
  if (!findOppositeLadderEnd(m)) return;

  // The lookup tags a hit 1 (the discriminator matched the near slot) or 0 (the far slot).
  // Only a tag-1 hit is processed; a tag-0 hit returns without touching the record.
  if (regs.a !== 1) return;

  const slotByte = regs.b; // the paired slot byte the lookup handed back
  const disc = regs.d;     // the discriminator, passed through unchanged
  const key = regs.e;      // the search key, echoed back

  // Every tag-1 hit stamps the descent target, before any grading gate decides on starting.
  mem.write8(rec(0x17), u8(slotByte - 5));

  // A clear spawn-mode gate starts the descent immediately.
  if (mem.read8(SPAWN_MODE_GATE) === 0) return advanceRecord(m, rec);

  // Vertical gate: skip unless Mario has descended so that (his Y − 4) reaches the
  // discriminator threshold.
  if (u8(mem.read8(MARIO_Y) - 4) < disc) return;

  // Difficulty-weighted random throttle: start only when the low two random bits fall
  // under (difficulty/2 + 1); a higher draw rejects this attempt.
  const rng = mem.read8(RANDOM);
  const throttle = (mem.read8(DIFFICULTY) >> 1) + 1;
  if ((rng & 0x03) >= throttle) return;

  // Horizontal gate, keyed on Mario's column vs the object's.
  const marioX = mem.read8(MARIO_X);
  if (marioX === key) return advanceRecord(m, rec); // right on the column
  const input = mem.read8(P1_INPUT);
  if (marioX > key) {
    // Past the column: holding Left (toward it) starts it, else the random tail decides.
    if ((input & 0x02) !== 0) return advanceRecord(m, rec);
    return randomTailGate(m, rec, rng);
  }
  // Before the column: holding Right (toward it) starts it, else the random tail decides.
  if ((input & 0x01) !== 0) return advanceRecord(m, rec);
  return randomTailGate(m, rec, rng);
}

// The random tail: a nonzero (random & 0x18) rejects; otherwise the barrel starts.
function randomTailGate(m, rec, rng) {
  if ((rng & 0x18) !== 0) return;
  advanceRecord(m, rec);
}

// Start the descent: bump the record's step field and set its moving bit.
function advanceRecord(m, rec) {
  const { mem } = m;
  mem.write8(rec(0x07), mem.read8(rec(0x07)) + 1);
  mem.write8(rec(0x02), mem.read8(rec(0x02)) | 0x01);
}
