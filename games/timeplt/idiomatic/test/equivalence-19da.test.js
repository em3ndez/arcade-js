// SPDX-License-Identifier: GPL-3.0-only
/**
 * checkTheCopyrightLineColoursOrDerail — memory-equivalent to the frozen oracle at ROM 0x19DA.
 *
 * GATE: every dispatch of both sessions; an exhaustive crafted sweep of all thirteen cells over all
 *   256 colour values; a two-bad-cells sweep that pins WHICH cell ends the walk; a boundary probe on
 *   the derail that compares the registers handed over; both real callers run end to end with the
 *   rewrite seamed in; a whole-session swap; and a bench of broken twins with measured catch counts.
 *
 * ★ THE DERAIL IS THE HALF THAT NEEDS AN INSTRUMENT, AND IT HAS ONE. The transfer out of this
 *   routine reads what the walk left in the registers, so "memory-equivalent" is not the whole
 *   contract here — the ARGUMENTS matter. Two arms cover it. HANDOFF replaces the destination with
 *   a probe that records A, HL, B, DE, D, C and SP and returns, and compares those recordings
 *   between oracle and rewrite; four twins exist purely to prove that arm can fail. RAW DERAIL then
 *   lets the real destination run and shows the two sides fail in the same place with the same
 *   message, so the probe is not the only evidence.
 *
 * ★ WHY THE REAL DESTINATION CANNOT SIMPLY BE RUN. Followed for real it reaches a `call` into
 *   unmapped address space, which this port raises on rather than emulating. That is a property of
 *   the destination and not of this entry: RAW DERAIL asserts oracle and rewrite raise IDENTICALLY
 *   rather than swallowing it, and HANDOFF is what compares the arguments that got them there.
 *
 * ★ THE CORPUS PRESENTS ONE COLOUR AND ONE PATH. Measured: at every dispatch of both sessions all
 *   thirteen cells read 0x10, so the taped evidence covers the clean walk and NOTHING of the
 *   derail. Every derail arm below is crafted, and CRAFTED-MATTERS records that the corpus alone
 *   passes a twin that never derails at all.
 *
 * ★ THE CLEAN PATH'S REGISTERS ARE DEAD, AND THAT IS MEASURED RATHER THAN ASSUMED. The rewrite
 *   leaves A, B, HL where it found them on a clean walk and the oracle does not; CONTINUATION runs
 *   both real callers to completion with the rewrite seamed in over the registry and finds no
 *   difference in memory OR in any register, which is what licenses those four sitting in the
 *   ceiling.
 *
 * What it exercises, holes stated:
 *   1. WINDOW — the oracle's stack footprint, measured, and pinned at zero: nothing is masked.
 *   2. CORPUS — every dispatch of both sessions, whole-dump identical.
 *   3. NOT VACUOUS — a candidate that does nothing fails on a crafted derail.
 *   4. EXCLUDED — no register outside the measured ceiling moves, with a control twin.
 *   5. EXHAUSTIVE — thirteen cells by 256 colours, derail and clean walk alike.
 *   6. FIRST BAD CELL — two bad cells at once; the walk must stop at the nearer one.
 *   7. HANDOFF — the registers the derail is handed, compared cell by cell.
 *   8. RAW DERAIL — the real destination, raising identically on both sides.
 *   9. CONTINUATION — both real callers run whole with the rewrite seamed in.
 *  10. SESSION — a whole session swapped, differing only inside the measured stack band.
 *  11. CRAFTED-MATTERS — the twin the corpus alone cannot see.
 *  12. TEETH — a bench of broken twins, each with its measured catch counts.
 *
 * HOLE: the derail's own effects are never compared. HANDOFF stops at the boundary by design and
 * RAW DERAIL stops where the port raises, so everything the destination writes is outside this gate.
 * HOLE: no tape reaches the derail, so its arms rest entirely on crafted colour values.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-19da.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { checkTheCopyrightLineColoursOrDerail } from "../checkTheCopyrightLineColoursOrDerail.js";
import { loc_19da as oracle } from "../../translated/loc_19da.js";
import { loc_176a as caller176a } from "../../translated/loc_176a.js";
import { loc_178c as caller178c } from "../../translated/loc_178c.js";
import { withOmittedRet } from "../../machine.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x19da;
const FRAMES = 3200;
const DISPATCHES = 2;

/** Derived here independently of the module, so an edit to its constants cannot pass unnoticed. */
const FIRST_CELL = 0xa2bc;
const CELLS = 13;
const STRIDE_BACK = 0xffe0;
const EITHER_COLOUR = [0x10, 0x05];
const DERAIL = 0x49fa;
const WALK = Array.from({ length: CELLS }, (_u, i) => (FIRST_CELL + i * STRIDE_BACK) & 0xffff);

