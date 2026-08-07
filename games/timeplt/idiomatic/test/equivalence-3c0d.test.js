// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireObjectAndHold — memory-equivalent to the frozen oracle at ROM 0x3C0D.
 *
 * ★ THIS ROUTINE ENDS AT ITS OWN `ret`, AND THIS FILE PROVES IT RATHER THAN ASSUMING IT. Arm 1
 *   runs the ORACLE from a machine whose whole state dump has been painted with a marker and
 *   reports every cell that moves: exactly seven, all of them accounted for by the seven stores
 *   this entry makes. Anything a longer extent would do — re-arming a further counter, walking a
 *   list — would show up there as an eighth cell, and does not.
 *
 * GATE: every dispatch of two real tapes, plus painted crafted entries over every record base and
 *   sprite entry the object arrays use. What it exercises, holes stated:
 *
 *   1. THE WRITE-SET IS SEVEN CELLS — measured off the oracle over a whole painted dump.
 *   2. CORPUS — every dispatch replayed, whole state dump, no exclusion window: this routine
 *      pushes nothing, so the two arms agree on every byte including the stack.
 *   3. REGISTERS ARE EXCLUDED, DELIBERATELY, and pinned to at most {a, f, sp}: nothing else the
 *      routine leaves behind is a value, and its three callers either reload immediately or reach
 *      it as a tail whose own caller does.
 *   4. THE BASES — every record base and sprite entry the object arrays use, each with a painted
 *      band, so a wrong offset is visible wherever it lands.
 *   5. THE PINNED TWIN — an implementation that ignores its arguments and hard-codes one base. It
 *      must SURVIVE that base and DIE on every other, which is the distinction a single-base gate
 *      cannot draw.
 *   6. EXHAUSTIVE over the held byte's prior — all 256 values at one base.
 *   7. PARAMETER FORM — the two record/entry arguments agree with the registers they default to.
 *   8. TEETH — seven twins, each with its exact catch count over the bases.
 *
 * HOLE: nothing here says what the seventh byte gates, nor why one sprite entry is fixed while
 * the other is the caller's. The bases swept are the ones the object arrays use, not every
 * address a caller could pass.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3c0d.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { retireObjectAndHold } from "../retireObjectAndHold.js";
import { loc_3c0d as oracle } from "../../translated/loc_3c0d.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x3c0d;

const RECORD_STRIDE = 16;
const SECOND_AXIS_OFFSET = 49;
const HELD_BYTE = 14;
const HELD_AT = 128;
const FIXED_ENTRY = 0xaa2a;

const DISPATCHES = { shared: 2, attract: 1 };
const TAPES = [["shared", {}], ["attract", { tape: [] }]];

/** The record bases the object arrays use: the player, the actor band, the scenery band. */
const RECORD_BASES = [
  0xa800,
  0xa810, 0xa820, 0xa830, 0xa840, 0xa850, 0xa860, 0xa870, 0xa880,
  0xa900, 0xa910, 0xa920, 0xa930, 0xa940, 0xa950, 0xa960, 0xa970,
];
/** Sprite entries, on the stride the entry cursor walks. */
const ENTRIES = [0xaa10, 0xaa12, 0xaa1a, 0xaa28, 0xaa60, 0xaa7c];
const BASE_PAIRS = RECORD_BASES.map((record, i) => [record, ENTRIES[i % ENTRIES.length]]);

const PAINT_EITHER_SIDE = 4;
const EXCLUDED = ["a", "f", "sp"];

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = allDiffs(a, b)[0];
  if (ram) return ram;
  const moved = REG_FIELDS.find((k) => !EXCLUDED.includes(k) && a.regs[k] !== b.regs[k]);
  return moved ? { addr: null, a: a.regs[moved], b: b.regs[moved] } : null;
}

