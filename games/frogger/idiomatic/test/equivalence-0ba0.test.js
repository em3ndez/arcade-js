// SPDX-License-Identifier: GPL-3.0-only
/**
 * writePackedBcdByte — memory-equivalent to the frozen oracle at ROM 0x0BA0.
 * GATE: captured-entry. Attract prints scores and the credit count through this two-digit BCD writer,
 * so real dispatches are captured at 0x0BA0 and replayed on fresh clones of each — the two 0x0BA9
 * digit-writer calls run identically on both sides, so their memory effect is part of the compared
 * live-out. This is a non-leaf: live-out is memory + HL (the destination stepped up two rows for the
 * caller's next byte), so RAM (outside the dead [SP-8, SP) stack scratch) AND the H/L pair are compared,
 * not SP. Teeth: no-op, wrong-value, skip-the-second-digit.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { writePackedBcdByte } from "../writePackedBcdByte.js";
import { loc_0ba0 as oracle } from "../../translated/loc_0ba0.js";

const TARGET = 0x0ba0;
const DIGIT_WRITER = 0x0ba9;
const CAP = 300;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let captured = null;
function captureEntries() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(TARGET);
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.ok(entries.length > 0, "vacuous: 0x0ba0 was never dispatched, no state to replay");
  captured = entries;
  return captured;
}

// null == equivalent. Memory + HL live-out, masking the dead [SP-8, SP) stack scratch: the rewrite
// dissolves the two digit-writer calls into direct JS calls, so the oracle's push16 return-brackets
// no longer land on the stack. Compare RAM (outside that window) and the H/L pair, not SP.
function diff(cand, machine) {
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
  if (a.regs.h !== b.regs.h || a.regs.l !== b.regs.l) {
    return `HL 0x${((a.regs.h << 8) | a.regs.l).toString(16)} vs 0x${((b.regs.h << 8) | b.regs.l).toString(16)}`;
  }
  return null;
}

// broken twins.
function brokenNoOp() {}
function brokenWrongValue(m) {
  const { regs } = m;
  const packed = regs.a;
  regs.a = packed >> 4;
  m.push16(0x0ba8); m.call(DIGIT_WRITER);
  regs.a = (packed + 1) & 0xff; // BUG: corrupts the low digit
  return m.call(DIGIT_WRITER);
}
function brokenSkipSecond(m) {
  const { regs } = m;
  regs.a = regs.a >> 4;
  m.push16(0x0ba8); m.call(DIGIT_WRITER); // BUG: writes only the high digit, HL steps once not twice
}

test("REAL: oracle == rewrite on every captured 0x0ba0 dispatch", { skip }, () => {
  const entries = captureEntries();
  for (const e of entries) assert.equal(diff(writePackedBcdByte, e), null, "a captured machine diverged");
  console.log(`  REAL: ${entries.length} captured dispatches, oracle == rewrite (memory + HL)`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = captureEntries()[0];
  assert.ok(diff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(diff(brokenWrongValue, e), "the wrong-value twin escaped");
  assert.ok(diff(brokenSkipSecond, e), "the skip-second-digit twin escaped");
  console.log("  TEETH: no-op, wrong-value, skip-second-digit all caught");
});
