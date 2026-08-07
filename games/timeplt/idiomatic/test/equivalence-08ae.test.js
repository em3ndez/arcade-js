// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectFoldBlock — memory-equivalent to the frozen oracle at ROM 0x08AE.
 *
 * ★ THE RAM ARM IS VACUOUS HERE, AND THAT IS ASSERTED RATHER THAN GLOSSED. Two instructions,
 *   both register loads: the routine writes NO memory at all. So "the state dump is identical"
 *   is true of a candidate that does nothing, and the whole gate has to rest on the two
 *   registers the routine leaves behind. Arm 2 proves the write-set is empty by running the
 *   ORACLE over a whole state dump and asserting nothing moved, so the emptiness is measured
 *   rather than argued, and arm 3 shows a no-op passing the RAM comparison.
 *
 * GATE: real capture (undriven attract only), plus a crafted sweep over the priors the two
 *   registers can arrive holding. What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — RAM identical, and the start/length pair identical too.
 *   2. THE WRITE-SET IS EMPTY — measured on the oracle.
 *   3. NOT VACUOUS ON THE PAIR — a no-op passes RAM and fails the pair.
 *   4. THE SHARED TAPE NEVER REACHES IT — asserted, so "one dispatch" is known to be the
 *      attract one and not a coincidence of budget.
 *   5. PRIORS — the pair forced to a spread of incoming values, including the ones the routine
 *      itself chooses, so a candidate that only works from an empty register file is caught.
 *   6. TEETH — five twins over the two things this entry decides.
 *
 * HOLE: ONE real dispatch, in attract, and nothing here says what consumes the pair. The
 * address it names is inside the program image and this file claims nothing about what is
 * there; a candidate that named a different block of the same length would be caught by arm 6
 * and by nothing else.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-08ae.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { selectFoldBlock } from "../selectFoldBlock.js";
import { loc_08ae as oracle } from "../../translated/loc_08ae.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x08ae;

/** The pair this entry exists to choose. */
const BLOCK_START = 0x335e;
const BLOCK_BYTES = 30;

/** Measured: the shared coin -> start tape never gets here; undriven attract does, once. */
const DISPATCHES = { shared: 0, attract: 1 };
const TAPES = [["shared", {}], ["attract", { tape: [] }]];

const EXCLUDED = ["sp"];

const skip = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

