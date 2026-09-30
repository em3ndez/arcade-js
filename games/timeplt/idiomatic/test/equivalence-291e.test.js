// SPDX-License-Identifier: GPL-3.0-only
/**
 * foldBlockIntoTotal — memory-equivalent to the frozen oracle at ROM 0x291E.
 *
 * GATE: strict unit-capture plus a crafted sweep over all four arguments plus teeth. What it
 *   exercises, holes stated:
 *
 *   1. ★ RAM IS NOT THE GATE HERE. The routine writes nothing, so a RAM comparison passes a
 *      candidate that does nothing at all. The contract is the returned total, also left in the
 *      accumulator for a caller that reaches the routine by address. The "not vacuous" arm proves
 *      the RAM-only reading is empty.
 *   2. EQUAL at the real dispatch.
 *   3. EXCLUDED, deliberately: the flag byte, the stack pointer, and everything else the oracle
 *      leaves in registers — the last byte the second walk read, both pointers, and the spent
 *      count. The stack pointer because the oracle returns and the rewrite does not; the flag byte
 *      because the last addition's flags are a by-product; the rest because nothing after the
 *      call reads them, which arm 6 MEASURES off the oracle. This asserts no more than those move.
 *   4. CORPUS — every dispatch of a driven session and of the undriven attract demo. ★ THIS ENTRY
 *      IS REACHED ONLY BY THE UNDRIVEN DEMO, once, and the driven tape misses it entirely: the
 *      corpus arm asserts BOTH of those, so a change in either is a finding.
 *   5. CRAFTED — a sweep over starting totals, lengths, and both pointers independently, which is
 *      what separates the two walks from each other. It reaches the zero-length case, where a
 *      count of zero means a full 256 bytes rather than none, and the case where the two pointers
 *      are the same, which no real dispatch presents.
 *   6. ★ THE SECOND WALK'S RESULT IS DISCARDED, AND THAT IS MEASURED. The oracle leaves the last
 *      byte the second walk read, both pointers and the spent count in registers; a whole
 *      undriven session with every one of them forced hostile behind the oracle's one dispatch is
 *      bit-identical to the clean run, and a tooth beside it — the returned total nudged — forks
 *      the run, so the instrument reaches what the routine hands back. (MAME agrees: the
 *      routine's grounding flipped the byte the second walk left behind and moved no RAM
 *      signature.) So the twins that only mis-walk the second pointer are NOT bugs any more, and
 *      arm 8 pins that they pass.
 *   7. TEETH — the twins that break the total, with their exact crafted catch counts.
 *   8. HARMLESS — the second-walk twins, pinned at zero catches.
 *
 * HOLE: one real dispatch, on one argument set. Everything discriminating here is crafted.
 * HOLE: the shared unit harness is NOT used, because it always arms the coin-and-start tape and
 * this entry is never reached under it. The capture is done by hand off the undriven demo, so
 * whatever the shared harness would have checked beyond the entry state is not checked here.
 * HOLE: the crafted entries poke registers only. No arm varies the bytes being walked, so a twin
 * that read the right bytes from the wrong plane of memory would not be caught by construction.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-291e.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { foldBlockIntoTotal } from "../foldBlockIntoTotal.js";
import { loc_291e as oracle } from "../../translated/loc_291e.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TARGET = 0x291e;
const EXCLUDED = ["f", "sp"];
const CORPUS_FRAMES = 2500;

/** The one real argument set, measured and asserted by the corpus arm. */
const REAL_SUM_FROM = 0x335e;
const REAL_WALK_FROM = 0x17b9;
const REAL_LENGTH = 0x1e;
const REAL_RUNNING = 0x00;

const TAPES = [
  ["driven", {}],
  ["attract", { tape: [] }],
];
const DISPATCHES = { driven: 0, attract: 1 };

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

let entry = null;

/**
 * The entry is captured by hand off the UNDRIVEN demo rather than through the shared unit
 * harness, because that harness always arms the coin-and-start tape and this entry is never
 * reached under it. Everything else about the capture is the same: the host game runs
 * undisturbed and the candidate arms work on clones of the state at the real dispatch.
 */
