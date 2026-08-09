// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0201 — memory-equivalent to the frozen oracle at ROM 0x0201.
 *
 * GATE: unit-capture at every real dispatch of two sessions, compared outside ONE dead stack
 *   window, with the Z-flag live-out checked against the oracle and a control that proves the flag
 *   arm can see it, plus teeth. What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch, outside a narrow dead stack window. The oracle brackets its
 *      three sub-calls and its own return with pushes and pops; the rewrite calls the decompiled
 *      callees directly, so bytes below the entry stack pointer can hold different values. The
 *      exclusion is the SCRATCH_BYTES window below the entry stack pointer, and every arm pins it.
 *   2. EXCLUDED, measured: the registers that ever diverge are exactly the four dead scratch cells
 *      the rewrite never reloads — the leftover column step in BC and the leftover table pointer in
 *      HL. Everything a caller reads agrees, the stack pointer and the Z flag included.
 *   3. LIVE-OUT is the Z flag. Both caller families return conditionally on it, so it is checked
 *      against the oracle on every dispatch, and a control twin that flips only that flag is caught
 *      while its memory stays identical — the proof the flag arm is not blind.
 *   4. THE RETURN IS LOAD-BEARING: the rewrite performs its own return, and a twin that drops it
 *      leaves the stack pointer two bytes adrift, asserted rather than assumed.
 *   5. CORPUS — every dispatch of the undriven demo and of the driven tape; the widest scratch
 *      divergence is pinned as an exact ceiling.
 *   6. TEETH — seven twins, each with its catch count on the real corpus recorded exactly.
 *
 * HOLE: this is boot self-test drawing; both tapes reach it before either input matters, so the two
 * sessions coincide and the second buys robustness, not extra states.
 * HOLE: what shape the runs draw, and what the run table's endpoints mean, is not established here.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0201.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0201 } from "../loc_0201.js";
import { loc_0201 as oracle } from "../../translated/loc_0201.js";
import { plotPenCell } from "../plotPenCell.js";
import { fetchTableWord } from "../fetchTableWord.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TARGET = 0x0201;
const ROW_POS = 0xa9e3;
const COL_POS = 0xa9e5;
const ROW_STEP = 0xa9e7;
const COL_STEP = 0xa9e9;
const RUN_INDEX = 0xa9e2;
const ROW_TARGET = 0x32f5;
const COL_TARGET = 0x0b45;
const END_CELL = 0x14b2;
const RUN_TABLE = 0x0290;
const Z_FLAG = 0x40;

/** Widest divergence any dispatch produces below the entry stack pointer. Measured, pinned exact. */
const SCRATCH_BYTES = 4;
/** BC keeps the last column step, HL the table pointer past the entry; no caller reads either. */
const REG_EXCLUDED = ["b", "c", "h", "l"];
const COMPARED = REG_FIELDS.filter((k) => !REG_EXCLUDED.includes(k));
/** The real run stamps at most seventeen cells; a twin that never converges is stopped past that. */
const GUARD = 1000;

const TAPES = [["demo", { tape: [] }], ["driven", {}]];
const DISPATCHES = { demo: 106, driven: 106 };
const CAUGHT = {
  "no-op": 106,
  "step-unsigned": 78,
  "swap-row-col": 104,
  "no-run-index-inc": 106,
  "no-final-return": 106,
  "forgot-report": 105,
  "flip-z-control": 106,
};

const hex = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── captures ────────────────────────────────────────────────────────────────────────────

const cache = new Map();
function capture(label, opts) {
  if (cache.has(label)) return cache.get(label);
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]), opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the ${label} session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, `the ${label} session ran short`);
  cache.set(label, entries);
  return entries;
}
const driven = () => capture("driven", {});
const anEntry = () => driven()[0];

// ── the masked comparison ─────────────────────────────────────────────────────────────────

/** Oracle vs a candidate on two clones of one entry, ignoring the dead stack window. */
function diverge(candidate, entry) {
  const sp = entry.regs.sp;
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  try {
    candidate(b);
  } catch {
    return { reason: "threw" };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp) continue;
    return { reason: "ram", addr, a: da[i], b: db[i] };
  }
  const reg = COMPARED.find((k) => a.regs[k] !== b.regs[k]);
  if (reg) return { reason: "reg:" + reg, a: a.regs[reg], b: b.regs[reg] };
  return null;
}

/** Every register that moves between oracle and candidate, dead scratch included. */
function movedRegisters(candidate, entry) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  return REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
}

