// SPDX-License-Identifier: GPL-3.0-only
/**
 * displaceByFiveQuarters — memory-equivalent to the frozen oracle at ROM 0x2E31.
 *
 * GATE: strict unit-capture through unitEquivalence, PLUS a live-out comparison and a crafted
 *   cross that this file defines, because for THIS routine the RAM half of unitEquivalence has
 *   no teeth at all.
 *
 * ★ THE HOLE, STATED FIRST, AND IT IS TWO HOLES. 0x2E31 writes no memory: its whole effect is
 *   the register pair it leaves the advanced position in, so `r.ram === null` is true of a
 *   routine with an empty body, and the BLIND test proves that by passing a no-op through the
 *   same call. Worse, the first dispatch the shared tape reaches hands the routine a step of
 *   ZERO, which makes the scaling that is the entire point of the routine invisible right where
 *   the contract call looks; DEGENERATE pins that. The comparison every arm here is judged by is
 *   therefore `liveOutDiff` — the whole RAM dump AND the two halves of the advanced position.
 *
 * WHY ONLY THAT PAIR, derived from the CALLERS rather than from the instruction sequence. Every
 *   call site stores the two halves straight into an object record and reloads everything it
 *   needs before going on, so nothing else the routine leaves behind is read afterwards. DROPPED
 *   turns that reading into a measurement: the registers the rewrite declines to reproduce are
 *   forced to hostile values on every dispatch of a whole driven session and nothing anywhere
 *   moves, while the same experiment aimed at the position pair diverges and stays diverged.
 *   That second half is the control — without it a null result is a claim about the instrument.
 *
 * ★ THE CORPUS IS UNIFORM, AND MEASURED TO BE. The shared coin -> start tape holds one heading
 *   for its whole run, so the two scroll cells never change: every step it ever presents is
 *   non-negative AND a multiple of four. Both halves of this routine's arithmetic — the sign
 *   the shift extends, and the rounding of a quarter that does not divide — are therefore dead
 *   in that corpus. UNIFORM asserts it rather than assuming it, and REAL TRAFFIC widens to a
 *   tape that walks the stick round the compass, plus an undriven attract run, which between
 *   them do present backward steps and steps that round.
 *
 * The space is (position, step), 32 bits, too large to enumerate. FACTORISES measures the reason
 * a cross is enough: on every input tried, both arms return the step's own column plus the
 * position unchanged, so the two axes are independent and sweeping each against probes of the
 * other covers the pair. That is a measurement over the cross, not a proof over the whole space,
 * and inputs off the cross are covered only through it.
 *
 * What it exercises: EQUAL at the real dispatch; BLIND and DEGENERATE, the two holes; EXCLUDED,
 * pinning the divergent register set by name; DROPPED, with its control; FACTORISES; CROSS, the
 * enumerated sweep; UNIFORM; REAL TRAFFIC over three tapes; BUDGET; and TEETH — six twins, each
 * caught on exactly the inputs a predicate over the input names, never on a set read back off
 * the twin, plus each twin's blindness at the real dispatch re-derived from that same predicate.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2e31.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { displaceByFiveQuarters } from "../displaceByFiveQuarters.js";
import { loc_2e31 as oracle } from "../../translated/loc_2e31.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u16 } from "../../../../core/int.js";

const TARGET = 0x2e31;
const skip = romsPresent() ? false : "ROM images absent";

/** Frames for the corpus runs, file-local and longer than the entry capture. */
const CORPUS_FRAMES = 1500;

const IN0 = 0xc300;
const IN1 = 0xc320;
const COIN = 0x01;
const START = 0x08;
const LEFT = 0x01;
const RIGHT = 0x02;
const UP = 0x04;
const DOWN = 0x08;
const FIRE = 0x10;
const HOLD = 8;
const TURN_HOLD = 60;
const TURN_FIRST_FRAME = 640;

const hex4 = (v) => "0x" + u16(v).toString(16).padStart(4, "0");
const signed = (v) => (v << 16) >> 16;
const show = (d) =>
  d ? `${d.where}${d.addr === null ? "" : " " + hex4(d.addr)}: a=${d.a} b=${d.b}` : "identical";

let entry = null;