function entryState() {
  if (entry === null) {
    const host = makeMachine(
      new Map([[TARGET, (mm) => {
        if (entry === null) entry = mm.clone();
        return oracle(mm);
      }]]),
      { tape: [] },
    );
    host.runFrames(CORPUS_FRAMES);
  }
  return entry;
}

/** The registers the oracle leaves that nothing after the call reads (measured, arm 6). */
const DISCARDED = ["b", "c", "d", "e", "h", "l"];

/** RAM, then the total left in the accumulator, then the returned total. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  const returned = candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  if (a.regs.a !== b.regs.a) return { addr: null, reg: "a", a: a.regs.a, b: b.regs.a };
  if (returned !== a.regs.a) return { addr: null, reg: "return", a: a.regs.a, b: returned };
  return null;
}

function craft({ running, sumFrom, walkFrom, length }) {
  const m = entryState().clone();
  m.regs.a = running ?? REAL_RUNNING;
  m.regs.hl = sumFrom ?? REAL_SUM_FROM;
  m.regs.de = walkFrom ?? REAL_WALK_FROM;
  m.regs.b = length ?? REAL_LENGTH;
  return m;
}

/**
 * Every crafted entry, built so each argument varies on its own: the starting total decides the
 * result alone, the two pointers are moved independently so a rewrite that confused them is
 * caught, and the length sweep reaches the zero-means-256 case.
 */
const CRAFTED = [
  ...[0, 1, 0x55, 0x80, 0xaa, 0xff].map((running) => ({ running })),
  ...[0, 1, 2, 29, 30, 31, 64, 200, 255].map((length) => ({ length })),
  ...[0x0000, 0x0b06, 0x335e, 0x4980, 0x5fff].map((sumFrom) => ({ sumFrom })),
  ...[0x0000, 0x086b, 0x17b9, 0x4980, 0x5fff].map((walkFrom) => ({ walkFrom })),
  { sumFrom: REAL_WALK_FROM, walkFrom: REAL_SUM_FROM },
  { sumFrom: REAL_SUM_FROM, walkFrom: REAL_SUM_FROM },
  { running: 0xff, length: 0, sumFrom: 0x4000, walkFrom: 0x4100 },
];

function sweepCaught(candidate) {
  let caught = 0;
  for (const args of CRAFTED) if (unitDiff(candidate, craft(args))) caught++;
  return caught;
}

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const args = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      args.add(`${mm.regs.a}/${hex4(mm.regs.hl)}/${hex4(mm.regs.de)}/${mm.regs.b}`);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, args };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, foldBlockIntoTotal) }));
  }
  return sessionCache;
}

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: starts the total from nothing instead of continuing the caller's. */
function brokenIgnoresStartingTotal(m) {
  return loop(m, 0, m.regs.hl, m.regs.de, m.regs.b, true);
}

/** BUG: skips the second walk, so the byte it would have left behind is stale. */
function brokenSkipsSecondWalk(m) {
  const { regs } = m;
  const run = regs.b === 0 ? 256 : regs.b;
  return loop(m, regs.a, regs.hl, regs.de, regs.b, false, run);
}

/** BUG: adds from the SECOND pointer, so the two walks are the wrong way round. */
function brokenSumsTheOtherWalk(m) {
  const { regs } = m;
  return loop(m, regs.a, regs.de, regs.hl, regs.b, true);
}

/** BUG: keeps the FIRST byte the second walk read rather than the last. */
function brokenKeepsFirstNotLast(m) {
  const { regs, mem8 } = m;
  const run = regs.b === 0 ? 256 : regs.b;
  let total = regs.a;
  for (let i = 0; i < run; i++) total = (total + mem8[(regs.hl + i) & 0xffff]) & 0xff;
  regs.c = mem8[regs.de & 0xffff];
  regs.a = total;
  regs.hl = (regs.hl + run) & 0xffff;
  regs.de = (regs.de + run) & 0xffff;
  regs.b = 0;
  return total;
}