/** Bytes the oracle moves from this entry — the guard against a vacuous comparison. */
function footprint(entry) {
  const before = entry.dumpState().slice();
  const after = entry.clone();
  oracle(after);
  const now = after.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

// ── twins, each one change away from the real routine ─────────────────────────────────────

function stepToward(target, current) {
  const delta = (target - current) & 0xffff;
  return (((delta >> 12) & 1 ? 0xff00 : 0) | ((delta >> 4) & 0xff)) & 0xffff;
}

/** The pre-stamp, the two steps, and the run loop — identical to the real routine. */
function drawRun(m) {
  const { regs, mem16 } = m;
  plotPenCell(m);
  mem16[ROW_STEP] = stepToward(mem16[ROW_TARGET], mem16[ROW_POS]);
  mem16[COL_STEP] = stepToward(mem16[COL_TARGET], mem16[COL_POS]);
  do {
    mem16[ROW_POS] = mem16[ROW_POS] + mem16[ROW_STEP];
    mem16[COL_POS] = mem16[COL_POS] + mem16[COL_STEP];
    plotPenCell(m);
  } while (regs.hl !== mem16[END_CELL]);
}

/** Advance the run index and read the next run's endpoint word into DE. */
function loadNextRun(m) {
  const { regs, mem8 } = m;
  mem8[RUN_INDEX] = mem8[RUN_INDEX] + 1;
  regs.a = mem8[RUN_INDEX];
  regs.hl = RUN_TABLE;
  fetchTableWord(m);
}

/** BUG: does nothing — the tell of a gate that measures an unreached routine. */
function brokenNoOp() {}

/** BUG: keeps the step unsigned, so a run toward a lower coordinate walks off the wrong way. */
function brokenStepUnsigned(m) {
  const { regs, mem8, mem16 } = m;
  const unsigned = (t, c) => ((t - c) & 0xffff) >> 4 & 0xff;
  plotPenCell(m);
  mem16[ROW_STEP] = unsigned(mem16[ROW_TARGET], mem16[ROW_POS]);
  mem16[COL_STEP] = unsigned(mem16[COL_TARGET], mem16[COL_POS]);
  let g = 0;
  do {
    mem16[ROW_POS] = mem16[ROW_POS] + mem16[ROW_STEP];
    mem16[COL_POS] = mem16[COL_POS] + mem16[COL_STEP];
    plotPenCell(m);
    if (++g > GUARD) throw new Error("never converged");
  } while (regs.hl !== mem16[END_CELL]);
  loadNextRun(m);
  mem8[ROW_POS] = 0;
  mem8[ROW_POS + 1] = regs.e;
  mem8[COL_POS] = 0;
  mem8[COL_POS + 1] = regs.d;
  regs.a = regs.e;
  regs.and(regs.a);
  m.ret(10);
}

/** BUG: stores the loaded endpoint into the wrong axis integers. */
function brokenSwapRowCol(m) {
  const { regs, mem8 } = m;
  drawRun(m);
  loadNextRun(m);
  mem8[ROW_POS] = 0;
  mem8[ROW_POS + 1] = regs.d;
  mem8[COL_POS] = 0;
  mem8[COL_POS + 1] = regs.e;
  regs.a = regs.e;
  regs.and(regs.a);
  m.ret(10);
}

/** BUG: does not advance the run index, so it reloads the run it just finished. */
function brokenNoRunIndexInc(m) {
  const { regs, mem8 } = m;
  drawRun(m);
  regs.a = mem8[RUN_INDEX];
  regs.hl = RUN_TABLE;
  fetchTableWord(m);
  mem8[ROW_POS] = 0;
  mem8[ROW_POS + 1] = regs.e;
  mem8[COL_POS] = 0;
  mem8[COL_POS + 1] = regs.d;
  regs.a = regs.e;
  regs.and(regs.a);
  m.ret(10);
}

/** BUG: leaves the stack pointer two bytes adrift by never returning. */
function brokenNoFinalReturn(m) {
  const { regs, mem8 } = m;
  drawRun(m);
  loadNextRun(m);
  mem8[ROW_POS] = 0;
  mem8[ROW_POS + 1] = regs.e;
  mem8[COL_POS] = 0;
  mem8[COL_POS + 1] = regs.d;
  regs.a = regs.e;
  regs.and(regs.a);
}

/** BUG: reports the flag off the leftover accumulator instead of the new row integer. */
function brokenForgotReport(m) {
  const { regs, mem8 } = m;
  drawRun(m);
  loadNextRun(m);
  mem8[ROW_POS] = 0;
  mem8[ROW_POS + 1] = regs.e;
  mem8[COL_POS] = 0;
  mem8[COL_POS + 1] = regs.d;
  regs.and(regs.a);
  m.ret(10);
}

/** BUG: correct in memory, wrong only in the live-out flag — the control for the flag arm. */
function brokenFlipZControl(m) {
  loc_0201(m);
  m.regs.f ^= Z_FLAG;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["step-unsigned", brokenStepUnsigned],
  ["swap-row-col", brokenSwapRowCol],
  ["no-run-index-inc", brokenNoRunIndexInc],
  ["no-final-return", brokenNoFinalReturn],
  ["forgot-report", brokenForgotReport],
  ["flip-z-control", brokenFlipZControl],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the dead stack window", { skip }, () => {
  const entry = anEntry();
  assert.ok(footprint(entry) > 0, "vacuous: the oracle writes nothing from this entry");
  assert.equal(diverge(loc_0201, entry), null, "the rewrite diverged at the real entry");
  console.log(`  EQUAL: entry sp=${hex(entry.regs.sp)}; identical outside [sp-${SCRATCH_BYTES}, sp)`);
});