/** The contract call, with the entry state harvested off the candidate arm's clone. */
function gate(candidate) {
  return unitEquivalence(
    makeMachine,
    TARGET,
    oracle,
    (m) => {
      if (entry === null) entry = m.clone();
      return candidate(m);
    },
    { maxFrames: ENTRY_FRAMES },
  );
}

function entryState() {
  if (entry === null) gate(displaceByFiveQuarters);
  return entry;
}

/** RAM plus the two halves of the advanced position — the only registers a caller consumes. */
function liveOutDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return { where: "ram", a: ram.a, b: ram.b, addr: ram.addr };
  for (const k of ["h", "l"]) {
    if (a.regs[k] !== b.regs[k]) return { where: k, a: a.regs[k], b: b.regs[k], addr: null };
  }
  return null;
}

/** Both arms from the real entry with the step and the position forced. */
function atInput(candidate, step, position) {
  const a = entryState().clone();
  const b = entryState().clone();
  a.regs.hl = step;
  a.regs.de = position;
  b.regs.hl = step;
  b.regs.de = position;
  oracle(a);
  candidate(b);
  return liveOutDiff(a, b);
}

// The cross. One axis is enumerated while the other is held at a probe: zero, one, the position
// the real entry carries, both single-byte extremes, and both ends of the signed range.
const POSITIONS = [0, 1, 0x2000, 0x00ff, 0xff00, 0x7fff, 0x8000, 0xffff];
// Probe steps: nothing, the values either side of where a quarter first appears, one whole
// pixel, and backward steps that do and do not divide by four.
const STEPS = [0, 1, 3, 4, 0x40, 0x100, 0x7fff, 0x8000, 0xfffd, 0xffff];
const SPACE = (POSITIONS.length + STEPS.length) * 65536;

function forEachInput(visit) {
  for (const position of POSITIONS) {
    for (let step = 0; step < 65536; step++) visit(step, position);
  }
  for (const step of STEPS) {
    for (let position = 0; position < 65536; position++) visit(step, position);
  }
}

/**
 * Two machines reused across the whole cross rather than cloned a million times. Every register
 * either arm reads is rewritten each pass and the oracle's own return is undone, so no iteration
 * can leak into the next; a clone's frame machinery is already neutralised.
 */
function arena() {
  const a = entryState().clone();
  const b = entryState().clone();
  const sp = a.regs.sp;
  const pc = a.pc;
  const f = a.regs.f;
  const cycles = a.cycles;
  const put = (step, position) => {
    a.regs.hl = step;
    a.regs.de = position;
    a.regs.f = f;
    a.regs.sp = sp;
    a.pc = pc;
    a.cycles = cycles;
    b.regs.hl = step;
    b.regs.de = position;
  };
  return { a, b, put };
}

/** How many inputs of the cross the arms disagree on, plus a whole-RAM check after it. */
function sweep(candidate) {
  const { a, b, put } = arena();
  let caught = 0;
  forEachInput((step, position) => {
    put(step, position);
    oracle(a);
    candidate(b);
    if (a.regs.hl !== b.regs.hl) caught++;
  });
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { caught, ram };
}

/** How many inputs of the cross a stated predicate says a twin must be caught on. */
function predicted(pred) {
  let n = 0;
  forEachInput((step, position) => {
    if (pred(step, position)) n++;
  });
  return n;
}

/** One arm's result for every step, taken with the position at zero. */
function column(fn) {
  const { a, b, put } = arena();
  const out = new Uint16Array(65536);
  for (let step = 0; step < 65536; step++) {
    put(step, 0);
    if (fn === oracle) {
      oracle(a);
      out[step] = a.regs.hl;
    } else {
      fn(b);
      out[step] = b.regs.hl;
    }
  }
  return out;
}

/** Inputs where an arm's result is NOT its own step column plus the position. */
function factorViolations(fn, col) {
  const { a, b, put } = arena();
  let bad = 0;
  forEachInput((step, position) => {
    put(step, position);
    let got;
    if (fn === oracle) {
      oracle(a);
      got = a.regs.hl;
    } else {
      fn(b);
      got = b.regs.hl;
    }
    if (got !== u16(col[step] + position)) bad++;
  });
  return bad;
}