/** BUG: reads a length of zero as no bytes at all rather than as a full 256. */
function brokenZeroMeansNone(m) {
  const { regs } = m;
  return loop(m, regs.a, regs.hl, regs.de, regs.b, true, regs.b);
}

/** Shared body for the twins, so each differs from the others in exactly one way. */
function loop(m, start, sumFrom, walkFrom, length, walkToo, runOverride) {
  const { regs, mem8 } = m;
  const run = runOverride ?? (length === 0 ? 256 : length);
  let total = start;
  let last = regs.c;
  for (let i = 0; i < run; i++) {
    total = (total + mem8[(sumFrom + i) & 0xffff]) & 0xff;
    if (walkToo) last = mem8[(walkFrom + i) & 0xffff];
  }
  regs.a = total;
  regs.c = last;
  regs.hl = (sumFrom + run) & 0xffff;
  regs.de = (walkFrom + run) & 0xffff;
  regs.b = 0;
  return total;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["ignores-starting-total", brokenIgnoresStartingTotal],
  ["sums-the-other-walk", brokenSumsTheOtherWalk],
  ["zero-means-none", brokenZeroMeansNone],
];

/** Twins that only mis-walk the second pointer: what they get wrong is discarded (arm 6). */
const HARMLESS = [
  ["skips-second-walk", brokenSkipsSecondWalk],
  ["keeps-first-not-last", brokenKeepsFirstNotLast],
];

/** Measured catch counts. Each is asserted exactly, so a twin caught on a different set fails. */
const CAUGHT = {
  "no-op": 28,
  "ignores-starting-total": 6,
  // measured: the swap gives the same total on the entry pointing both walks at one block, and on
  // the one-byte run
  "sums-the-other-walk": 26,
  "zero-means-none": 2,
};

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: foldBlockIntoTotal == oracle on RAM, registers and the total", { skip }, () => {
  assert.notEqual(entryState(), null, "vacuous: no run reached the routine");
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  foldBlockIntoTotal(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(ram, null, `RAM diverged — ${show(ram)}`);
  const d = unitDiff(foldBlockIntoTotal, entryState());
  assert.equal(d, null, `the contract diverged — ${JSON.stringify(d)}`);
  console.log(
    `  EQUAL: entry total=${entryState().regs.a} sum-from=${hex4(entryState().regs.hl)} ` +
      `walk-from=${hex4(entryState().regs.de)} length=${entryState().regs.b}`,
  );
});

test("NOT VACUOUS: RAM alone passes a candidate that does nothing", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  brokenNoOp(b);
  assert.equal(
    firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    null,
    "a RAM difference appeared, so this routine DOES write memory and the register-contract " +
      "framing of this file must be re-derived",
  );
  assert.notEqual(unitDiff(brokenNoOp, entryState()), null, "the real contract must catch it");
  console.log("  NOT VACUOUS: RAM is empty here; the registers and the total are the gate");
});

test("EXCLUDED, deliberately: the flags, the stack pointer and the discarded registers, and nothing else", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  foldBlockIntoTotal(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(
    moved.filter((k) => !EXCLUDED.includes(k) && !DISCARDED.includes(k)),
    [],
    "a register outside the flags, the stack pointer and the measured-discarded set moved",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  console.log(`  EXCLUDED (measured): ${moved.join(", ")} and pc`);
});

test("CORPUS: the driven tape never reaches this entry and the demo reaches it once", { skip }, () => {
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
  }
  const demo = sessions().find((s) => s.label === "attract");
  assert.deepEqual(
    [...demo.args],
    [`${REAL_RUNNING}/${hex4(REAL_SUM_FROM)}/${hex4(REAL_WALK_FROM)}/${REAL_LENGTH}`],
    "the demo's argument set moved, so the crafted sweep is anchored to the wrong entry",
  );
  console.log(
    `  CORPUS: driven ${DISPATCHES.driven}, demo ${DISPATCHES.attract}; ${[...demo.args][0]}`,
  );
});