function firstDiff(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

let corpusCache = null;

/** Every dispatch of both sessions, cloned. This entry fires rarely, so nothing is sampled away. */
function corpus() {
  if (corpusCache) return corpusCache;
  corpusCache = TAPES.map(([label, opts]) => {
    const states = [];
    const host = makeMachine(new Map([[TARGET, (mm) => (states.push(mm.clone()), oracle(mm))]]), opts);
    const frames = host.runFrames(ENTRY_FRAMES);
    assert.equal(host.stoppedBy, null, `the ${label} session stopped early: ${host.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, `the ${label} session ran short`);
    return { label, states };
  });
  return corpusCache;
}

function theOneEntry() {
  const attract = corpus().find((s) => s.label === "attract");
  assert.ok(attract.states.length > 0, "vacuous: the attract session never reached the routine");
  return attract.states[0];
}

/** Oracle against candidate on clones of one machine: RAM first, then the pair. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = firstDiff(a, b);
  if (ram) return ram;
  if (a.regs.hl !== b.regs.hl) return { addr: null, a: a.regs.hl, b: b.regs.hl };
  if (a.regs.b !== b.regs.b) return { addr: null, a: a.regs.b, b: b.regs.b };
  return null;
}

/** A real captured machine with the two registers forced to a chosen prior. */
function craft(hl, b) {
  const m = theOneEntry().clone();
  m.regs.hl = hl;
  m.regs.b = b;
  return m;
}

const PRIOR_POINTERS = [0x0000, 0xffff, BLOCK_START, BLOCK_START + 1, 0xa800, 0x4b95];
const PRIOR_COUNTS = [0, 1, BLOCK_BYTES, BLOCK_BYTES + 1, 255];
const SWEEP_SIZE = PRIOR_POINTERS.length * PRIOR_COUNTS.length;

function sweepCaught(candidate) {
  let caught = 0;
  for (const hl of PRIOR_POINTERS) {
    for (const b of PRIOR_COUNTS) if (unitDiff(candidate, craft(hl, b))) caught++;
  }
  return caught;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: selectFoldBlock == oracle on RAM and on the pair", { skip }, () => {
  const entry = theOneEntry();
  assert.equal(unitDiff(selectFoldBlock, entry), null, "the rewrite diverged at the one real dispatch");

  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  selectFoldBlock(b);
  assert.equal(a.regs.hl, BLOCK_START, "the oracle no longer names the block this file names");
  assert.equal(a.regs.b, BLOCK_BYTES, "the oracle no longer takes the length this file takes");
  assert.deepEqual(REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]), EXCLUDED,
    "only the stack pointer may differ: the oracle returns and the rewrite does not");
  console.log(`  EQUAL: one dispatch; names ${hex4(BLOCK_START)} for ${BLOCK_BYTES} bytes`);
});

test("THE WRITE-SET IS EMPTY: the oracle moves no byte of the state dump", { skip }, () => {
  const before = theOneEntry().clone();
  const after = before.clone();
  oracle(after);
  assert.equal(firstDiff(before, after), null,
    "the oracle DOES write memory, so the RAM comparison is load-bearing after all and this " +
      "file's account of why it rests on the registers has to be re-derived");
  console.log("  WRITE-SET: empty — RAM cannot be this gate");
});

test("NOT VACUOUS ON THE PAIR: a no-op passes RAM and is caught on the registers", { skip }, () => {
  const entry = theOneEntry();
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  brokenNoOp(b);
  assert.equal(firstDiff(a, b), null, "a no-op was expected to pass the RAM comparison here");
  const d = unitDiff(brokenNoOp, entry);
  assert.notEqual(d, null, "the no-op passed the whole comparison — this gate has no teeth");
  assert.equal(d.addr, null, "the no-op must be caught on the pair, not on a cell");
  console.log(`  NOT VACUOUS: RAM says identical, the pair says ${show(d)}`);
});

test("THE SHARED TAPE NEVER REACHES IT, so the one dispatch is the attract one", { skip }, () => {
  for (const s of corpus()) {
    assert.equal(s.states.length, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
  }
  console.log(`  REACH: shared ${DISPATCHES.shared}, attract ${DISPATCHES.attract} dispatches`);
});

test("PRIORS: whatever the pair arrives holding, it comes out the same", { skip }, () => {
  for (const hl of PRIOR_POINTERS) {
    for (const b of PRIOR_COUNTS) {
      const d = unitDiff(selectFoldBlock, craft(hl, b));
      assert.equal(d, null, `prior ${hex4(hl)}/${b}: ${show(d)}`);
    }
  }
  console.log(`  PRIORS: ${SWEEP_SIZE} incoming pairs overridden identically`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all, so a caller keeps whatever it was holding. */
function brokenNoOp() {}

/** BUG: names the byte after the block, which is the smallest wrong block there is. */
function brokenStartOffByOne(m) {
  m.regs.hl = BLOCK_START + 1;
  m.regs.b = BLOCK_BYTES;
}

/** BUG: takes one byte too few. */
function brokenLengthOffByOne(m) {
  m.regs.hl = BLOCK_START;
  m.regs.b = BLOCK_BYTES - 1;
}

/** BUG: sets the start and leaves the length to whatever the caller had. */
function brokenLengthOmitted(m) {
  m.regs.hl = BLOCK_START;
}

/** BUG: sets the length and leaves the start to whatever the caller had. */
function brokenStartOmitted(m) {
  m.regs.b = BLOCK_BYTES;
}

const TWINS = [
  ["no-op", brokenNoOp, SWEEP_SIZE - 1],
  ["start-off-by-one", brokenStartOffByOne, SWEEP_SIZE],
  ["length-off-by-one", brokenLengthOffByOne, SWEEP_SIZE],
  ["length-omitted", brokenLengthOmitted, SWEEP_SIZE - PRIOR_POINTERS.length],
  ["start-omitted", brokenStartOmitted, SWEEP_SIZE - PRIOR_COUNTS.length],
];

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of priors`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected,
      `the ${label} twin's catch count moved: a twin caught on the WRONG set of priors is as ` +
        "much a finding as one not caught at all");
    console.log(`  TEETH/${label}: caught on ${expected} of ${SWEEP_SIZE} priors`);
  });
}
