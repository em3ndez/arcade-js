// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSexagesimalDigit — memory-equivalent to the frozen oracle at ROM 0x4D67.
 *
 * GATE: strict unit-capture at a real dispatch, an EXHAUSTIVE sweep of the routine's whole input
 *   space, and a corpus replay. The routine reads ONE byte, the one its pointer names, and writes
 *   the same byte back, so 256 values IS the entire input space and the sweep is complete rather
 *   than a sample. What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — the state dump agrees byte for byte, the scratch window
 *      included. Measured: nothing below the entry stack pointer differs here at all, so this
 *      file names NO exclusion and the arm asserts the empty one rather than describing it.
 *   2. LIVE-OUT — the carry flag as well as the byte. Carry is what the caller branches on to
 *      decide whether to step the next digit pair, so a gate that watched RAM alone would pass a
 *      rewrite that got the roll-over answer exactly backwards, and the TEETH prove that.
 *   3. EXHAUSTIVE — all 256 starting values, byte and carry compared on each. This is the arm
 *      that covers packed-decimal inputs that are not valid packed decimal, which no real
 *      dispatch produces: the counter cells start at zero and only this routine writes them.
 *   4. THE SWEEP REACHES BOTH ARMS, asserted rather than assumed — the value at which the byte
 *      rolls over is located inside the sweep, and both sides of it are shown non-empty.
 *   5. CORPUS — every dispatch of a driven session, replayed on a clone taken at the dispatch.
 *   6. TEETH — four twins, each caught on its own exact count over the sweep.
 *
 * HOLE: the corpus reaches only the values a real run produces, which the arm reports; the
 * exhaustive sweep is what carries this gate and the corpus is a realism check on top of it.
 * HOLE: nothing here says what the byte COUNTS. It is a packed-decimal digit pair that rolls at
 * sixty and hands a roll-over on to whatever the caller does next, and this gate claims no more.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4d67.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { advanceSexagesimalDigit } from "../advanceSexagesimalDigit.js";
import { loc_4d67 as oracle } from "../../translated/loc_4d67.js";
import { REG_FIELDS, F_C } from "../../../../core/cpu/z80.js";

const TARGET = 0x4d67;

/** Dispatches the shared tape produces in the harness budget. Measured; a move is a finding. */
const DISPATCHES = 308;

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

let captured = null;
let realValues = null;

/** Replay a whole driven session, comparing the candidate on a clone at every dispatch. */
function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const values = new Set();
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    values.add(mm.mem8[mm.regs.hl]);
    if (captured === null) captured = mm.clone();
    if (compare(candidate, mm)) caught++;
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  realValues = values;
  return { dispatches, caught };
}

/** Oracle vs candidate on two clones: RAM, then the carry the caller branches on. */
function compare(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = allDiffs(a, b)[0];
  if (ram) return ram;
  if ((a.regs.f & F_C) !== (b.regs.f & F_C)) {
    return { addr: null, a: a.regs.f & F_C, b: b.regs.f & F_C };
  }
  return null;
}

function entryState() {
  if (captured === null) replay(advanceSexagesimalDigit);
  return captured;
}

/** The captured machine with the counted byte forced to `value`. */
function craft(value) {
  const m = entryState().clone();
  m.mem8[m.regs.hl] = value;
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (let value = 0; value < 256; value++) if (compare(candidate, craft(value))) caught++;
  return caught;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: RAM identical, scratch window included", { skip }, () => {
  const entry = entryState();
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  advanceSexagesimalDigit(b);
  assert.deepEqual(allDiffs(a, b), [], `a byte diverged — ${show(allDiffs(a, b)[0])}`);
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle pops its return address; the rewrite does not");
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    ["a", "f", "sp"],
    "the excluded set changed shape: only the accumulator, the flag byte and the stack pointer " +
      "may differ, and of those only carry is a live-out",
  );
  console.log(
    `  EQUAL: cell ${hex4(entry.regs.hl)} held ${entry.mem8[entry.regs.hl]}; every byte identical`,
  );
});

test("LIVE-OUT: the carry the caller branches on matches on the real dispatch", { skip }, () => {
  const entry = entryState();
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  const returned = advanceSexagesimalDigit(b);
  assert.equal(a.regs.f & F_C, b.regs.f & F_C, "the carry flag diverged");
  assert.equal(returned, (b.regs.f & F_C) === 0, "the returned answer must mirror carry inverted");
  console.log(`  LIVE-OUT: carry ${(a.regs.f & F_C) !== 0}, returned ${returned}`);
});

test("EXHAUSTIVE: all 256 starting values agree on the byte and on carry", { skip }, () => {
  for (let value = 0; value < 256; value++) {
    const d = compare(advanceSexagesimalDigit, craft(value));
    assert.equal(d, null, `value=${value}: ${show(d)}`);
  }
  console.log("  EXHAUSTIVE: 256 starting values identical in RAM and in carry");
});

test("THE SWEEP REACHES BOTH ARMS: the roll-over point is inside it", { skip }, () => {
  const rolled = [];
  const kept = [];
  for (let value = 0; value < 256; value++) {
    const m = craft(value);
    const cell = m.regs.hl;
    oracle(m);
    (m.mem8[cell] === 0 ? rolled : kept).push(value);
  }
  assert.ok(rolled.length > 0, "no starting value rolled the byte over — the sweep misses an arm");
  assert.ok(kept.length > 0, "every starting value rolled over — the sweep misses the other arm");
  assert.ok(rolled.includes(0x59), "the value one below the roll-over point did not roll over");
  assert.ok(kept.includes(0x58), "the value two below the roll-over point rolled over early");
  console.log(`  ARMS: ${rolled.length} values roll the byte over, ${kept.length} do not`);
});

test("CORPUS: every dispatch of a driven session replays identically", { skip }, () => {
  const r = replay(advanceSexagesimalDigit);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, `the rewrite diverged on ${r.caught} real dispatches`);
  assert.ok(realValues.size > 1, "vacuous: every real dispatch presented the same byte");
  console.log(
    `  CORPUS: ${r.dispatches} dispatches identical; ${realValues.size} distinct bytes presented`,
  );
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
const brokenNoOp = () => {};

/** BUG: plain binary increment, so the digit correction never happens. */
function brokenNoDecimalCorrection(m) {
  const cell = m.regs.hl;
  const stepped = (m.mem8[cell] + 1) & 0xff;
  m.mem8[cell] = stepped >= 0x60 ? 0 : stepped;
  m.regs.f = (m.regs.f & ~F_C) | (stepped >= 0x60 ? 0 : F_C);
}

/** BUG: rolls over at a hundred instead of sixty. */
function brokenRollsAtHundred(m) {
  const cell = m.regs.hl;
  const was = m.mem8[cell];
  advanceSexagesimalDigit(m, cell);
  if (m.mem8[cell] === 0 && was !== 0x99) m.mem8[cell] = (was + 1) & 0xff;
  m.regs.f |= F_C;
}

/** BUG: the roll-over answer comes back the wrong way round, invisible to RAM. */
function brokenCarryInverted(m) {
  const rolled = advanceSexagesimalDigit(m);
  m.regs.f = (m.regs.f & ~F_C) | (rolled ? F_C : 0);
  return !rolled;
}

const TWINS = [
  ["no-op", brokenNoOp, 256],
  ["no-decimal-correction", brokenNoDecimalCorrection, 138],
  ["rolls-at-a-hundred", brokenRollsAtHundred, 71],
  ["carry-inverted", brokenCarryInverted, 256],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of the 256`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${expected} of 256 starting values`);
  });
}