/** The shared tape plus the stick walked once round the compass, so the heading keeps changing. */
function turnTape() {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: COIN, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: START, dur: HOLD },
    { frame: TURN_FIRST_FRAME - HOLD, port: IN1, bits: FIRE, dur: CORPUS_FRAMES },
  ];
  const compass = [
    LEFT, LEFT | UP, UP, UP | RIGHT, RIGHT, RIGHT | DOWN,
    DOWN, DOWN | LEFT, LEFT, UP, RIGHT, DOWN,
  ];
  let frame = TURN_FIRST_FRAME;
  for (const bits of compass) {
    tape.push({ frame, port: IN1, bits, dur: TURN_HOLD });
    frame += TURN_HOLD;
  }
  return tape;
}

const TAPES = [
  ["shared", {}],
  ["turning", { tape: turnTape() }],
  ["attract", { tape: [] }],
];

/**
 * Every (step, position) a session under one tape presents. Collected by snooping the dispatch
 * and delegating, so the host run is the untouched one.
 */
const corpora = new Map();
function corpus(label, opts) {
  if (!corpora.has(label)) {
    const seen = new Map();
    let dispatches = 0;
    const snoop = new Map([[TARGET, (mm) => {
      dispatches++;
      const key = mm.regs.hl * 65536 + mm.regs.de;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      return oracle(mm);
    }]]);
    const host = makeMachine(snoop, opts);
    const frames = host.runFrames(CORPUS_FRAMES);
    corpora.set(label, {
      pairs: [...seen.entries()].map(([key, hits]) => ({
        step: Math.floor(key / 65536),
        position: key % 65536,
        hits,
      })),
      dispatches,
      frames: frames.length,
      stoppedBy: host.stoppedBy,
    });
  }
  return corpora.get(label);
}

function everyPair() {
  const out = new Map();
  for (const [label, opts] of TAPES) {
    for (const p of corpus(label, opts).pairs) out.set(p.step * 65536 + p.position, p);
  }
  return [...out.values()];
}

/** How many pairs of a corpus an arm is caught on, and how many a predicate says it must be. */
function corpusCatch(candidate, pairs, pred) {
  const { a, b, put } = arena();
  let caught = 0;
  let want = 0;
  for (const p of pairs) {
    put(p.step, p.position);
    oracle(a);
    candidate(b);
    if (a.regs.hl !== b.regs.hl) caught++;
    if (pred(p.step, p.position)) want++;
  }
  return { caught, want };
}

let baseline = null;
/**
 * Where a deliberate register corruption shows up. A driven session runs untouched, then again
 * with `mutate` applied on every single dispatch; the result is every address that ever differed
 * and the last frame any did.
 */
function fallout(mutate) {
  if (baseline === null) {
    const base = makeMachine();
    baseline = { frames: base.runFrames(CORPUS_FRAMES), machine: base };
  }
  let dispatches = 0;
  const host = makeMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    const r = oracle(mm);
    mutate(mm);
    return r;
  }]]));
  const hostFrames = host.runFrames(CORPUS_FRAMES);

  const addrs = new Set();
  let last = -1;
  const n = Math.min(baseline.frames.length, hostFrames.length);
  for (let i = 0; i < n; i++) {
    const x = baseline.frames[i];
    const y = hostFrames[i];
    for (let o = 0; o < x.length; o++) {
      if (x[o] !== y[o]) {
        addrs.add(baseline.machine.stateOffsetToAddr(o));
        last = i;
      }
    }
  }
  return { addrs: [...addrs].sort((p, q) => p - q), last, frames: n, dispatches,
    stoppedBy: host.stoppedBy, baseStoppedBy: baseline.machine.stoppedBy };
}

// ── the contract call ───────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: displaceByFiveQuarters == oracle on RAM", { skip }, () => {
  const r = gate(displaceByFiveQuarters);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const e = entryState();
  const d = atInput(displaceByFiveQuarters, e.regs.hl, e.regs.de);
  assert.equal(d, null, `the live-out at the real entry diverged — ${show(d)}`);
  console.log(
    `  EQUAL: entry step ${hex4(e.regs.hl)} position ${hex4(e.regs.de)} within ` +
      `${ENTRY_FRAMES} frames; RAM and the position pair identical`,
  );
});