let corpusCache = null;
function corpus() {
  if (corpusCache) return corpusCache;
  corpusCache = TAPES.map(([label, opts]) => {
    const states = [];
    const host = makeMachine(new Map([[TARGET, (mm) => (states.push(mm.clone()), oracle(mm))]]), opts);
    const frames = host.runFrames(ENTRY_FRAMES);
    assert.equal(host.stoppedBy, null, `the ${label} session stopped early: ${host.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, `the ${label} session ran short`);
    assert.equal(states.length, DISPATCHES[label], `the ${label} dispatch count moved`);
    return { label, states };
  });
  return corpusCache;
}

const anEntry = () => corpus()[0].states[0];

const marker = (addr) => ((addr & 0xff) ^ 0x5a) || 0x5a;

/** The addresses the paint covers for one (record, entry) pair. */
function bandCells(record, entry) {
  const out = [];
  const spans = [
    [record - PAINT_EITHER_SIDE, record + RECORD_STRIDE + PAINT_EITHER_SIDE],
    [entry - PAINT_EITHER_SIDE, entry + PAINT_EITHER_SIDE],
    [entry + SECOND_AXIS_OFFSET - PAINT_EITHER_SIDE, entry + SECOND_AXIS_OFFSET + PAINT_EITHER_SIDE],
    [FIXED_ENTRY - PAINT_EITHER_SIDE, FIXED_ENTRY + PAINT_EITHER_SIDE],
    [FIXED_ENTRY + SECOND_AXIS_OFFSET - PAINT_EITHER_SIDE,
      FIXED_ENTRY + SECOND_AXIS_OFFSET + PAINT_EITHER_SIDE],
  ];
  for (const [from, to] of spans) for (let a = from; a <= to; a++) out.push(a);
  return [...new Set(out)].sort((x, y) => x - y);
}

function craft(record, entry, held) {
  const m = anEntry().clone();
  for (const a of bandCells(record, entry)) m.mem8[a] = marker(a);
  m.regs.ix = record;
  m.regs.iy = entry;
  if (held !== undefined) m.mem8[record + HELD_BYTE] = held;
  return m;
}

function basesCaught(candidate) {
  let caught = 0;
  for (const [record, entry] of BASE_PAIRS) {
    if (unitDiff(candidate, craft(record, entry))) caught++;
  }
  return caught;
}

/** Every cell of the whole state dump the ORACLE moves, from a dump painted end to end. */
function wholeWriteSet(record, entry) {
  const before = anEntry().clone();
  for (let a = 0xa000; a < 0xb000; a++) before.mem8[a] = marker(a);
  before.regs.ix = record;
  before.regs.iy = entry;
  const after = before.clone();
  oracle(after);
  return allDiffs(before, after).map((d) => d.addr);
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("THE WRITE-SET IS SEVEN CELLS, and no eighth", { skip }, () => {
  const record = 0xa850;
  const entry = 0xaa1a;
  const moved = wholeWriteSet(record, entry);
  const expected = [
    record,
    record + RECORD_STRIDE,
    record + HELD_BYTE,
    entry,
    entry + SECOND_AXIS_OFFSET,
    FIXED_ENTRY,
    FIXED_ENTRY + SECOND_AXIS_OFFSET,
  ].sort((x, y) => x - y);
  assert.deepEqual(moved, expected,
    "the oracle's write-set is not the seven stores this file accounts for — if it is larger the " +
      "routine's extent has been read wrong and the rewrite is short");
  console.log(`  WRITE-SET: ${moved.length} cells — ${moved.map(hex4).join(" ")}`);
});

test("CORPUS: every dispatch of two real sessions replays identically, stack included", { skip }, () => {
  let total = 0;
  for (const s of corpus()) {
    assert.ok(s.states.length > 0, `vacuous: the ${s.label} tape never reached the routine`);
    for (const state of s.states) {
      const d = unitDiff(retireObjectAndHold, state);
      assert.equal(d, null, `${s.label}: ${show(d)}`);
    }
    total += s.states.length;
  }
  console.log(`  CORPUS: ${total} real dispatches over two sessions, identical on every byte`);
});

test("EXCLUDED, deliberately: at most the accumulator, the flag byte, sp and pc", { skip }, () => {
  const entry = craft(0xa850, 0xaa1a);
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  retireObjectAndHold(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.ok(moved.every((k) => EXCLUDED.includes(k)), `a register outside the set moved: ${moved}`);
  assert.equal(a.regs.ix, b.regs.ix, "the record pointer must be left where it was");
  assert.equal(a.regs.iy, b.regs.iy, "the entry pointer must be left where it was");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED: ${moved.join(", ")} and pc`);
});

test("THE BASES: every record base and entry the object arrays use", { skip }, () => {
  for (const [record, entry] of BASE_PAIRS) {
    const d = unitDiff(retireObjectAndHold, craft(record, entry));
    assert.equal(d, null, `record ${hex4(record)} entry ${hex4(entry)}: ${show(d)}`);
  }
  console.log(`  BASES: ${BASE_PAIRS.length} record/entry pairs identical`);
});

test("EXHAUSTIVE over the held byte's prior: all 256 values", { skip }, () => {
  const [record, entry] = BASE_PAIRS[1];
  for (let held = 0; held < 256; held++) {
    const d = unitDiff(retireObjectAndHold, craft(record, entry, held));
    assert.equal(d, null, `held=${held}: ${show(d)}`);
  }
  const after = craft(record, entry, 0);
  oracle(after);
  assert.equal(after.mem8[record + HELD_BYTE], HELD_AT,
    "the held byte does not come out at the constant this file names");
  console.log(`  EXHAUSTIVE: 256 priors identical; the held byte always comes out ${HELD_AT}`);
});

test("PARAMETER FORM: the arguments and the registers agree", { skip }, () => {
  const [record, entry] = BASE_PAIRS[2];
  const viaRegister = craft(record, entry, 0x7e);
  retireObjectAndHold(viaRegister);

  const viaArgument = craft(record, entry, 0x7e);
  viaArgument.regs.ix = 0x0000;
  viaArgument.regs.iy = 0x0000;
  retireObjectAndHold(viaArgument, record, entry);

  assert.deepEqual(allDiffs(viaRegister, viaArgument), [], "the two forms diverged");
  console.log(`  PARAMETER FORM: argument and register agree at ${hex4(record)}/${hex4(entry)}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: retires the caller's record and forgets the one a stride on. */
function brokenOneRecord(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  mem8[record] = 0;
  mem8[entry] = 0;
  mem8[entry + SECOND_AXIS_OFFSET] = 0;
  mem8[FIXED_ENTRY + SECOND_AXIS_OFFSET] = 0;
  mem8[FIXED_ENTRY] = 0;
  mem8[record + HELD_BYTE] = HELD_AT;
}

/** BUG: leaves the fixed entry standing. */
function brokenNoFixedEntry(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  mem8[record] = 0;
  mem8[record + RECORD_STRIDE] = 0;
  mem8[entry] = 0;
  mem8[entry + SECOND_AXIS_OFFSET] = 0;
  mem8[record + HELD_BYTE] = HELD_AT;
}

/** BUG: clears the seventh byte along with the rest instead of arming it. */
function brokenHeldCleared(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  mem8[record] = 0;
  mem8[record + RECORD_STRIDE] = 0;
  mem8[entry] = 0;
  mem8[entry + SECOND_AXIS_OFFSET] = 0;
  mem8[FIXED_ENTRY + SECOND_AXIS_OFFSET] = 0;
  mem8[FIXED_ENTRY] = 0;
  mem8[record + HELD_BYTE] = 0;
}

/** BUG: arms the seventh byte one out. */
function brokenHeldValue(m, record = m.regs.ix, entry = m.regs.iy) {
  retireObjectAndHold(m, record, entry);
  m.mem8[record + HELD_BYTE] = HELD_AT + 1;
}

/** BUG: clears only one of the entry's two coordinates. */
function brokenOneAxis(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  mem8[record] = 0;
  mem8[record + RECORD_STRIDE] = 0;
  mem8[entry] = 0;
  mem8[FIXED_ENTRY + SECOND_AXIS_OFFSET] = 0;
  mem8[FIXED_ENTRY] = 0;
  mem8[record + HELD_BYTE] = HELD_AT;
}

/** BUG: arms the byte beside the seventh one. */
function brokenHeldOffset(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  mem8[record] = 0;
  mem8[record + RECORD_STRIDE] = 0;
  mem8[entry] = 0;
  mem8[entry + SECOND_AXIS_OFFSET] = 0;
  mem8[FIXED_ENTRY + SECOND_AXIS_OFFSET] = 0;
  mem8[FIXED_ENTRY] = 0;
  mem8[record + HELD_BYTE + 1] = HELD_AT;
}

/** BUG: ignores both pointers and hard-codes the first base the sweep uses. */
function brokenPinned(m) {
  retireObjectAndHold(m, BASE_PAIRS[0][0], BASE_PAIRS[0][1]);
}

const TWINS = [
  ["no-op", brokenNoOp, BASE_PAIRS.length],
  ["one-record-only", brokenOneRecord, BASE_PAIRS.length],
  ["fixed-entry-left-standing", brokenNoFixedEntry, BASE_PAIRS.length],
  ["held-byte-cleared", brokenHeldCleared, BASE_PAIRS.length],
  ["held-value-off-by-one", brokenHeldValue, BASE_PAIRS.length],
  ["one-axis-only", brokenOneAxis, BASE_PAIRS.length],
  ["held-offset-off-by-one", brokenHeldOffset, BASE_PAIRS.length],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught at an exact count of bases`, { skip }, () => {
    assert.equal(basesCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught at ${expected} of ${BASE_PAIRS.length} bases`);
  });
}

test("TEETH: the pinned twin SURVIVES its one base and DIES on the others", { skip }, () => {
  const [record, entry] = BASE_PAIRS[0];
  assert.equal(unitDiff(brokenPinned, craft(record, entry)), null, "it must survive the base it pins");
  let died = 0;
  for (const [r, e] of BASE_PAIRS.slice(1)) if (unitDiff(brokenPinned, craft(r, e))) died++;
  assert.equal(died, BASE_PAIRS.length - 1, "it must die on every other base");
  console.log(`  TEETH/pinned: survives ${hex4(record)}, dies on the other ${died}`);
});