test("CRAFTED: every argument varied on its own behaves as the oracle behaves", { skip }, () => {
  assert.equal(sweepCaught(foldBlockIntoTotal), 0, "the rewrite diverged somewhere in the crafted space");

  const zeroOracle = craft({ length: 0 });
  const zeroRewrite = craft({ length: 0 });
  oracle(zeroOracle);
  foldBlockIntoTotal(zeroRewrite);
  assert.equal(zeroOracle.regs.hl, (REAL_SUM_FROM + 256) & 0xffff, "zero must walk a full 256");
  let full = REAL_RUNNING;
  for (let i = 0; i < 256; i++) full = (full + zeroOracle.mem8[(REAL_SUM_FROM + i) & 0xffff]) & 0xff;
  assert.equal(zeroOracle.regs.a, full, "the oracle's zero-length total is not a full 256-byte sum");
  assert.equal(zeroRewrite.regs.a, zeroOracle.regs.a, "the rewrite must sum the same full run");
  console.log(`  CRAFTED: ${CRAFTED.length} entries identical, the zero-length full run included`);
});

// ── the discarded registers, measured off the oracle ───────────────────────────────────

/** An undriven session with `after` applied behind the oracle's dispatch, every frame kept. */
function attractRun(after) {
  let fired = 0;
  const host = makeMachine(
    new Map([[TARGET, (mm) => {
      fired++;
      const r = oracle(mm);
      after(mm);
      return r;
    }]]),
    { tape: [] },
  );
  const frames = host.runFrames(CORPUS_FRAMES);
  return { frames, fired, stoppedBy: host.stoppedBy, offsetToAddr: (o) => host.stateOffsetToAddr(o) };
}

function forkedCells(base, run) {
  const cells = new Set();
  const n = Math.min(base.frames.length, run.frames.length);
  for (let i = 0; i < n; i++) {
    const x = base.frames[i];
    const y = run.frames[i];
    for (let o = 0; o < x.length; o++) if (x[o] !== y[o]) cells.add(base.offsetToAddr(o));
  }
  return [...cells];
}

test("THE DISCARDED REGISTERS: forced hostile behind the oracle's dispatch, no trace", { skip }, () => {
  const base = attractRun(() => {});
  const hostile = attractRun((mm) => {
    mm.regs.b = 0x77;
    mm.regs.c = 0x5a;
    mm.regs.de = 0x1234;
    mm.regs.hl = 0x4321;
  });
  assert.equal(hostile.stoppedBy, null, `the hostile run stopped: ${hostile.stoppedBy}`);
  assert.equal(hostile.fired, DISPATCHES.attract, "the instrument did not reach the dispatch");
  assert.deepEqual(forkedCells(base, hostile), [], "a register the rewrite discards reached game " +
    "memory, so some caller CONSUMES it and discarding it is wrong");

  // The tooth on the instrument: the total the routine hands back, nudged, forks the run.
  const control = attractRun((mm) => {
    mm.regs.a = (mm.regs.a + 1) & 0xff;
  });
  const forked = forkedCells(base, control);
  console.log(`  DISCARDED: ${hostile.fired} dispatch, no trace; the control forks ${forked.length} cells`);
  assert.ok(forked.length > 0 || control.stoppedBy !== null, "nudging the returned total also " +
    "left no trace, so the instrument reaches nothing and the arm above proves nothing");
});

for (const [label, twin] of HARMLESS) {
  test(`HARMLESS: the ${label} twin only mis-walks what is discarded, and passes`, { skip }, () => {
    assert.equal(sweepCaught(twin), 0, `the ${label} twin is caught, so the second walk reaches the contract`);
    console.log(`  HARMLESS/${label}: caught on none of ${CRAFTED.length} crafted entries`);
  });
}

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), CAUGHT[label], `the ${label} twin's crafted catch count moved`);
    assert.ok(CAUGHT[label] > 0, `the ${label} twin is caught by nothing`);
    console.log(`  TEETH/${label}: caught on ${CAUGHT[label]} of ${CRAFTED.length} crafted entries`);
  });
}
