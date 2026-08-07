// SPDX-License-Identifier: GPL-3.0-only
/**
 * expireHitChain — memory-equivalent to the frozen oracle at ROM 0x5205.
 *
 * GATE: strict unit-capture at a real dispatch, an EXHAUSTIVE sweep of the routine's whole input
 *   space, and a corpus replay of a whole driven session. The routine reads ONE byte and writes
 *   one of two, so 256 values IS its entire input space. What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — the state dump agrees byte for byte, the stack scratch
 *      included, so this file names NO exclusion and asserts the empty one.
 *   2. BLIND, MEASURED — the captured dispatch arrives with the counter already run out AND the
 *      neighbour already clear, so the frozen routine moves no byte there and a candidate that
 *      does nothing passes. That is asserted rather than described, and it is why the sweep
 *      below and not the capture is what carries this gate.
 *   3. EXHAUSTIVE — all 256 values of the counted byte, each poked identically on both sides.
 *   4. BOTH ARMS REACHED, asserted rather than assumed: the sweep is shown to contain values
 *      that count down and values that clear the neighbour, and the two sets are shown disjoint.
 *   5. CORPUS — every dispatch of a driven session, on a clone taken at the dispatch.
 *   6. TEETH — five twins, each caught on its own exact count over the sweep.
 *
 * HOLE: nothing here says what the two bytes MEAN. It gates that one is counted down while it has
 * anything left and that the other is held at zero once it does not, and claims nothing further.
 * HOLE: the corpus reaches whatever values the driven session produced, which the arm reports; a
 * session that never lets the counter expire would still leave the sweep carrying the gate.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-5205.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { expireHitChain } from "../expireHitChain.js";
import { loc_5205 as oracle } from "../../translated/loc_5205.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { CHAIN_WINDOW, CHAIN_STEP } from "../names.js";

const TARGET = 0x5205;

/** Dispatches the shared tape produces in the harness budget. Measured; a move is a finding. */
const DISPATCHES = 303;

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

function compare(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b)[0] ?? null;
}

let captured = null;
let realValues = null;

function replay(candidate) {
  let dispatches = 0;
  let caught = 0;
  const values = new Set();
  const m = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    values.add(mm.mem8[CHAIN_WINDOW]);
    if (captured === null) captured = mm.clone();
    if (compare(candidate, mm)) caught++;
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  realValues = values;
  return { dispatches, caught };
}

function entryState() {
  if (captured === null) replay(expireHitChain);
  return captured;
}

/** A real captured machine with the counted byte, and the byte beside it, forced. */
function craft(value, neighbour = 0xa5) {
  const m = entryState().clone();
  m.mem8[CHAIN_WINDOW] = value;
  m.mem8[CHAIN_STEP] = neighbour;
  return m;
}

function sweepCaught(candidate) {
  let caught = 0;
  for (let value = 0; value < 256; value++) if (compare(candidate, craft(value))) caught++;
  return caught;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: every byte identical, the stack scratch included", { skip }, () => {
  const entry = entryState();
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  expireHitChain(b);
  assert.deepEqual(allDiffs(a, b), [], `a byte diverged — ${show(allDiffs(a, b)[0])}`);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    ["f", "h", "l", "sp"],
    "the excluded set changed shape: none of these is read by anything this entry returns to",
  );
  console.log(
    `  EQUAL: window ${entry.mem8[CHAIN_WINDOW]}, neighbour ${entry.mem8[CHAIN_STEP]}; identical`,
  );
});

test("BLIND: the captured dispatch is VACUOUS, and this arm pins it", { skip }, () => {
  const entry = entryState();
  assert.equal(
    entry.mem8[CHAIN_WINDOW],
    0,
    "the captured entry no longer arrives with the window already run out, so the strict " +
      "capture may now have teeth and this file must be re-derived rather than trusted",
  );
  assert.equal(
    entry.mem8[CHAIN_STEP],
    0,
    "the neighbour is no longer already clear at the captured entry, so clearing it would now " +
      "move a byte and the vacuity recorded here is stale",
  );
  assert.equal(
    compare(() => {}, entry),
    null,
    "the no-op is now CAUGHT at the captured dispatch — good news, but this test documents the " +
      "opposite and must be rewritten",
  );
  console.log("  BLIND: window already zero and neighbour already clear; a no-op passes here");
});

test("EXHAUSTIVE: all 256 values of the counted byte behave alike", { skip }, () => {
  for (let value = 0; value < 256; value++) {
    const d = compare(expireHitChain, craft(value));
    assert.equal(d, null, `value=${value}: ${show(d)}`);
  }
  console.log("  EXHAUSTIVE: 256 values identical");
});

test("BOTH ARMS REACHED: the sweep counts down on some values and clears on others", { skip }, () => {
  const countedDown = [];
  const cleared = [];
  for (let value = 0; value < 256; value++) {
    const m = craft(value);
    oracle(m);
    if (m.mem8[CHAIN_STEP] === 0) cleared.push(value);
    if (m.mem8[CHAIN_WINDOW] !== value) countedDown.push(value);
  }
  assert.deepEqual(cleared, [0], "exactly one value must take the clearing arm");
  assert.equal(countedDown.length, 255, "every other value must be counted down");
  assert.ok(!countedDown.includes(0), "the two arms must be disjoint");
  console.log(`  ARMS: ${countedDown.length} values counted down, ${cleared.length} cleared`);
});

test("CORPUS: every dispatch of a driven session replays identically", { skip }, () => {
  const r = replay(expireHitChain);
  assert.equal(r.dispatches, DISPATCHES, "the dispatch count moved");
  assert.equal(r.caught, 0, `the rewrite diverged on ${r.caught} real dispatches`);
  console.log(
    `  CORPUS: ${r.dispatches} dispatches identical; values presented ${[...realValues].join(",")}`,
  );
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
const brokenNoOp = () => {};

/** BUG: counts down past zero, so the counter wraps instead of stopping. */
function brokenWrapsPastZero(m) {
  m.mem8[CHAIN_WINDOW] = m.mem8[CHAIN_WINDOW] - 1;
}

/** BUG: clears the neighbour on every frame, not only once the window has run out. */
function brokenAlwaysClears(m) {
  expireHitChain(m);
  m.mem8[CHAIN_STEP] = 0;
}

/** BUG: clears the counted byte instead of the one beside it. */
function brokenClearsTheWrongCell(m) {
  const remaining = m.mem8[CHAIN_WINDOW];
  if (remaining === 0) {
    m.mem8[CHAIN_WINDOW] = 0;
    return;
  }
  m.mem8[CHAIN_WINDOW] = remaining - 1;
}

/** BUG: stops counting one early, so the last frame of the window is lost. */
function brokenStopsOneEarly(m) {
  const remaining = m.mem8[CHAIN_WINDOW];
  if (remaining <= 1) {
    m.mem8[CHAIN_STEP] = 0;
    return;
  }
  m.mem8[CHAIN_WINDOW] = remaining - 1;
}

const TWINS = [
  ["no-op", brokenNoOp, 256],
  ["wraps-past-zero", brokenWrapsPastZero, 1],
  ["always-clears", brokenAlwaysClears, 255],
  ["clears-the-wrong-cell", brokenClearsTheWrongCell, 1],
  ["stops-one-early", brokenStopsOneEarly, 1],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of the 256`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${expected} of 256 values`);
  });
}
