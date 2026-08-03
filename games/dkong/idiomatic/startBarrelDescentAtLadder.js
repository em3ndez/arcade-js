// SPDX-License-Identifier: GPL-3.0-only
/**
 * startBarrelDescentAtLadder — grade a barrel against difficulty, Mario's column and the ladder
 * table and, on a pass, stamp its descent target and start it down the ladder.  ROM 0x216D.
 *
 * The caller (loc_215f) hands over a search key, a discriminator, and a scan count in
 * registers. startBarrelDescentAtLadder looks the key up in the type-0 object table (findOppositeLadderEnd); a table
 * miss unwinds on the caller's behalf, and a lookup that comes back tagged 0 (rather than
 * 1) is rejected without touching anything. A tag-1 hit always stamps the record's +0x17
 * field with (paired-slot − 5), then runs a chain of gates that decide whether the object
 * ALSO advances (bump +0x07, set bit0 of +0x02):
 *
 *   - A clear spawn-mode gate byte (0x6348) advances immediately.
 *   - Otherwise: reject unless Mario has descended far enough that (his Y − 4) reaches the
 *     discriminator; then reject unless a difficulty-weighted random throttle passes
 *     (low two random bits under difficulty/2 + 1).
 *   - Then, by Mario's column vs the key: exactly on it advances; past it advances if
 *     Left is held; before it advances if Right is held; failing the input test, a final
 *     (random & 0x18)==0 gate decides.
 *
 * The record fields are indexed off the object pointer the caller set up, so their
 * absolute addresses are runtime-dependent and stay as computed offsets (no ram.js name).
 *
 * NAME — WHY "BARREL" AND WHY "LADDER". Both were blocked as ungrounded until the MAME run in
 * scratchpad/grounding-object-arrays.md, and both are now observed on the real ROM.
 *   BARREL: this routine's one caller is an arm of the BOARD==1 ten-record OBJ_ARRAY_67 walk,
 *   and zeroing that array's records collapses barrel motion 328 -> 29 while the fire is
 *   untouched; pinning their X parks every barrel at the commanded column and moves nothing
 *   else — a working positive control.
 *   LADDER: the table this routine keys on through findOppositeLadderEnd holds the kind-0/1
 *   records, and suppressing ROM 0x0E19 — the routine that draws exactly those records —
 *   removes 616 px from the screen and they are the LADDERS (the two full-height ladders beside
 *   Kong plus eight shorter segments); not one girder pixel changes.
 * The name says START, not "steer": this routine stamps the destination and decides whether to
 * begin the descent; loc_1fac does the walking, one row per frame, until OBJ_Y equals the stamp.
 *
 * Memory-equivalent to the frozen oracle — equivalence-216d.test.js.
 * GATE:     capture/clone/replay of real attract dispatches (0x216D fires ~600×/4000
 *           frames, spanning the clear/set spawn-gate arms and the advance path) plus
 *           crafted entries that plant a controlled table + pokes to drive every gate:
 *           the table miss, the tag-0 reject, the clear-gate advance, the Y reject, the
 *           throttle reject, on-column advance, both held-input advances, and the
 *           random-0x18 tail (advance and reject). The RAM diff excludes the dead
 *           STACK_SCRATCH the oracle's push/call/ret churn writes. Teeth: a twin with the
 *           wrong stamp value and a twin that skips the grading gates.
 * LIVE-OUT: memory-only. The sole caller's tail (loc_21ba) swaps the register bank and
 *           overwrites the accumulator before reading anything, so every register/flag
 *           this routine leaves is dead; the oracle's `ret`/double-unwind stack effects
 *           are dead scratch. findOppositeLadderEnd's miss/hit is consumed here as the early return.
 * NAMES:    MARIO_X, MARIO_Y, DIFFICULTY, RANDOM, P1_INPUT from ram.js; findOppositeLadderEnd
 *           direct-called. 0x6348 stays hex (ram.js keeps it unnamed — a multiplexed
 *           engine-scratch gate), kept as a local const here.
 */

import { u8 } from "../../../core/int.js";
import { findOppositeLadderEnd } from "./findOppositeLadderEnd.js";
import { MARIO_X, MARIO_Y, DIFFICULTY, RANDOM, P1_INPUT } from "./ram.js";

// Multiplexed engine-scratch gate. ram.js does NOT name 0x6348 — verified, it has no export —
// because the cell is read for DIFFERENT roles by different routines (a velocity-mode latch in
// loc_22cb, this spawn/movement gate here), so no single name would be true of both. CLEAR here
// takes the short advance path; SET routes through the difficulty/position/input grading below.
const SPAWN_MODE_GATE = 0x6348;

export function startBarrelDescentAtLadder(m) {
  const { regs, mem } = m;
  const rec = (off) => (regs.ix + off) & 0xffff; // a field of the object record the caller pointed at

  // Look up the key in the type-0 table; a miss unwinds on the caller's behalf (the
  // oracle's double return), so bail the same way.
  if (!findOppositeLadderEnd(m)) return;

  // findOppositeLadderEnd tags a hit 1 (discriminator matched the near slot) or 0 (the far slot). Only
  // a tag-1 hit is processed; a tag-0 hit returns without touching the record.
  if (regs.a !== 1) return;

  const slotByte = regs.b; // the paired slot byte findOppositeLadderEnd handed back
  const disc = regs.d;     // the discriminator, passed through unchanged
  const key = regs.e;      // the search key, echoed back

  // Every tag-1 hit stamps field +0x17, before any grading gate decides on advancing.
  mem.write8(rec(0x17), u8(slotByte - 5));

  // A clear spawn-mode gate advances immediately.
  if (mem.read8(SPAWN_MODE_GATE) === 0) return advanceRecord(m, rec);

  // Vertical gate: skip unless Mario has descended so that (his Y − 4) reaches the
  // discriminator threshold.
  if (u8(mem.read8(MARIO_Y) - 4) < disc) return;

  // Difficulty-weighted random throttle: advance only when the low two random bits fall
  // under (difficulty/2 + 1); a higher draw rejects this attempt.
  const rng = mem.read8(RANDOM);
  const throttle = (mem.read8(DIFFICULTY) >> 1) + 1;
  if ((rng & 0x03) >= throttle) return;

  // Horizontal gate, keyed on Mario's column vs the object's.
  const marioX = mem.read8(MARIO_X);
  if (marioX === key) return advanceRecord(m, rec); // right on the column
  const input = mem.read8(P1_INPUT);
  if (marioX > key) {
    // Past the column: holding Left (toward it) advances, else the random tail decides.
    if ((input & 0x02) !== 0) return advanceRecord(m, rec);
    return randomTailGate(m, rec, rng);
  }
  // Before the column: holding Right (toward it) advances, else the random tail decides.
  if ((input & 0x01) !== 0) return advanceRecord(m, rec);
  return randomTailGate(m, rec, rng);
}

// The random tail (ROM 0x21AE): a nonzero (random & 0x18) rejects; otherwise the object
// advances.
function randomTailGate(m, rec, rng) {
  if ((rng & 0x18) !== 0) return;
  advanceRecord(m, rec);
}

// The advance stamp (ROM 0x21B2): bump record field +0x07 and set bit0 of field +0x02.
function advanceRecord(m, rec) {
  const { mem } = m;
  mem.write8(rec(0x07), mem.read8(rec(0x07)) + 1);
  mem.write8(rec(0x02), mem.read8(rec(0x02)) | 0x01);
}