test("EXCLUDED, measured: nothing outside the four dead scratch registers ever diverges", { skip }, () => {
  const union = new Set();
  for (const e of driven()) {
    for (const k of movedRegisters(loc_0201, e)) union.add(k);
  }
  assert.deepEqual(REG_FIELDS.filter((k) => union.has(k)), REG_EXCLUDED,
    "the set of registers that diverge across the corpus moved");
  console.log(`  EXCLUDED: over the corpus the only diverging registers are ${REG_EXCLUDED.join(", ")}`);
});

test("NOT VACUOUS: the masked comparison catches a do-nothing candidate", { skip }, () => {
  assert.notEqual(diverge(brokenNoOp, anEntry()), null, "the masked diff passed a no-op");
  console.log("  NOT VACUOUS: the empty candidate is caught");
});

test("LIVE-OUT: the Z flag agrees, and the flag arm catches a twin that flips only it", { skip }, () => {
  const a = anEntry().clone();
  const b = anEntry().clone();
  oracle(a);
  loc_0201(b);
  assert.equal(b.regs.f, a.regs.f, "the rewrite's flag byte differs from the oracle's");
  const control = diverge(brokenFlipZControl, anEntry());
  assert.equal(control?.reason, "reg:f", "flipping only the Z flag was not caught by the flag arm");
  console.log(`  LIVE-OUT: Z ${(a.regs.f & Z_FLAG) === 0 ? "clear" : "set"} on both; the flag-flip control is caught`);
});

test("THE RETURN IS LOAD-BEARING: dropping it leaves the stack two bytes adrift", { skip }, () => {
  const ref = anEntry().clone();
  const kept = anEntry().clone();
  const dropped = anEntry().clone();
  oracle(ref);
  loc_0201(kept);
  brokenNoFinalReturn(dropped);
  assert.equal(kept.regs.sp, ref.regs.sp, "the rewrite must leave the stack where the oracle does");
  assert.equal((ref.regs.sp - dropped.regs.sp) & 0xffff, 2, "dropping the return must leave sp adrift");
  console.log(`  RETURN: with it sp=${hex(kept.regs.sp)} (matches); without it sp=${hex(dropped.regs.sp)}`);
});

test("CORPUS: every dispatch of both sessions replays identically", { skip }, () => {
  let widest = 0;
  let total = 0;
  for (const [label, opts] of TAPES) {
    const entries = capture(label, opts);
    assert.equal(entries.length, DISPATCHES[label], `the ${label} dispatch count moved`);
    for (const e of entries) {
      const sp = e.regs.sp;
      const a = e.clone();
      const b = e.clone();
      oracle(a);
      loc_0201(b);
      const da = a.dumpState();
      const db = b.dumpState();
      for (let i = 0; i < da.length; i++) {
        if (da[i] === db[i]) continue;
        const addr = a.stateOffsetToAddr(i);
        if (addr !== null && addr < sp) widest = Math.max(widest, sp - addr);
        const inWindow = addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;
        assert.ok(inWindow, `a ${label} dispatch diverged at ${hex(addr ?? 0)}`);
      }
      const stray = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k] && !REG_EXCLUDED.includes(k));
      assert.deepEqual(stray, [], `a ${label} dispatch moved a register outside the dead scratch set`);
    }
    total += entries.length;
  }
  assert.equal(widest, SCRATCH_BYTES, "the widest scratch divergence moved: the window is wrong");
  console.log(`  CORPUS: ${total} dispatches over two sessions; widest scratch sp-${widest}`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin's catch count on the real corpus is exactly what is recorded`, { skip }, () => {
    let caught = 0;
    for (const e of driven()) if (diverge(twin, e)) caught++;
    assert.equal(caught, CAUGHT[label], `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${driven().length} real dispatches`);
  });
}
