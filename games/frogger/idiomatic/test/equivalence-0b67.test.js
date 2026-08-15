// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderCreditLine — memory+HL+DE-equivalent to the frozen oracle at ROM 0x0B67.
 * GATE: captured-entry + crafted sweep. Attract redraws the credit line thousands of times, so real
 * dispatches are captured and replayed on fresh clones. Attract exercises the first-time clear path
 * (init flag still 0) exactly once — the first dispatch — and always with a zero credit count, so a
 * crafted sweep pokes the init flag back to 0 (re-arming the column clear on a dirtied column) and
 * pokes the credit count across packed-BCD values to widen digit coverage. The rewrite dissolves the
 * oracle's rst-0x28 label copy (m.push16 + m.call 0x0028) and its tail m.call(0x0ba0) BCD print into
 * direct calls, so the oracle's push16 return-brackets no longer land on the stack; the dead
 * [SP-8, SP) window is masked. Those callees run identically on both sides, so their memory effect is
 * part of the compared live-out. Live-out is memory plus HL and DE — the pointers the label copy and
 * BCD print leave advanced (A is NOT compared: the idiomatic digit writer leaves A un-masked, and B is
 * NOT compared: the idiomatic column copy does not reproduce it — neither is a caller-consumed
 * contract). Teeth: no-init (skips the one-time clear+latch), no-label (drops the CREDIT label copy),
 * off-by-one (clears one column cell short), wrong-abi-len (copies the label one byte short),
 * wrong-count-dst (prints the digits at the wrong cell), stale-HL (correct RAM, HL not advanced). A
 * surviving-push16 twin is asserted BLIND: the masked stack tolerates it by design — that live-return
 * corruption is the live/pixel gate's catch, not this memory gate's.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { renderCreditLine } from "../renderCreditLine.js";
import { copyRunUpTileColumn } from "../copyRunUpTileColumn.js";
import { writePackedBcdByte } from "../writePackedBcdByte.js";
import { loc_0b67 as oracle } from "../../translated/loc_0b67.js";

const TARGET = 0x0b67;
const CAP = 300;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const INIT_FLAG = 0x83b4;
const COLUMN_TOP = 0xa81f;
const CLEAR_TILE = 0x10;
const COLUMN_CELLS = 0x20;
const ROW_STEP = 0x0020;
const LABEL_DST = 0xa97f;
const LABEL_SRC = 0x2f68;
const LABEL_LEN = 0x06;
const DISPLAY_FLAG = 0x803f;
const CREDIT_COUNT = 0x83e1;
const COUNT_DST = 0xa89f;

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
  assert.ok(entries.length > 0, "vacuous: 0x0b67 was never dispatched, no state to replay");
  captured = entries;
  return captured;
}

// Re-arm the first-time clear path on a captured base: flag back to 0, credit column dirtied to a
// value distinct from the clear tile, a nonzero credit count, and the label + digit cells dirtied so
// any omission is observable.
function craftFirstTime(base, count) {
  const e = base.clone();
  e.mem8[INIT_FLAG] = 0;
  let cell = COLUMN_TOP;
  for (let n = COLUMN_CELLS; n !== 0; n--) {
    e.mem8[cell] = 0xaa; // dirty, distinct from CLEAR_TILE
    cell = (cell + ROW_STEP) & 0xffff;
  }
  for (let i = 0; i < LABEL_LEN; i++) e.mem8[(LABEL_DST - i * ROW_STEP) & 0xffff] = 0xbb;
  e.mem8[COUNT_DST] = 0xcc;
  e.mem8[(COUNT_DST - ROW_STEP) & 0xffff] = 0xcc;
  e.mem8[CREDIT_COUNT] = count;
  return e;
}

// null == equivalent. Live-out is memory + HL + DE. Compare RAM outside the dead [SP-8, SP) stack
// scratch left by the oracle's dissolved return-brackets, then the two advanced pointers. SP is not
// part of the contract.
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
    return `RAM 0x${(addr ?? 0).toString(16)}: ${A[i]} vs ${B[i]}`;
  }
  if (a.regs.hl !== b.regs.hl) return `HL: ${a.regs.hl} vs ${b.regs.hl}`;
  if (a.regs.de !== b.regs.de) return `DE: ${a.regs.de} vs ${b.regs.de}`;
  return null;
}