/** Measured by the WINDOW arm: this oracle pushes nothing, so nothing is masked anywhere here. */
const SCRATCH_BYTES = 0;

/**
 * The ceiling on register divergence on the CLEAN walk, measured over the corpus and the sweep.
 *   a — the oracle leaves the last colour it compared in A; the rewrite keeps it in a local.
 *   f — the comparisons and the counter's decrements set flags nothing reads.
 *   b — the oracle counts the walk down in B; the rewrite counts in a local.
 *   h,l — the oracle walks HL across the cells; the rewrite indexes from a base.
 *   sp — the oracle takes its own return and the rewrite leaves that to the seam.
 * CONTINUATION is what makes this safe rather than merely declared: both real callers run to
 * completion with the rewrite in place and no register survives to be read.
 * A ceiling, not a demand — a rewrite that diverged on fewer of these still passes.
 */
const MOVED = ["a", "f", "b", "h", "l", "sp"];

const VALUES = 256;
const STACK_SEAT = 0xb000;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
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

/**
 * Run `body` with the derail destination replaced by a probe that records what it was handed and
 * returns without doing it. Everything past the boundary is out of scope; the arguments are not.
 */
function throughProbe(body, machine) {
  const c = machine.clone();
  c.routines = new Map(c.routines);
  let handed = null;
  c.routines.set(DERAIL, (mm) => {
    const { a, hl, b, de, d, c: cReg, sp } = mm.regs;
    handed = { a, hl, b, de, d, c: cReg, sp };
  });
  body(c);
  return { machine: c, handed };
}

/** Oracle vs candidate on independent clones, stopping at the derail boundary. */
function unitDiff(candidate, machine) {
  let a;
  let b;
  try {
    a = throughProbe(oracle, machine);
    b = throughProbe(candidate, machine);
  } catch (e) {
    // A JavaScript fault is a bug in THIS file, not a divergence — swallowing one reports a
    // broken twin as a caught twin. Only a machine-level raise counts as an outcome here.
    if (e instanceof ReferenceError || e instanceof TypeError) throw e;
    return { addr: null, a: "ran", b: String(e).slice(0, 60) };
  }
  const mem = allDiffs(a.machine, b.machine).find((d) => d.addr !== null) ?? null;
  if (mem) return mem;
  const ja = JSON.stringify(a.handed);
  const jb = JSON.stringify(b.handed);
  if (ja !== jb) return { addr: null, a: ja, b: jb };
  return null;
}

/** How far below its seat the oracle's own pushes reach, on one entry state. */
function oracleDepth(machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => {
    const r = push(v);
    if (c.regs.sp < deepest) deepest = c.regs.sp;
    return r;
  };
  c.routines = new Map(c.routines);
  c.routines.set(DERAIL, () => {});
  oracle(c);
  return (seat - deepest) & 0xffff;
}

// ── the captured entries ────────────────────────────────────────────────────────────────

let captured = null;

function capture() {
  if (captured) return captured;
  const out = [];
  for (const opts of [{}, { tape: [] }]) {
    const seen = [];
    const m = makeMachine(new Map([[TARGET, (mm) => {
      seen.push(mm.clone());
      return oracle(mm);
    }]]), opts);
    const frames = m.runFrames(FRAMES);
    assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, FRAMES, "capture run ran short");
    assert.equal(seen.length, DISPATCHES, "the dispatch count moved");
    out.push(...seen);
  }
  captured = out;
  return captured;
}

