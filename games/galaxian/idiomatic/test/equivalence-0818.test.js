// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0818 — crafted-entry equivalence vs the frozen state-handler at ROM 0x0818.
 * On the timer's expiry it resets the sequence/player cells, sets the next game state, packs the flag-bit
 * snapshot (dissolved packFlagBytesToBitmask), and copies the 8-byte companion block right after it — all
 * work-RAM writes, so ramDiff covers the live-out fully. Two paths: EXPIRY (timer 1 -> 0, full snapshot)
 * and COUNTING (timer 5 -> 4, everything else untouched). Teeth: no-op, dec-only (expiry work skipped),
 * scribble (ramDiff teeth), and a run-while-counting twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { saveFlagsToSnapshotAndSwitchPlayerState as cand } from "../saveFlagsToSnapshotAndSwitchPlayerState.js";
import { loc_0818 as oracle } from "../../translated/loc_0818.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const DWELL_TIMER = 0x4009;
const SEQUENCE_STATE = 0x400a;
const CURRENT_PLAYER = 0x400d;
const GAME_STATE = 0x4005;
const COMPANION_DST = 0x41b0; // snapshot base + 16
const COMPANION_SRC = 0x4218;
const SCRATCH = 0x4190; // untouched by the routine

// Expiry: timer at 1 -> dec to 0 -> full snapshot. Companion source carries a known pattern.
const expire = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[DWELL_TIMER] = 1;
  for (let i = 0; i < 8; i++) mem[COMPANION_SRC + i] = 0xa1 + i;
});
// Still counting: timer at 5 -> dec to 4 -> ret with nothing else touched.
const counting = () => craft((mem, mm) => { mm.push16(0x9999); mem[DWELL_TIMER] = 5; });

test("EQUAL (crafted): loc_0818 == oracle on the expiry path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expire()), null, "loc_0818 diverged on expiry");
  const a = expire(); oracle(a);
  assert.equal(a.mem8[DWELL_TIMER], 0, "positive control: timer decremented to 0");
  assert.equal(a.mem8[GAME_STATE], 3, "positive control: next game state selected");
  assert.equal(a.mem8[SEQUENCE_STATE], 0, "positive control: sequence state cleared");
  assert.equal(a.mem8[CURRENT_PLAYER], 0, "positive control: player cleared");
  for (let i = 0; i < 8; i++)
    assert.equal(a.mem8[COMPANION_DST + i], 0xa1 + i, `positive control: companion byte ${i} copied`);
  console.log("  EQUAL: loc_0818 == oracle (RAM), snapshot + companion copied on expiry");
});

test("EQUAL (crafted): loc_0818 == oracle while the timer is still counting", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, counting()), null, "loc_0818 diverged while counting");
  const seedState = counting().mem8[GAME_STATE];
  const a = counting(); oracle(a);
  assert.equal(a.mem8[DWELL_TIMER], 4, "positive control: timer decremented");
  assert.equal(a.mem8[GAME_STATE], seedState, "positive control: game state untouched while counting");
  console.log("  EQUAL: loc_0818 == oracle (RAM), counting -> only the timer ticks");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const decOnly = (m) => { m.mem8[DWELL_TIMER] = (m.mem8[DWELL_TIMER] - 1) & 0xff; };
  const scribble = (m) => { cand(m); m.mem8[SCRATCH] ^= 0xff; };
  const runWhileCounting = (m) => { m.mem8[GAME_STATE] = 3; };
  assert.ok(ramDiff(oracle, noOp, expire()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, decOnly, expire()), "dec-only twin escaped (expiry work skipped)");
  assert.ok(ramDiff(oracle, scribble, expire()), "scribble twin escaped (ramDiff teeth)");
  assert.ok(ramDiff(oracle, runWhileCounting, counting()), "run-while-counting twin escaped");
  console.log("  TEETH: no-op, dec-only, scribble, run-while-counting all caught");
});