// broken twins. Each stays faithful except for one deliberate defect the diff must catch.
function brokenNoInit(m) { // BUG: skips the one-time column clear + init-flag latch
  copyRunUpTileColumn(m, LABEL_DST, LABEL_SRC, LABEL_LEN);
  m.mem8[DISPLAY_FLAG] = 1;
  m.regs.hl = COUNT_DST;
  m.regs.a = m.mem8[CREDIT_COUNT];
  return writePackedBcdByte(m);
}
function brokenNoLabel(m) { // BUG: wrong dissolve -- drops the CREDIT label copy
  if (m.mem8[INIT_FLAG] === 0) {
    m.mem8[INIT_FLAG] = 1;
    let cell = COLUMN_TOP;
    for (let n = COLUMN_CELLS; n !== 0; n--) { m.mem8[cell] = CLEAR_TILE; cell = (cell + ROW_STEP) & 0xffff; }
  }
  m.mem8[DISPLAY_FLAG] = 1;
  m.regs.hl = COUNT_DST;
  m.regs.a = m.mem8[CREDIT_COUNT];
  return writePackedBcdByte(m);
}
function brokenOffByOne(m) { // BUG: clears one column cell short
  if (m.mem8[INIT_FLAG] === 0) {
    m.mem8[INIT_FLAG] = 1;
    let cell = COLUMN_TOP;
    for (let n = COLUMN_CELLS - 1; n !== 0; n--) { m.mem8[cell] = CLEAR_TILE; cell = (cell + ROW_STEP) & 0xffff; }
  }
  copyRunUpTileColumn(m, LABEL_DST, LABEL_SRC, LABEL_LEN);
  m.mem8[DISPLAY_FLAG] = 1;
  m.regs.hl = COUNT_DST;
  m.regs.a = m.mem8[CREDIT_COUNT];
  return writePackedBcdByte(m);
}
function brokenWrongAbiLen(m) { // BUG: wrong ABI -- copies the label one byte short
  if (m.mem8[INIT_FLAG] === 0) {
    m.mem8[INIT_FLAG] = 1;
    let cell = COLUMN_TOP;
    for (let n = COLUMN_CELLS; n !== 0; n--) { m.mem8[cell] = CLEAR_TILE; cell = (cell + ROW_STEP) & 0xffff; }
  }
  copyRunUpTileColumn(m, LABEL_DST, LABEL_SRC, LABEL_LEN - 1);
  m.mem8[DISPLAY_FLAG] = 1;
  m.regs.hl = COUNT_DST;
  m.regs.a = m.mem8[CREDIT_COUNT];
  return writePackedBcdByte(m);
}
function brokenWrongCountDst(m) { // BUG: prints the credit digits at the wrong cell
  if (m.mem8[INIT_FLAG] === 0) {
    m.mem8[INIT_FLAG] = 1;
    let cell = COLUMN_TOP;
    for (let n = COLUMN_CELLS; n !== 0; n--) { m.mem8[cell] = CLEAR_TILE; cell = (cell + ROW_STEP) & 0xffff; }
  }
  copyRunUpTileColumn(m, LABEL_DST, LABEL_SRC, LABEL_LEN);
  m.mem8[DISPLAY_FLAG] = 1;
  m.regs.hl = (COUNT_DST + 1) & 0xffff; // off-by-one destination
  m.regs.a = m.mem8[CREDIT_COUNT];
  return writePackedBcdByte(m);
}
function brokenStaleHL(m) { // BUG: correct RAM, but leaves HL un-advanced (register arm)
  renderCreditLine(m);
  m.regs.hl = COUNT_DST;
}
function brokenSurvivingPush16(m) { // leftover return-bracket -- BLIND to this memory gate by design
  if (m.mem8[INIT_FLAG] === 0) {
    m.mem8[INIT_FLAG] = 1;
    let cell = COLUMN_TOP;
    for (let n = COLUMN_CELLS; n !== 0; n--) { m.mem8[cell] = CLEAR_TILE; cell = (cell + ROW_STEP) & 0xffff; }
  }
  m.push16(0x0b87); // the return-bracket a faithful dissolve removes
  copyRunUpTileColumn(m, LABEL_DST, LABEL_SRC, LABEL_LEN);
  m.mem8[DISPLAY_FLAG] = 1;
  m.regs.hl = COUNT_DST;
  m.regs.a = m.mem8[CREDIT_COUNT];
  return writePackedBcdByte(m);
}

test("REAL: oracle == rewrite on every captured 0x0b67 dispatch", { skip }, () => {
  const entries = captureEntries();
  const firstTime = entries.filter((e) => e.mem8[INIT_FLAG] === 0).length;
  for (const e of entries) assert.equal(diff(renderCreditLine, e), null, "a captured machine diverged");
  console.log(`  REAL: ${entries.length} captured dispatches (${firstTime} first-time-path), oracle == rewrite (memory + HL + DE)`);
});

test("CRAFTED: first-time clear path + packed-BCD credit sweep", { skip }, () => {
  const base = captureEntries()[0];
  const counts = [0x00, 0x01, 0x09, 0x10, 0x37, 0x99, 0xab, 0xff];
  for (const c of counts) {
    assert.equal(diff(renderCreditLine, craftFirstTime(base, c)), null, `crafted first-time count=0x${c.toString(16)} diverged`);
    // already-initialised path with the same varied count
    const e = base.clone();
    e.mem8[INIT_FLAG] = 1;
    e.mem8[CREDIT_COUNT] = c;
    assert.equal(diff(renderCreditLine, e), null, `crafted init'd count=0x${c.toString(16)} diverged`);
  }
  console.log(`  CRAFTED: ${counts.length} credit values on both first-time and initialised paths, oracle == rewrite (memory + HL + DE)`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const base = captureEntries()[0];
  const e = craftFirstTime(base, 0x37);
  assert.ok(diff(brokenNoInit, e), "the no-init twin escaped");
  assert.ok(diff(brokenNoLabel, e), "the no-label twin escaped");
  assert.ok(diff(brokenOffByOne, e), "the off-by-one twin escaped");
  assert.ok(diff(brokenWrongAbiLen, e), "the wrong-abi-len twin escaped");
  assert.ok(diff(brokenWrongCountDst, e), "the wrong-count-dst twin escaped");
  assert.ok(diff(brokenStaleHL, e), "the stale-HL twin escaped the register arm");
  console.log("  TEETH: no-init, no-label, off-by-one, wrong-abi-len, wrong-count-dst, stale-HL all caught");
});

test("BLIND: surviving-push16 is tolerated by the masked stack (live/pixel gate's catch)", { skip }, () => {
  const e = craftFirstTime(captureEntries()[0], 0x37);
  assert.equal(diff(brokenSurvivingPush16, e), null,
    "surviving-push16 changed observable memory -- the mask is mis-scoped");
  console.log("  BLIND: surviving-push16 leaves no observable divergence (masked dead stack, by design)");
});
