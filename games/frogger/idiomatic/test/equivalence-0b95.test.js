// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeScoreField — memory-equivalent to the frozen oracle at ROM 0x0B95.
 * GATE: captured-entry + crafted sweep. Attract redraws the score header through this field writer,
 * so real dispatches are captured at 0x0B95 and replayed on fresh clones of each; the writePackedBcdWord
 * and writeScoreDigitStepUp callees run identically on both sides, so their memory effect is part of the
 * compared live-out. The rewrite dissolves the oracle's m.call(0x0b9b) and tail m.call(0x0ba9) into direct
 * calls, so the oracle's push16 return-brackets no longer land on the stack; the dead [SP-8, SP) window is
 * masked. Live-out is memory-only (no caller consumes a register after the call), so RAM outside that window
 * is compared and SP is not. A crafted sweep pokes DE across every-nibble values on a real captured field
 * to widen digit coverage past attract's few. Teeth: no-op (redraw suppressed), wrong-trailer (writes 1 not
 * 0 in the trailing cell), skip-trailer (omits the trailing zero, so a dirtied cell survives).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { writeScoreField } from "../writeScoreField.js";
import { writePackedBcdWord } from "../writePackedBcdWord.js";
import { writeScoreDigitStepUp } from "../writeScoreDigitStepUp.js";
import { loc_0b95 as oracle } from "../../translated/loc_0b95.js";

const TARGET = 0x0b95;
const CAP = 300;
const ROW_UP = 32;
const FIELD_ROWS = 4;
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
  assert.ok(entries.length > 0, "vacuous: 0x0b95 was never dispatched, no state to replay");
  captured = entries;
  return captured;
}

// The trailing-zero cell: the field pointer stepped up four rows past its entry position.
function trailerCell(machine) {
  return (machine.regs.hl - FIELD_ROWS * ROW_UP) & 0xffff;
}

// null == equivalent. Memory-only live-out, masking the dead [SP-8, SP) stack scratch left by the
// oracle's dissolved return-brackets. Compare RAM outside that window; SP is not part of the contract.
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
  return null;
}

// broken twins.
function brokenNoOp() {}
function brokenWrongTrailer(m) {
  writePackedBcdWord(m);
  return writeScoreDigitStepUp(m, 1); // BUG: the trailing digit must be 0
}
function brokenSkipTrailer(m) {
  return writePackedBcdWord(m); // BUG: omits the trailing zero digit
}

test("REAL: oracle == rewrite on every captured 0x0b95 dispatch", { skip }, () => {
  const entries = captureEntries();
  for (const e of entries) assert.equal(diff(writeScoreField, e), null, "a captured machine diverged");
  console.log(`  REAL: ${entries.length} captured dispatches, oracle == rewrite (memory-only)`);
});

test("CRAFTED: oracle == rewrite across every-nibble DE on a real field", { skip }, () => {
  const base = captureEntries()[0];
  const values = [0x0000, 0x1234, 0x5678, 0x9abc, 0xdef0, 0x9999, 0xffff];
  for (const de of values) {
    const e = base.clone();
    e.regs.de = de;
    assert.equal(diff(writeScoreField, e), null, `crafted DE=0x${de.toString(16)} diverged`);
  }
  console.log(`  CRAFTED: ${values.length} DE values, oracle == rewrite (memory-only)`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = captureEntries()[0].clone();
  e.regs.de = 0x1234; // differ from the displayed score so a suppressed redraw is observable
  e.mem8[trailerCell(e)] = 9; // dirty the trailing cell so omitting its zero is observable
  assert.ok(diff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(diff(brokenWrongTrailer, e), "the wrong-trailer twin escaped");
  assert.ok(diff(brokenSkipTrailer, e), "the skip-trailer twin escaped");
  console.log("  TEETH: no-op, wrong-trailer, skip-trailer all caught");
});