function entryState() {
  const e = capture()[0] ?? null;
  assert.notEqual(e, null, "vacuous: the tape never reached the routine");
  return e;
}

/** The real entry with chosen cells forced to a chosen colour. */
function craft(cells, colour) {
  const m = entryState().clone();
  for (const index of cells) m.mem8[WALK[index]] = colour;
  return m;
}

/** Every cell, every colour: the derailing values and the two that let the walk carry on. */
function sweepCells(candidate) {
  let caught = 0;
  for (let index = 0; index < CELLS; index++) {
    for (let colour = 0; colour < VALUES; colour++) {
      if (unitDiff(candidate, craft([index], colour))) caught++;
    }
  }
  return caught;
}

/** Two bad cells at once — the walk must stop at whichever comes first. */
function sweepPairs(candidate) {
  let caught = 0;
  for (let i = 0; i < CELLS; i++) {
    for (let j = i + 1; j < CELLS; j++) {
      if (unitDiff(candidate, craft([i, j], 0xaa))) caught++;
    }
  }
  return caught;
}

const SWEEP_RUNS = { cells: CELLS * VALUES, pairs: (CELLS * (CELLS - 1)) / 2 };

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing — never derails, and the clean walk hides it. */
function brokenNoOp() {}

/** BUG: derails on every entry, whatever the colours say. */
function brokenAlwaysDerails(m) {
  m.regs.a = m.mem8[FIRST_CELL];
  m.regs.hl = FIRST_CELL;
  m.regs.b = CELLS;
  return m.call(DERAIL);
}

/** BUG: reads only the first cell and calls the line clean. */
function brokenOnlyFirstCell(m) {
  const colour = m.mem8[FIRST_CELL];
  if (EITHER_COLOUR.includes(colour)) return undefined;
  m.regs.a = colour;
  m.regs.hl = FIRST_CELL;
  m.regs.b = CELLS;
  return m.call(DERAIL);
}

/** Shared body for the twins that differ only in one parameter of the walk. */
function walker(m, { cells = CELLS, stride = STRIDE_BACK, allowed = EITHER_COLOUR, argA, argHl, argB, setDe = true }) {
  let cell = FIRST_CELL;
  for (let owed = cells; owed > 0; owed--) {
    const colour = m.mem8[cell];
    if (!allowed.includes(colour)) {
      m.regs.a = argA === undefined ? colour : argA;
      m.regs.hl = argHl === undefined ? cell : argHl;
      m.regs.b = argB === undefined ? owed : argB;
      return m.call(DERAIL);
    }
    if (setDe) m.regs.de = stride;
    cell = (cell + stride) & 0xffff;
  }
  return undefined;
}

/** BUG: walks forward along the line instead of back. */
const brokenWalksForward = (m) => walker(m, { stride: 0x0020 });
/** BUG: reads one cell too few. */
const brokenTwelveCells = (m) => walker(m, { cells: CELLS - 1 });
/** BUG: reads one cell too many. */
const brokenFourteenCells = (m) => walker(m, { cells: CELLS + 1 });
/** BUG: admits a third colour. */
const brokenExtraColour = (m) => walker(m, { allowed: [...EITHER_COLOUR, 0x00] });
/** BUG: admits only one of the two colours. */
const brokenOneColour = (m) => walker(m, { allowed: [EITHER_COLOUR[0]] });
/** BUG: hands the derail the head of the line instead of the offending cell. */
const brokenWrongCellHandedOver = (m) => walker(m, { argHl: FIRST_CELL });
/** BUG: hands the derail a count that never counted. */
const brokenWrongCountHandedOver = (m) => walker(m, { argB: CELLS });
/** BUG: hands the derail a cleared accumulator instead of the offending colour. */
const brokenWrongColourHandedOver = (m) => walker(m, { argA: 0 });
/** BUG: never lays down the stride, so the derail is handed whatever DE arrived holding. */
const brokenNoStride = (m) => walker(m, { setDe: false });

