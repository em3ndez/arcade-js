// SPDX-License-Identifier: GPL-3.0-only
/**
 * placeScoreRankMarkers — memory-equivalent to the frozen oracle at ROM 0x0C3D.
 * GATE: crafted-entry (probe: 0 over ENTRY_FRAMES). A post-boot clone has the digit-pair source
 * (0x83FB/0x83FC) poked to drive both-drawn, either-zero (draws nothing), and both-zero. It calls the
 * row-draw helper twice on a fresh clone per side, so the real callee runs identically and its writes
 * are the compared live-out. Memory-only live-out; the rewrite dissolves the two row-draw calls into
 * direct JS calls, so their push16 return-continuations no longer land on the stack — the dead
 * [SP-8, SP) scratch is masked and the rest of RAM is compared (SP/pc are not compared). Teeth: two
 * RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { placeScoreRankMarkers } from "../placeScoreRankMarkers.js";
import { loc_0c3d as oracle } from "../../translated/loc_0c3d.js";

const DIGIT_LOW = 0x83fb, DIGIT_HIGH = 0x83fc;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A post-boot machine with a specific digit pair; a valid entry, placeScoreRankMarkers reads it from RAM.
function entryWithDigits(low, high) {
  const e = seedMachine().clone();
  e.mem8[DIGIT_LOW] = low;
  e.mem8[DIGIT_HIGH] = high;
  return e;
}

// null == RAM-equivalent, masking the dead [SP-8, SP) stack scratch the dissolved row-draw calls'
// return-continuations no longer write. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const lo = (machine.regs.sp - 8) & 0xffff;
  const hi = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const A = a.dumpState(), B = b.dumpState();
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (A[i] === B[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= lo && addr < hi) continue; // dead stack scratch
    return `0x${(addr ?? 0).toString(16)}: ${A[i]} vs ${B[i]}`;
  }
  return null;
}

const PAIRS = [[5, 7], [0, 7], [5, 0], [0, 0], [1, 0x2f]]; // both drawn, low-zero, high-zero, both-zero, wrap

const DRAW = 0x0c4a;
// broken twins, each leaving wrong RAM the diff must catch (both-digits-drawn entry).
function brokenNoOp() {}
function brokenSkipPass2(m) {
  const { regs, mem16 } = m;
  regs.h = 0x80; regs.bc = mem16[DIGIT_LOW]; regs.d = 0x30; regs.e = 4;
  m.push16(0x0c49); m.call(DRAW); // BUG: omits the high-digit pass
}

test("EQUAL (crafted): placeScoreRankMarkers == oracle on every digit pair", { skip }, () => {
  const entries = PAIRS.map(([lo, hi]) => entryWithDigits(lo, hi));
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(placeScoreRankMarkers, e), null, "a crafted digit pair diverged");
  // non-vacuous: the no-op twin diverging proves the oracle writes on the both-drawn entry.
  assert.ok(ramDiff(brokenNoOp, entryWithDigits(5, 7)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted digit pairs, placeScoreRankMarkers == oracle`);
});

test("TEETH: broken twins are caught on the both-digits-drawn entry", { skip }, () => {
  const e = entryWithDigits(5, 7);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenSkipPass2, e), "the skip-pass-2 twin escaped");
  console.log("  TEETH: no-op, skip-pass-2 all caught");
});
