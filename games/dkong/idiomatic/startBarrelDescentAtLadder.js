// SPDX-License-Identifier: GPL-3.0-only
/**
 * startBarrelDescentAtLadder — grade a barrel against difficulty, Mario's column and the
 * ladder-endpoint table; on a pass, stamp its descent target and start it down the ladder.
 * Key, discriminator and scan count arrive in registers. A table miss or a tag-0 hit returns
 * untouched; a tag-1 hit always stamps the descent-target field, then a chain of spawn-mode,
 * vertical, difficulty-random and Mario-column/input gates decides whether it also starts moving.
 *
 * LIVE-OUT: memory-only — the three record fields.
 */

import { u8 } from "../../../core/int.js";
import { findOppositeLadderEnd } from "./findOppositeLadderEnd.js";
import { MARIO_X, MARIO_Y, DIFFICULTY, RANDOM, P1_INPUT } from "./names.js";

// Multiplexed engine-scratch gate: clear = start immediately; set = run the grading below.
const SPAWN_MODE_GATE = 0x6348;

export function startBarrelDescentAtLadder(m, disc = m.regs.d, ix = m.regs.ix) {
  const { regs, mem8 } = m;
  const rec = (off) => (ix + off) & 0xffff; // a field of the object record the caller pointed at

  if (!findOppositeLadderEnd(m)) return;

  // Lookup tags a hit 1 (near slot) or 0 (far slot); only tag-1 is processed.
  if (regs.a !== 1) return;

  const slotByte = regs.b; // the paired slot byte the lookup handed back
  const key = regs.e;      // the search key, echoed back

  // Stamp the descent target on every tag-1 hit, before the grading gates.
  mem8[rec(0x17)] = u8(slotByte - 5);

  if (mem8[SPAWN_MODE_GATE] === 0) return advanceRecord(m, rec);

  if (u8(mem8[MARIO_Y] - 4) < disc) return;

  const rng = mem8[RANDOM];
  const throttle = (mem8[DIFFICULTY] >> 1) + 1;
  if ((rng & 0x03) >= throttle) return;

  const marioX = mem8[MARIO_X];
  if (marioX === key) return advanceRecord(m, rec); // right on the column
  const input = mem8[P1_INPUT];
  if (marioX > key) {
    // Past the column: Left (toward it) starts it, else the random tail decides.
    if ((input & 0x02) !== 0) return advanceRecord(m, rec);
    return randomTailGate(m, rec, rng);
  }
  // Before the column: Right (toward it) starts it, else the random tail decides.
  if ((input & 0x01) !== 0) return advanceRecord(m, rec);
  return randomTailGate(m, rec, rng);
}

// Nonzero (random & 0x18) rejects; otherwise start.
function randomTailGate(m, rec, rng) {
  if ((rng & 0x18) !== 0) return;
  advanceRecord(m, rec);
}

// Bump the record's step field and set its moving bit.
function advanceRecord(m, rec) {
  const { mem8 } = m;
  mem8[rec(0x07)] = mem8[rec(0x07)] + 1;
  mem8[rec(0x02)] = mem8[rec(0x02)] | 0x01;
}