/** BUG: scribbles on an index register — the in-arm control for the register ceiling. */
function brokenMovesIndex(m) {
  checkTheCopyrightLineColoursOrDerail(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

/** Each twin's exact catch counts over the two sweeps. Measured; a move is a finding. */
const TWINS = [
  ["no-op", brokenNoOp],
  ["always-derails", brokenAlwaysDerails],
  ["only-first-cell", brokenOnlyFirstCell],
  ["walks-forward", brokenWalksForward],
  ["twelve-cells", brokenTwelveCells],
  ["fourteen-cells", brokenFourteenCells],
  ["extra-colour", brokenExtraColour],
  ["one-colour", brokenOneColour],
  ["wrong-cell-handed-over", brokenWrongCellHandedOver],
  ["wrong-count-handed-over", brokenWrongCountHandedOver],
  ["wrong-colour-handed-over", brokenWrongColourHandedOver],
  ["no-stride", brokenNoStride],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("WINDOW: the oracle pushes nothing, measured over corpus and sweep", { skip }, () => {
  let deepest = 0;
  for (const e of capture()) deepest = Math.max(deepest, oracleDepth(e));
  for (let index = 0; index < CELLS; index++) {
    deepest = Math.max(deepest, oracleDepth(craft([index], 0xaa)));
  }
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat, so the ` +
    "whole dump is compared with nothing masked");
  assert.equal(deepest, SCRATCH_BYTES, "the oracle now pushes, so a masked window is owed and " +
    "every arm here is comparing bytes it has no right to");
});

test("CORPUS: every dispatch of both sessions replays identically", { skip }, () => {
  const entries = capture();
  const colours = new Set();
  for (const e of entries) {
    for (const cell of WALK) colours.add(e.mem8[cell]);
    const d = unitDiff(checkTheCopyrightLineColoursOrDerail, e);
    assert.equal(d, null, show(d));
  }
  console.log(`  CORPUS: ${entries.length} dispatches identical; the colours present across all ` +
    `${CELLS} cells are ${[...colours].map((v) => hex4(v).slice(4)).join(", ")}`);
});

test("NOT VACUOUS: a no-op candidate FAILS on a crafted derail", { skip }, () => {
  const d = unitDiff(brokenNoOp, craft([0], 0xaa));
  assert.notEqual(d, null, "the comparison passed a candidate that does nothing");
  console.log(`  NOT VACUOUS: the empty candidate is caught — oracle=${d.a} candidate=${d.b}`);
});

/** Which registers a candidate parts company with the oracle on, over corpus and sweep. */
function movedOver(candidate) {
  const moved = new Set();
  const machines = [...capture(), ...WALK.map((_u, i) => craft([i], 0x05))];
  for (const machine of machines) {
    const a = throughProbe(oracle, machine).machine;
    let b;
    try {
      b = throughProbe(candidate, machine).machine;
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const moved = movedOver(checkTheCopyrightLineColoursOrDerail);
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that scribbles on an " +
      "index register, so a clean reading below proves nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}; the control twin also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  // A CEILING, not a demand: deepEqual against MOVED would go RED on a rewrite that became
  // register-exact, which is a gate refusing the fix.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register diverged outside the excluded set");
});

test("EXHAUSTIVE: thirteen cells by 256 colours", { skip }, () => {
  assert.equal(sweepCells(checkTheCopyrightLineColoursOrDerail), 0, "a cell-and-colour combination diverged");
  let derailed = 0;
  for (let index = 0; index < CELLS; index++) {
    for (let colour = 0; colour < VALUES; colour++) {
      if (throughProbe(oracle, craft([index], colour)).handed !== null) derailed++;
    }
  }
  assert.ok(derailed > 0 && derailed < SWEEP_RUNS.cells,
    "the sweep is one-sided: it reaches only the derail or only the clean walk, and either way it " +
      "is not the two-armed sweep this arm claims to be");
  console.log(`  EXHAUSTIVE: ${SWEEP_RUNS.cells} combinations identical; ${derailed} of them derail`);
});

test("FIRST BAD CELL: two bad cells, and the walk stops at the nearer one", { skip }, () => {
  assert.equal(sweepPairs(checkTheCopyrightLineColoursOrDerail), 0, "a two-bad-cell case diverged");
  for (let i = 0; i < CELLS; i++) {
    for (let j = i + 1; j < CELLS; j++) {
      const { handed } = throughProbe(checkTheCopyrightLineColoursOrDerail, craft([i, j], 0xaa));
      assert.equal(handed.hl, WALK[i], `with cells ${i} and ${j} bad the walk stopped at the wrong one`);
    }
  }
  console.log(`  FIRST BAD CELL: ${SWEEP_RUNS.pairs} pairs identical, every one stopping at the nearer cell`);
});

test("HANDOFF: the registers the derail is handed, compared one by one", { skip }, () => {
  const fields = ["a", "hl", "b", "de", "d", "c", "sp"];
  let compared = 0;
  for (let index = 0; index < CELLS; index++) {
    for (const colour of [0x00, 0x04, 0x06, 0x11, 0x8f, 0xff]) {
      const m = craft([index], colour);
      const a = throughProbe(oracle, m).handed;
      const b = throughProbe(checkTheCopyrightLineColoursOrDerail, m).handed;
      assert.notEqual(a, null, "this crafted colour does not derail, so the arm measures nothing");
      for (const f of fields) assert.equal(b[f], a[f], `${f} handed to the derail differs at cell ${index}`);
      compared++;
    }
  }
  const sample = throughProbe(checkTheCopyrightLineColoursOrDerail, craft([3], 0xaa)).handed;
  console.log(`  HANDOFF: ${compared} derails, ${fields.length} registers each; at cell 3 the ` +
    `derail is handed a=${hex4(sample.a).slice(2)} hl=${hex4(sample.hl)} b=${sample.b} de=${hex4(sample.de)}`);
});

test("RAW DERAIL: the real destination, raising identically on both sides", { skip }, () => {
  let compared = 0;
  for (const index of [0, 1, 6, 12]) {
    const m = craft([index], 0xaa);
    const a = m.clone();
    const b = m.clone();
    let ea = null;
    let eb = null;
    try {
      oracle(a);
    } catch (e) {
      ea = String(e);
    }
    try {
      checkTheCopyrightLineColoursOrDerail(b);
    } catch (e) {
      eb = String(e);
    }
    assert.equal(eb, ea, `the two sides part company on the real derail at cell ${index}`);
    assert.deepEqual(allDiffs(a, b), [], `the state at the raise differs at cell ${index}`);
    compared++;
    if (index === 0) {
      console.log(`  RAW DERAIL: ${ea === null ? "both ran to completion" : `both raise "${ea.slice(0, 96)}"`}`);
    }
  }
  console.log(`  RAW DERAIL: ${compared} cells, identical outcome and identical state at the raise`);
});

test("CONTINUATION: both real callers run whole with the rewrite seamed in", { skip }, () => {
  const callers = [["176a", 0x176a, caller176a], ["178c", 0x178c, caller178c]];
  const counts = [];
  for (const [label, addr, body] of callers) {
    const entries = [];
    const host = makeMachine(new Map([[addr, (mm) => {
      entries.push(mm.clone());
      return body(mm);
    }]]), { tape: [] });
    host.runFrames(FRAMES);
    assert.ok(entries.length > 0, `vacuous: ${label} was never dispatched, so this arm ran nothing`);
    for (const e of entries) {
      const a = e.clone();
      const b = e.clone();
      b.routines = new Map(b.routines);
      b.routines.set(TARGET, withOmittedRet(checkTheCopyrightLineColoursOrDerail, TARGET));
      body(a);
      body(b);
      assert.deepEqual(allDiffs(a, b), [], `${label} parted company with the rewrite seamed in`);
      const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
      assert.deepEqual(moved, [], `${label} left a register different, so the clean walk's registers ` +
        "are NOT dead after all and the ceiling above is wrong");
    }
    counts.push(`${label}: ${entries.length}`);
  }
  console.log(`  CONTINUATION: ${counts.join(", ")} dispatches, memory and every register identical`);
});