test("BLIND: the RAM half of the contract call cannot fail here", { skip }, () => {
  const r = gate(() => {});
  assert.equal(
    r.ram,
    null,
    "an empty body was expected to pass the RAM half — if this ever FAILS the routine writes " +
      "memory after all and every claim in this file must be re-derived",
  );
  const e = entryState();
  const d = atInput(() => {}, e.regs.hl, e.regs.de);
  assert.notEqual(d, null, "the live-out comparison must catch what the RAM half cannot");
  console.log(`  BLIND: empty body passes RAM; the live-out catches it — ${show(d)}`);
});

test("DEGENERATE: the real entry hands over a step of zero, hiding the whole scaling",
  { skip },
  () => {
    const e = entryState();
    assert.equal(
      e.regs.hl,
      0,
      "the step at the real entry is no longer zero — the crafted arms were sized for a " +
        "degenerate dispatch and the blindness recorded in the TEETH arms must be re-measured",
    );
    const plainSum = (m) => {
      m.regs.hl = u16(m.regs.de + m.regs.hl);
    };
    assert.equal(
      atInput(plainSum, e.regs.hl, e.regs.de),
      null,
      "a candidate that drops the quarter entirely should be invisible at a zero step",
    );
    console.log(
      `  DEGENERATE: step ${hex4(e.regs.hl)} at the real entry — dropping the quarter is invisible`,
    );
  });