test("SESSION: a whole session swapped, differing only inside the measured stack band", { skip }, () => {
  const run = (fn) => {
    const m = makeMachine(fn ? new Map([[TARGET, withOmittedRet(fn, TARGET)]]) : null, { tape: [] });
    let deepest = STACK_SEAT;
    const push = m.push16.bind(m);
    m.push16 = (v) => {
      const r = push(v);
      if (m.regs.sp < deepest) deepest = m.regs.sp;
      return r;
    };
    return { frames: m.runFrames(FRAMES), deepest, m };
  };
  const differing = (base, swap) => {
    const out = new Set();
    for (let i = 0; i < base.frames.length; i++) {
      const x = base.frames[i];
      const y = swap.frames[i];
      for (let j = 0; j < x.length; j++) if (x[j] !== y[j]) out.add(base.m.stateOffsetToAddr(j));
    }
    return [...out];
  };
  // The control changes ONE byte of the line it guards, on each dispatch: the smallest thing a
  // wrong rewrite could do that the stack band must not be able to swallow.
  const scribbler = (m) => {
    checkTheCopyrightLineColoursOrDerail(m);
    m.mem8[WALK[0]] = m.mem8[WALK[0]] ^ 0x01;
  };
  const base = run(null);
  const swap = run(checkTheCopyrightLineColoursOrDerail);
  const floor = Math.min(base.deepest, swap.deepest);
  const inBand = (a) => a >= floor && a < STACK_SEAT;
  const ours = differing(base, swap);
  const control = differing(base, run(scribbler));
  console.log(`  SESSION: ${FRAMES} frames, stack band [${hex4(floor)}, ${hex4(STACK_SEAT)}); the ` +
    `rewrite differs at ${ours.length} address(es), all inside it; the control twin differs at ` +
    `${control.length}, ${control.filter((a) => !inBand(a)).length} of them outside`);
  // The band is only evidence if something can escape it. A twin that accepts a third colour
  // changes what the line-guard does, and that has to show up outside the stack.
  assert.ok(control.some((a) => !inBand(a)),
    "a twin that changes one byte of the guarded line differs nowhere outside the stack band " +
      "either, so this arm cannot tell a transparent swap from a broken one");
  assert.deepEqual(ours.filter((a) => !inBand(a)).map(hex4), [],
    "the swapped session differs outside the stack band");
  assert.equal(swap.m.regs.sp, base.m.regs.sp, "the swapped session left the stack somewhere else");
});

test("CRAFTED-MATTERS: the corpus alone cannot see the derail", { skip }, () => {
  const blind = capture().every((e) => unitDiff(brokenNoOp, e) === null);
  const caught = unitDiff(brokenNoOp, craft([0], 0xaa)) !== null;
  console.log("  CRAFTED-MATTERS: a candidate that never derails is invisible at every real " +
    "dispatch and caught at once on a crafted bad colour");
  assert.ok(blind, "the do-nothing twin is ALREADY caught at a real dispatch, so the corpus has " +
    "started reaching the derail — re-measure rather than deleting this arm");
  assert.ok(caught, "the do-nothing twin is not caught on a crafted derail either, so the crafted " +
    "arms are not buying what this says they buy");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const cells = sweepCells(twin);
    const pairs = sweepPairs(twin);
    console.log(`  TEETH/${label}: caught on ${cells}/${SWEEP_RUNS.cells} cell-colour combinations, ` +
      `${pairs}/${SWEEP_RUNS.pairs} pairs`);
    assert.ok(cells + pairs > 0, `both sweeps PASSED the ${label} twin`);
  });
}