test("EXCLUDED, deliberately: the scratch pair, the flag byte, the stack pointer and pc",
  { skip },
  () => {
    const a = entryState().clone();
    const b = entryState().clone();
    a.regs.hl = 0xff00;
    a.regs.de = 0x1234;
    b.regs.hl = 0xff00;
    b.regs.de = 0x1234;
    oracle(a);
    displaceByFiveQuarters(b);

    const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
    assert.deepEqual(
      moved,
      ["f", "b", "c", "sp"],
      "the excluded set changed shape: only the flag byte, the pair the oracle assembles the " +
        "quarter in, and the stack pointer may differ",
    );
    assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
    assert.equal(a.regs.hl, 0x10f4, "a backward step must carry a backward quarter with it");
    assert.equal(b.regs.hl, 0x10f4, "and the rewrite must land on the same place");
    console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — the position agrees`);
  });

test("DROPPED: the registers the rewrite declines to reproduce steer nothing, and the " +
  "instrument proves it could have seen it if they did",
  { skip },
  () => {
    const dead = fallout((mm) => {
      mm.regs.b = 0x5a;
      mm.regs.c = 0xa5;
      mm.regs.f = 0xff;
    });
    assert.equal(dead.stoppedBy, null, "the hostile session stopped early");
    assert.equal(dead.baseStoppedBy, null, "the baseline session stopped early");
    assert.equal(dead.frames, CORPUS_FRAMES, "a frame did not reach the vblank spin");
    assert.ok(dead.dispatches > 0, "vacuous: the session never dispatched the routine");
    assert.deepEqual(
      dead.addrs.map(hex4),
      [],
      "a hostile scratch pair or flag byte reached memory — one of them is CONSUMED somewhere " +
        "and dropping it is not licensed; the rewrite must reproduce it",
    );

    const live = fallout((mm) => {
      mm.regs.hl = u16(mm.regs.hl ^ 0x0101);
    });
    assert.ok(
      live.addrs.length > 0,
      "corrupting the position pair left NO trace either, which is a claim about the " +
        "instrument before it is a claim about the registers: the experiment sees nothing",
    );
    assert.ok(
      live.last > live.frames - 100,
      `the corrupted position healed by frame ${live.last} of ${live.frames}, so a persistent ` +
        "divergence is not what this control is demonstrating",
    );
    console.log(
      `  DROPPED: hostile on all ${dead.dispatches} dispatches over ${dead.frames} frames — ` +
        `nothing moved; the control moved ${live.addrs.length} addresses, last at frame ${live.last}`,
    );
  });

// ── the comparison with teeth ───────────────────────────────────────────────────────────────

test("FACTORISES: both arms are the step's own column plus the position, unchanged", { skip }, () => {
  const oracleColumn = column(oracle);
  const rewriteColumn = column(displaceByFiveQuarters);
  let differing = 0;
  for (let step = 0; step < 65536; step++) {
    if (oracleColumn[step] !== rewriteColumn[step]) differing++;
  }
  assert.equal(differing, 0, `${differing} of 65536 steps differ with the position at zero`);
  assert.equal(factorViolations(oracle, oracleColumn), 0, "the oracle does not factorise");
  assert.equal(factorViolations(displaceByFiveQuarters, rewriteColumn), 0, "the rewrite does not factorise");
  console.log(
    "  FACTORISES: 65536 step columns identical, and both arms decompose on every input of " +
      `the ${SPACE}-input cross`,
  );
});

test("CROSS: every input of the enumerated cross is identical, and no byte moves", { skip }, () => {
  const r = sweep(displaceByFiveQuarters);
  assert.equal(r.ram, null, `a byte of memory moved during the sweep — ${show(r.ram)}`);
  assert.equal(r.caught, 0, `${r.caught} of ${SPACE} inputs diverged`);
  for (const [step, position] of [[0xffff, 0], [0xffff, 0xffff], [0x7fff, 0x7fff]]) {
    const d = atInput(displaceByFiveQuarters, step, position);
    assert.equal(d, null, `${hex4(step)} onto ${hex4(position)}: ${show(d)}`);
  }
  console.log(`  CROSS: ${SPACE} inputs identical, both wrap seams included`);
});

test("UNIFORM: the shared tape is blind to the sign and to the rounding; the others are not",
  { skip },
  () => {
    const shared = corpus("shared", {}).pairs;
    assert.ok(shared.length > 0, "vacuous: the shared tape never reached the routine");
    const steps = [...new Set(shared.map((p) => p.step))];
    assert.deepEqual(
      steps.filter((s) => s >= 0x8000).map(hex4),
      [],
      "the shared tape now presents a backward step — the blindness this file is built around " +
        "has changed and the TEETH arms must be re-measured",
    );
    assert.deepEqual(
      steps.filter((s) => (signed(s) & 3) !== 0).map(hex4),
      [],
      "the shared tape now presents a step that does not divide by four",
    );
    assert.ok(steps.some((s) => s !== 0), "the shared tape presents nothing but a zero step");

    const wide = everyPair();
    const wideSteps = [...new Set(wide.map((p) => p.step))];
    const backward = wideSteps.filter((s) => s >= 0x8000);
    const rounding = wideSteps.filter((s) => (signed(s) & 3) !== 0);
    assert.ok(backward.length > 0, "no tape presents a backward step — the sign path is untested");
    assert.ok(rounding.length > 0, "no tape presents a step that rounds — that path is untested");
    console.log(
      `  UNIFORM: shared presents ${steps.length} distinct steps, none backward and none ` +
        `rounding; the three tapes together present ${wideSteps.length}, ${backward.length} ` +
        `backward and ${rounding.length} rounding`,
    );
  });

test("REAL TRAFFIC: every pair three sessions present, replayed", { skip }, () => {
  const { a, b, put } = arena();
  let checked = 0;
  for (const [label, opts] of TAPES) {
    const c = corpus(label, opts);
    assert.equal(c.stoppedBy, null, `the ${label} session stopped early: ${c.stoppedBy}`);
    assert.equal(c.frames, CORPUS_FRAMES, `the ${label} session lost a frame`);
    assert.ok(c.pairs.length > 0, `vacuous: the ${label} session never reached the routine`);
    for (const p of c.pairs) {
      put(p.step, p.position);
      oracle(a);
      displaceByFiveQuarters(b);
      assert.equal(
        a.regs.hl,
        b.regs.hl,
        `${label} ${hex4(p.step)} onto ${hex4(p.position)}: oracle ${hex4(a.regs.hl)} ` +
          `rewrite ${hex4(b.regs.hl)}`,
      );
      checked++;
    }
    console.log(
      `  REAL TRAFFIC/${label}: ${c.pairs.length} distinct pairs over ${c.dispatches} ` +
        `dispatches in ${c.frames} frames — all identical`,
    );
  }
  assert.ok(checked > 0, "vacuous: no pair was replayed");
});

test("BUDGET: the shared entry budget reaches this routine", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: ENTRY_FRAMES });
  assert.equal(r.ram, null, "the budget reached the routine but the two arms disagreed");
  console.log(`  BUDGET: ${ENTRY_FRAMES} shared frames reach the routine`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless. Each twin below is a plausible way to get this routine
// wrong, each must be caught by the same comparison the real arm passes, and each must be caught
// on exactly the inputs its predicate names — a twin caught on the wrong SET is a gate agreeing
// with the wrong theory of why it failed. The predicates read the INPUT; none of them consults
// the twin, so the blind set is re-derived from the data rather than recorded off a run.

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: takes the quarter without the sign, so a backward step lurches forward instead. */
function brokenUnsignedQuarter(m) {
  m.regs.hl = u16(m.regs.de + m.regs.hl + (m.regs.hl >>> 2));
}

/** BUG: halves the step instead of quartering it, so everything drifts too fast. */
function brokenHalfStep(m) {
  m.regs.hl = u16(m.regs.de + m.regs.hl + (signed(m.regs.hl) >> 1));
}

/** BUG: adds the step alone, dropping the extra quarter that is the point of the routine. */
function brokenNoQuarter(m) {
  m.regs.hl = u16(m.regs.de + m.regs.hl);
}

/** BUG: adds the quarter alone, dropping the whole step it was taken from. */
function brokenQuarterOnly(m) {
  m.regs.hl = u16(m.regs.de + (signed(m.regs.hl) >> 2));
}

/** BUG: builds the scaled step correctly and forgets to start from the position. */
function brokenDropsPosition(m) {
  m.regs.hl = u16(m.regs.hl + (signed(m.regs.hl) >> 2));
}

const TWINS = [
  // caught wherever the correct answer is not the value the pair already holds
  ["no-op", brokenNoOp, (step, position) => u16(position + (signed(step) >> 2)) !== 0],
  // caught wherever the step is backward, which is where the two readings of it part ways
  ["unsigned-quarter", brokenUnsignedQuarter, (step) => step >= 0x8000],
  // caught wherever halving and quartering disagree
  ["half-step", brokenHalfStep, (step) => u16(signed(step) >> 1) !== u16(signed(step) >> 2)],
  // caught wherever the step is big enough to have a quarter at all
  ["no-quarter", brokenNoQuarter, (step) => (signed(step) >> 2) !== 0],
  // caught wherever there is any step to drop
  ["quarter-only", brokenQuarterOnly, (step) => step !== 0],
  // caught wherever the position it forgot was not already nothing
  ["drops-position", brokenDropsPosition, (_step, position) => position !== 0],
];

for (const [label, twin, pred] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on exactly the cross inputs it must be`, { skip }, () => {
    const want = predicted(pred);
    assert.ok(want > 0 && want < SPACE, `the ${label} predicate must split the cross`);
    const r = sweep(twin);
    assert.equal(r.caught, want, `the ${label} twin was caught on ${r.caught}, predicted ${want}`);
    console.log(`  TEETH/${label}: caught on ${r.caught} of ${SPACE} cross inputs, as predicted`);
  });

  test(`TEETH: the ${label} twin is CAUGHT on real traffic, on the pairs predicted`, { skip }, () => {
    const wide = everyPair();
    const all = corpusCatch(twin, wide, pred);
    assert.equal(all.caught, all.want, `caught on ${all.caught} pairs, predicted ${all.want}`);
    assert.ok(all.caught > 0, `the ${label} twin survives every pair any of the tapes presents`);
    const sharedOnly = corpusCatch(twin, corpus("shared", {}).pairs, pred);
    assert.equal(sharedOnly.caught, sharedOnly.want, "the shared corpus contradicts the predicate");
    if (label === "unsigned-quarter") {
      assert.equal(
        sharedOnly.caught,
        0,
        "the shared tape now catches the sign twin, so the corpus is no longer uniform and " +
          "the reason this file widens the tapes has changed",
      );
    }
    console.log(
      `  TEETH/${label}: caught on ${all.caught} of ${wide.length} real pairs, ` +
        `${sharedOnly.caught} of them on the shared tape`,
    );
  });

  test(`TEETH: the ${label} twin at the real dispatch, blindness re-derived`, { skip }, () => {
    const e = entryState();
    const expected = pred(e.regs.hl, e.regs.de);
    const d = atInput(twin, e.regs.hl, e.regs.de);
    assert.equal(
      d !== null,
      expected,
      `the real dispatch's behaviour on the ${label} twin contradicts its own predicate`,
    );
    console.log(
      `  TEETH/${label}: real dispatch ${d ? `caught — ${show(d)}` : "BLIND, as the predicate says"}`,
    );
  });
}
