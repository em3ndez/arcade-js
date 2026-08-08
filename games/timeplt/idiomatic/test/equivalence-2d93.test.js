// SPDX-License-Identifier: GPL-3.0-only
/**
 * driftAtThreeQuartersWorldScroll — memory-equivalent to the frozen oracle at ROM 0x2D93.
 *
 * GATE: strict unit-capture with a two-byte dead-stack window, PLUS a corpus of every distinct
 *   displacement pair three tapes produce (each replayed from its OWN captured machine), PLUS a
 *   crafted cross, PLUS a whole-machine replay of driven play. The comparison every arm is judged
 *   by is the masked RAM dump AND the coordinate pair the second move leaves standing.
 *
 * THIS GATE IS ALSO WHAT CHECKS THE DISSOLVED CALL. The oracle reaches its shared move helper
 *   through the machine's registry, so the oracle arm runs the frozen helper while the candidate
 *   arm runs the imported one; every arm below therefore compares the two helpers as well.
 *
 * ★ A WINDOW IS EXCLUDED, AND IT IS TWO BYTES. The oracle pushes a continuation before each of
 *   its two helper calls, so the two bytes below the entry stack pointer hold a return address the
 *   rewrite never writes. WINDOW pins that: every byte the unmasked dump disagrees on lies inside
 *   the window, the four bytes the routine writes lie OUTSIDE it, and a corruption planted at each
 *   of those four is still caught through the mask — so the exclusion cannot be hiding a real write.
 *
 * ★ THE REAL DISPATCH IS DEGENERATE AND THE RAM HALF IS BLIND THERE. Both displacement cells read
 *   zero at the first dispatch the shared tape reaches, so the oracle writes every byte back
 *   unchanged and a candidate with an empty body passes the masked RAM diff. DEGENERATE asserts
 *   exactly that, and asserts the coordinate pair catches what RAM cannot. It is the reason the
 *   corpus and crafted arms exist rather than an optional extra on top of them.
 *
 * ★ THE SHARED CORPUS IS BLIND, MEASURED IN BOTH DIRECTIONS. The shared coin -> start tape holds
 *   one heading, so every displacement it ever presents is non-negative, a multiple of four, and —
 *   on the second coordinate — zero. CORPUS BLINDNESS asserts the shared tape lacks each case AND
 *   that the wider tapes contain it; the twins that need a backward displacement, a displacement
 *   that rounds, or a moving second coordinate are asserted BLIND on the shared corpus rather than
 *   quietly passing, and the turning tape is what catches them.
 *
 * ★ THE CORPUS UNDER-SAMPLES POSITIONS, AND ONE TWIN PROVES IT. Keying a corpus on the displacement
 *   pair keeps one machine per pair, so the position each displacement is applied to is whatever
 *   the first such dispatch happened to carry. The no-carry twin needs a fraction near the top of
 *   its range and survives every entry the shared corpus keeps — while the shared whole-machine
 *   replay, which sees all its dispatches and all their positions, forks on it. Both directions are
 *   asserted per twin: SHARED CORPUS records whether the kept entries catch it, SHARED REPLAY
 *   whether a whole driven session does.
 *
 * LIVE-OUT is memory, derived from the two CALLERS rather than from the instruction sequence: one
 *   tail-jumps to a routine that only rewrites the record bases, the other first calls a routine
 *   that reloads both coordinate wholes from memory. Neither reads a register this routine leaves.
 *   The coordinate pair is compared anyway, because the oracle does leave it standing and the
 *   rewrite reproduces it; that makes the comparison strictly stronger than the declaration.
 *
 * TEETH are judged on the masked RAM alone — the declared live-out — so a twin counted as caught
 *   is caught on memory and not on a register no caller reads. Each declares a PREDICATE over the
 *   inputs saying when it must be caught, never a set read back off the twin, and every arm asserts
 *   the measured catch count equals the predicted one.
 *
 * HOLE: two object slots. Every dispatch in all three tapes comes from one of the same two record
 * base pairs, so the crafted sweep varies the values the routine reads, not the bases it reads
 * them from.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2d93.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { driftAtThreeQuartersWorldScroll } from "../driftAtThreeQuartersWorldScroll.js";
import { loc_2d93 as oracle } from "../../translated/loc_2d93.js";
import { unitEquivalence, wholeMachineEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "../names.js";

const TARGET = 0x2d93;


/** Bytes of dead stack the oracle leaves a pushed continuation in and the rewrite does not. */
const SCRATCH_BYTES = 2;

/** T-states the straight-line oracle charges in total, and the part of that its return costs. */
const ORACLE_TSTATES = 388;
const RET_TSTATES = 10;

const LIVE_OUT = ["h", "l"];
const EXCLUDED = ["f", "b", "c", "d", "e", "sp"];

const CORPUS_FRAMES = 1500;
const WHOLE_FRAMES = 1400;

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

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + u16(v).toString(16).padStart(4, "0");
const signed = (v) => (v << 16) >> 16;
const show = (d) =>
  d ? `${d.where}${d.addr === null ? "" : " " + hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical";

// The four bytes the routine writes, addressed off the two record bases the caller supplies.
const wholeA = (m) => u16(m.regs.iy + 49);
const fractionA = (m) => u16(m.regs.ix + 3);
const wholeB = (m) => u16(m.regs.iy);
const fractionB = (m) => u16(m.regs.ix + 5);
const WRITTEN = [wholeA, fractionA, wholeB, fractionB];

// ── the arithmetic, restated from the INPUT so predicates never consult a twin ──────────────

/** The quarter the correct move takes off a displacement: signed, rounded toward the negative. */
const quarter = (d) => u16((d << 16) >> 18);
/** What the correct move actually adds — the displacement less its own quarter. */
const shortened = (d) => u16(d - quarter(d));

// ── the entry state ─────────────────────────────────────────────────────────────────────────

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
  if (entry === null) gate(driftAtThreeQuartersWorldScroll);
  return entry;
}

// ── the comparison ──────────────────────────────────────────────────────────────────────────

/** The dead stack scratch below a machine's stack pointer, as a half-open address range. */
function scratchWindow(before) {
  return { from: u16(before.regs.sp - SCRATCH_BYTES), to: before.regs.sp };
}

/** Every address two finished machines disagree on, dead stack scratch INCLUDED. */
function everyDiffAddr(a, b) {
  const A = a.dumpState();
  const B = b.dumpState();
  const out = [];
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) out.push(a.stateOffsetToAddr(i));
  return out;
}

/** First byte the two disagree on OUTSIDE the window, or null. */
function maskedDiff(a, b, window) {
  const A = a.dumpState();
  const B = b.dumpState();
  for (let i = 0; i < A.length; i++) {
    if (A[i] === B[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= window.from && addr < window.to) continue;
    return { where: "ram", addr, a: A[i], b: B[i] };
  }
  return null;
}

/** Both arms from one captured machine, with an optional identical poke applied to each. */
function bothArms(candidate, before, poke) {
  const a = before.clone();
  const b = before.clone();
  if (poke) {
    poke(a);
    poke(b);
  }
  oracle(a);
  candidate(b);
  return { a, b, window: scratchWindow(before) };
}

/** The declared live-out: masked RAM only. This is what the TEETH arms are judged on. */
function ramDiff(candidate, before, poke) {
  const { a, b, window } = bothArms(candidate, before, poke);
  return maskedDiff(a, b, window);
}

/** Masked RAM and then the coordinate pair — the full comparison the real arm must pass. */
function unitDiff(candidate, before, poke) {
  const { a, b, window } = bothArms(candidate, before, poke);
  const ram = maskedDiff(a, b, window);
  if (ram) return ram;
  for (const k of LIVE_OUT) {
    if (a.regs[k] !== b.regs[k]) return { where: k, a: a.regs[k], b: b.regs[k], addr: null };
  }
  return null;
}

// ── inputs, and the predicates over them ────────────────────────────────────────────────────

/** Everything either arm reads: the two displacements and the four position bytes. */
function inputsOf(m) {
  return {
    dA: m.mem16[WORLD_SCROLL_Y],
    dB: m.mem16[WORLD_SCROLL_X],
    wA: m.mem8[wholeA(m)],
    fA: m.mem8[fractionA(m)],
    wB: m.mem8[wholeB(m)],
    fB: m.mem8[fractionB(m)],
  };
}

/** The two (displacement, coordinate) axes of one input, so a predicate can speak per axis. */
function axesOf(i) {
  return [
    { d: i.dA, coordinate: u16((i.wA << 8) + i.fA), whole: i.wA, fraction: i.fA },
    { d: i.dB, coordinate: u16((i.wB << 8) + i.fB), whole: i.wB, fraction: i.fB },
  ];
}

const eitherAxis = (pred) => (i) => axesOf(i).some(pred);

// ── the captured corpus ─────────────────────────────────────────────────────────────────────

/** The shared tape plus the stick walked once round the compass, so the heading keeps changing. */
function turnTape(frames) {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: COIN, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: START, dur: HOLD },
    { frame: TURN_FIRST_FRAME - HOLD, port: IN1, bits: FIRE, dur: frames },
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
  ["turning", { tape: turnTape(CORPUS_FRAMES) }],
  ["attract", { tape: [] }],
];

/** One pristine captured machine per distinct displacement pair a tape presents. */
const corpora = new Map();
function corpus(label, opts) {
  if (!corpora.has(label)) {
    const byPair = new Map();
    let dispatches = 0;
    const host = makeMachine(
      new Map([[TARGET, (mm) => {
        dispatches++;
        const key = mm.mem16[WORLD_SCROLL_Y] * 65536 + mm.mem16[WORLD_SCROLL_X];
        if (!byPair.has(key)) byPair.set(key, mm.clone());
        return oracle(mm);
      }]]),
      opts,
    );
    const frames = host.runFrames(CORPUS_FRAMES);
    corpora.set(label, {
      entries: [...byPair.values()],
      dispatches,
      frames: frames.length,
      stoppedBy: host.stoppedBy,
    });
  }
  return corpora.get(label);
}

/** Every distinct captured machine over all three tapes, one per displacement pair. */
function wideCorpus() {
  const byPair = new Map();
  for (const [label, opts] of TAPES) {
    for (const e of corpus(label, opts).entries) {
      byPair.set(inputsOf(e).dA * 65536 + inputsOf(e).dB, e);
    }
  }
  return [...byPair.values()];
}

/** How many entries a twin is caught on, and how many its own predicate says it must be. */
function corpusCatch(twin, entries, pred) {
  let caught = 0;
  let want = 0;
  for (const e of entries) {
    if (ramDiff(twin, e) !== null) caught++;
    if (pred(inputsOf(e))) want++;
  }
  return { caught, want };
}

// ── the crafted cross ───────────────────────────────────────────────────────────────────────

// Zero, the values either side of where a quarter first appears, a low-byte-only step, a whole
// step, the magnitude the game's own drift uses, the sign extremes, and two backward steps that
// do and do not divide by four.
const DISPLACEMENTS = [
  0x0000, 0x0001, 0x0003, 0x0004, 0x00ff, 0x0100, 0x0180, 0x7fff, 0x8000, 0xfe80, 0xfffd, 0xffff,
];

const POSITIONS = [
  { wA: 0, fA: 0, wB: 0, fB: 0 },
  { wA: 0, fA: 255, wB: 255, fB: 0 },
  { wA: 255, fA: 255, wB: 255, fB: 255 },
  { wA: 138, fA: 203, wB: 129, fB: 88 },
  { wA: 1, fA: 1, wB: 254, fB: 254 },
];

function craftedInputs() {
  const out = [];
  for (const dA of DISPLACEMENTS) {
    for (const dB of DISPLACEMENTS) {
      for (const p of POSITIONS) out.push({ ...p, dA, dB });
    }
  }
  return out;
}

/** One fraction byte swept the whole way round, so the carry into the whole byte is hit. */
function carryInputs() {
  const out = [];
  for (let f = 0; f < 256; f++) out.push({ wA: 200, fA: f, wB: 7, fB: f, dA: 1, dB: 4 });
  return out;
}

/** Seat one input on the real captured machine, identically for both arms. */
const seat = (i) => (m) => {
  m.mem16[WORLD_SCROLL_Y] = i.dA;
  m.mem16[WORLD_SCROLL_X] = i.dB;
  m.mem8[wholeA(m)] = i.wA;
  m.mem8[fractionA(m)] = i.fA;
  m.mem8[wholeB(m)] = i.wB;
  m.mem8[fractionB(m)] = i.fB;
};

/** How many crafted inputs a twin is caught on, and how many its predicate says it must be. */
function craftedCatch(twin, inputs, pred) {
  let caught = 0;
  let want = 0;
  for (const i of inputs) {
    if (ramDiff(twin, entryState(), seat(i)) !== null) caught++;
    if (pred(i)) want++;
  }
  return { caught, want };
}

// ── the cycle shim ──────────────────────────────────────────────────────────────────────────

/** Adapt a candidate to the cycle-driven host: pay the oracle's total, then take the return. */
function hosted(candidate) {
  return (mm) => {
    candidate(mm);
    mm.tick(ORACLE_TSTATES - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const turningMachine = (overrides) => makeMachine(overrides, { tape: turnTape(WHOLE_FRAMES) });

function replay(candidate, mk = turningMachine) {
  return wholeMachineEquivalence(mk, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: driftAtThreeQuartersWorldScroll == oracle outside the dead stack scratch", { skip }, () => {
  gate(driftAtThreeQuartersWorldScroll);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const e = entryState();
  const d = unitDiff(driftAtThreeQuartersWorldScroll, e);
  assert.equal(d, null, `diverged — ${show(d)}`);
  console.log(
    `  EQUAL: entry bases ${hex4(e.regs.ix)}/${hex4(e.regs.iy)} within ${ENTRY_FRAMES} frames; ` +
      "masked RAM and the coordinate pair identical",
  );
});

test("WINDOW: the exclusion is the dead stack scratch, and it hides no written byte", { skip }, () => {
  const e = entryState();
  const { a, b, window } = bothArms(driftAtThreeQuartersWorldScroll, e);
  assert.equal(window.to - window.from, SCRATCH_BYTES, "the window is not two bytes wide");

  const differing = everyDiffAddr(a, b);
  assert.ok(differing.length > 0, "vacuous: nothing differs at all, so no window is being tested");
  for (const addr of differing) {
    assert.ok(
      addr >= window.from && addr < window.to,
      `${hex4(addr)} differs OUTSIDE the window — the exclusion no longer describes the divergence`,
    );
  }
  for (const at of WRITTEN) {
    const addr = at(e);
    assert.ok(
      addr < window.from || addr >= window.to,
      `the routine writes ${hex4(addr)}, which the window would mask`,
    );
  }

  // A corruption planted at each written byte must survive the mask, or the mask is the gate.
  for (const at of WRITTEN) {
    const corrupt = (m) => {
      driftAtThreeQuartersWorldScroll(m);
      m.mem8[at(m)] = u8(m.mem8[at(m)] + 1);
    };
    const d = ramDiff(corrupt, e);
    assert.notEqual(d, null, `a corruption at ${hex4(at(e))} passed the masked diff`);
    assert.equal(d.addr, at(e), `the masked diff blamed ${hex4(d.addr)} for a corruption elsewhere`);
  }
  console.log(
    `  WINDOW: ${differing.length} byte(s) differ, all inside [${hex4(window.from)}, ` +
      `${hex4(window.to)}); all four written bytes lie outside it and stay catchable`,
  );
});

test("DEGENERATE: the real dispatch moves nothing, so the RAM half is blind there", { skip }, () => {
  const e = entryState();
  const i = inputsOf(e);
  assert.equal(i.dA, 0, "the first displacement at the real entry is no longer zero");
  assert.equal(i.dB, 0, "the second displacement at the real entry is no longer zero");

  const after = e.clone();
  oracle(after);
  for (const at of WRITTEN) {
    assert.equal(e.mem8[at(e)], after.mem8[at(after)], `${hex4(at(e))} moved after all`);
  }

  assert.equal(
    ramDiff(brokenNoOp, e),
    null,
    "an empty body was expected to pass the RAM half here — if this FAILS the real dispatch is " +
      "no longer degenerate and every blindness recorded in this file must be re-measured",
  );
  const d = unitDiff(brokenNoOp, e);
  assert.notEqual(d, null, "the coordinate pair must catch what the RAM half cannot");
  console.log(
    `  DEGENERATE: both displacements zero, no written byte moves, RAM passes an empty body; ` +
      `the pair catches it — ${show(d)}`,
  );
});

test("EXCLUDED, deliberately: registers and pc diverge and nothing else does", { skip }, () => {
  const e = entryState();
  const { a, b } = bothArms(driftAtThreeQuartersWorldScroll, e, seat({ dA: 0xfe83, dB: 0x0177, wA: 200, fA: 30, wB: 9, fB: 77 }));
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !EXCLUDED.includes(k));
  assert.deepEqual(
    unexpected,
    [],
    "a register outside the excluded set diverged: only the flag byte, the pairs the oracle " +
      "assembles its arithmetic in, and the stack pointer may differ",
  );
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  for (const k of LIVE_OUT) assert.equal(a.regs[k], b.regs[k], `the live-out ${k} moved`);
  for (const at of WRITTEN) assert.equal(a.mem8[at(a)], b.mem8[at(b)], `written byte ${hex4(at(a))}`);
  console.log(`  EXCLUDED: registers ${moved.join(", ")} and pc — RAM and the pair agree`);
});

test("CORPUS BLINDNESS: the shared tape lacks three cases and the wider tapes carry them", { skip }, () => {
  const shared = corpus("shared", {}).entries.map(inputsOf);
  assert.ok(shared.length > 0, "vacuous: the shared tape never reached the routine");
  assert.deepEqual(
    shared.filter((i) => i.dA >= 0x8000 || i.dB >= 0x8000).map((i) => hex4(i.dA)),
    [],
    "the shared tape now presents a backward displacement — the twins declared blind on it must " +
      "be re-measured",
  );
  assert.deepEqual(
    shared.filter((i) => (i.dA & 3) !== 0 || (i.dB & 3) !== 0).map((i) => hex4(i.dA)),
    [],
    "the shared tape now presents a displacement that does not divide by four",
  );
  assert.deepEqual(
    shared.filter((i) => i.dB !== 0).map((i) => hex4(i.dB)),
    [],
    "the shared tape now moves the second coordinate — the second-dropped twin is no longer blind",
  );
  assert.ok(shared.some((i) => i.dA !== 0), "the shared tape presents nothing but a zero pair");

  const wide = wideCorpus().map(inputsOf);
  assert.ok(wide.length > 0, "vacuous: no tape reached the routine");
  const backward = wide.filter((i) => i.dA >= 0x8000 || i.dB >= 0x8000);
  const rounding = wide.filter((i) => (i.dA & 3) !== 0 || (i.dB & 3) !== 0);
  const second = wide.filter((i) => i.dB !== 0);
  assert.ok(backward.length > 0, "no tape presents a backward displacement — the sign path is untested");
  assert.ok(rounding.length > 0, "no tape presents a displacement that rounds — that path is untested");
  assert.ok(second.length > 0, "no tape moves the second coordinate — that whole axis is untested");
  console.log(
    `  CORPUS BLINDNESS: shared presents ${shared.length} pairs, none backward, none rounding, ` +
      `none moving the second coordinate; the three tapes present ${wide.length}, of which ` +
      `${backward.length} backward, ${rounding.length} rounding, ${second.length} moving the second`,
  );
});

test("CORPUS: every displacement pair three sessions present, replayed from its own machine", { skip }, () => {
  let checked = 0;
  for (const [label, opts] of TAPES) {
    const c = corpus(label, opts);
    assert.equal(c.stoppedBy, null, `the ${label} session stopped early: ${c.stoppedBy}`);
    assert.equal(c.frames, CORPUS_FRAMES, `the ${label} session lost a frame`);
    assert.ok(c.dispatches > 0, `vacuous: the ${label} session never reached the routine`);
    assert.ok(c.entries.length > 0, `vacuous: the ${label} session captured no entry`);
    for (const e of c.entries) {
      const d = unitDiff(driftAtThreeQuartersWorldScroll, e);
      const i = inputsOf(e);
      assert.equal(d, null, `${label} ${hex4(i.dA)}/${hex4(i.dB)}: ${show(d)}`);
      checked++;
    }
    console.log(
      `  CORPUS/${label}: ${c.entries.length} distinct pairs over ${c.dispatches} dispatches ` +
        `in ${c.frames} frames — all identical`,
    );
  }
  assert.ok(checked > 0, "vacuous: no entry was replayed");
});

test("CRAFTED: every displacement x position combination steps as the oracle steps it", { skip }, () => {
  const inputs = craftedInputs();
  assert.equal(inputs.length, DISPLACEMENTS.length ** 2 * POSITIONS.length, "the cross shrank");
  for (const i of inputs) {
    const d = unitDiff(driftAtThreeQuartersWorldScroll, entryState(), seat(i));
    assert.equal(d, null, `${hex4(i.dA)}/${hex4(i.dB)} onto ${i.wA},${i.fA},${i.wB},${i.fB}: ${show(d)}`);
  }
  console.log(`  CRAFTED: ${inputs.length} entries identical, both sign extremes included`);
});

test("CARRY: a fraction swept the whole way round carries exactly as the oracle carries", { skip }, () => {
  const inputs = carryInputs();
  for (const i of inputs) {
    const d = unitDiff(driftAtThreeQuartersWorldScroll, entryState(), seat(i));
    assert.equal(d, null, `fraction=${i.fA}: ${show(d)}`);
  }
  const wrapped = entryState().clone();
  seat({ wA: 255, fA: 255, wB: 0, fB: 0, dA: 1, dB: 0 })(wrapped);
  driftAtThreeQuartersWorldScroll(wrapped);
  assert.equal(wrapped.mem8[wholeA(wrapped)], 0, "the whole byte must round, not widen");
  assert.equal(wrapped.mem8[fractionA(wrapped)], 0, "the fraction must round too");
  console.log(`  CARRY: ${inputs.length} fractions identical, including the top-of-range wrap`);
});

test("SHIM: the oracle's total is a constant, so the replay's charge is not a guess", { skip }, () => {
  for (const dA of DISPLACEMENTS) {
    const m = entryState().clone();
    m.mem16[WORLD_SCROLL_Y] = dA;
    m.mem16[WORLD_SCROLL_X] = u16(~dA);
    const before = m.cycles;
    oracle(m);
    assert.equal(m.cycles - before, ORACLE_TSTATES, `${hex4(dA)}: the shim's total is wrong`);
  }
  console.log(`  SHIM: ${ORACLE_TSTATES} T-states on every crafted displacement, branchless`);
});

test("WHOLE-MACHINE: driven play is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(driftAtThreeQuartersWorldScroll);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(
    `  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches, ` +
      "RAM identical including the stack",
  );
});

test("BUDGET: the shared entry budget reaches this routine", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: ENTRY_FRAMES });
  assert.equal(r.ram, null, "the budget reached the routine but the two oracle arms disagreed");
  console.log(`  BUDGET: ${ENTRY_FRAMES} shared frames reach the routine`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
// A gate that cannot fail is worthless. Each twin below is a plausible way to get this routine
// wrong, and each is judged on the masked RAM alone — the declared live-out — so a catch is a
// catch on memory. Every twin states a PREDICATE over the INPUT saying when it must be caught;
// none of them consults the twin, so a blind set is re-derived from the data rather than recorded
// off a run, and a twin caught on the WRONG set fails as loudly as one missed.

/** Read a coordinate the way both arms read it: whole above fraction, as one number. */
const splitAt = (m, at, atFraction) => u16((m.mem8[at(m)] << 8) + m.mem8[atFraction(m)]);

/** Store a coordinate back the way both arms store it. */
function storeAt(m, at, atFraction, moved) {
  m.mem8[at(m)] = u16(moved) >> 8;
  m.mem8[atFraction(m)] = moved;
}

/** Run one per-axis move over both coordinates, which is the shape every twin shares. */
function overBothAxes(m, move) {
  move(m, wholeA, fractionA, m.mem16[WORLD_SCROLL_Y]);
  move(m, wholeB, fractionB, m.mem16[WORLD_SCROLL_X]);
}

/** A twin that differs only in how much of the displacement it adds. */
const movingBy = (amount) => (m) =>
  overBothAxes(m, (mm, at, atFraction, d) =>
    storeAt(mm, at, atFraction, u16(splitAt(mm, at, atFraction) + amount(d))));

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: adds the whole displacement, so the carrier keeps pace instead of trailing. */
const brokenUnshortened = movingBy((d) => d);

/** BUG: takes half off instead of a quarter, so the carrier trails by twice as much. */
const brokenHalved = movingBy((d) => u16(d - u16((d << 16) >> 17)));

/** BUG: shifts in zeros, so a displacement running the other way is lengthened, not shortened. */
const brokenUnsigned = movingBy((d) => u16(d - (d >>> 2)));

/** BUG: rounds the quarter toward zero rather than toward the negative. */
const brokenRoundsToZero = movingBy((d) => u16(d - u16(Math.trunc(signed(d) / 4))));

/** BUG: stores the whole byte but never the fraction, so sub-steps never bank. */
function brokenWholeOnly(m) {
  overBothAxes(m, (mm, at, atFraction, d) => {
    mm.mem8[at(mm)] = u16(splitAt(mm, at, atFraction) + shortened(d)) >> 8;
  });
}

/** BUG: moves the first coordinate and leaves the second one where it was. */
function brokenSecondDropped(m) {
  overBothAxes(m, (mm, at, atFraction, d) => {
    const amount = at === wholeA ? shortened(d) : 0;
    storeAt(mm, at, atFraction, u16(splitAt(mm, at, atFraction) + amount));
  });
}

/** BUG: adds each half of the shortened displacement to its own byte, so nothing carries. */
function brokenNoCarry(m) {
  overBothAxes(m, (mm, at, atFraction, d) => {
    const amount = shortened(d);
    mm.mem8[at(mm)] = u8(mm.mem8[at(mm)] + (amount >> 8));
    mm.mem8[atFraction(mm)] = u8(mm.mem8[atFraction(mm)] + u8(amount));
  });
}

/** BUG: feeds each coordinate the other coordinate's displacement. */
function brokenSwapped(m) {
  const dA = m.mem16[WORLD_SCROLL_Y];
  const dB = m.mem16[WORLD_SCROLL_X];
  storeAt(m, wholeA, fractionA, u16(splitAt(m, wholeA, fractionA) + shortened(dB)));
  storeAt(m, wholeB, fractionB, u16(splitAt(m, wholeB, fractionB) + shortened(dA)));
}

/** What the correct move leaves in the two bytes of one axis. */
const correctWhole = (ax) => u16(ax.coordinate + shortened(ax.d)) >> 8;
const correctFraction = (ax) => u8(u16(ax.coordinate + shortened(ax.d)));

// Each twin carries a predicate over the INPUT and three recorded blindnesses, all asserted in
// both directions: on the entries the shared corpus keeps, on a whole shared driven session, and
// at the one real dispatch the contract arm looks at.
const TWINS = [
  // caught wherever the correct move changes a byte at all
  ["no-op", brokenNoOp, eitherAxis((ax) => shortened(ax.d) !== 0),
    { corpus: false, replay: false, dispatch: true }],
  // caught wherever the displacement is big enough to have a quarter
  ["unshortened", brokenUnshortened, eitherAxis((ax) => quarter(ax.d) !== 0),
    { corpus: false, replay: false, dispatch: true }],
  // caught wherever halving and quartering disagree
  ["halved", brokenHalved, eitherAxis((ax) => u16((ax.d << 16) >> 17) !== quarter(ax.d)),
    { corpus: false, replay: false, dispatch: true }],
  // caught only where the displacement runs backward, which the shared tape never does
  ["unsigned", brokenUnsigned, eitherAxis((ax) => ax.d >= 0x8000),
    { corpus: true, replay: true, dispatch: true }],
  // caught only where a backward displacement also fails to divide by four
  ["rounds-to-zero", brokenRoundsToZero, eitherAxis((ax) => ax.d >= 0x8000 && (ax.d & 3) !== 0),
    { corpus: true, replay: true, dispatch: true }],
  // caught wherever the correct move would have changed a fraction byte
  ["whole-only", brokenWholeOnly, eitherAxis((ax) => correctFraction(ax) !== ax.fraction),
    { corpus: false, replay: false, dispatch: true }],
  // caught only where the second coordinate really moves, which the shared tape never does
  ["second-dropped", brokenSecondDropped, (i) => shortened(i.dB) !== 0,
    { corpus: true, replay: true, dispatch: true }],
  // caught wherever the correct move carries or borrows across the two bytes — which no entry the
  // shared corpus keeps happens to do, though the shared session's other dispatches do
  ["no-carry", brokenNoCarry,
    eitherAxis((ax) => correctWhole(ax) !== u8(ax.whole + (shortened(ax.d) >> 8))),
    { corpus: true, replay: false, dispatch: true }],
  // caught wherever the two axes are not being moved by the same amount anyway
  ["swapped", brokenSwapped, (i) => shortened(i.dA) !== shortened(i.dB),
    { corpus: false, replay: false, dispatch: true }],
];

for (const [label, twin, pred, blind] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exactly the crafted inputs predicted`, { skip }, () => {
    const inputs = craftedInputs();
    const r = craftedCatch(twin, inputs, pred);
    assert.ok(r.want > 0 && r.want < inputs.length, `the ${label} predicate must split the cross`);
    assert.equal(r.caught, r.want, `caught on ${r.caught} crafted inputs, predicted ${r.want}`);
    console.log(`  TEETH/${label}: caught on ${r.caught} of ${inputs.length} crafted inputs, as predicted`);
  });

  test(`TEETH: the ${label} twin on real traffic, its shared blindness pinned`, { skip }, () => {
    const wide = wideCorpus();
    const all = corpusCatch(twin, wide, pred);
    assert.equal(all.caught, all.want, `caught on ${all.caught} real pairs, predicted ${all.want}`);
    assert.ok(all.caught > 0, `the ${label} twin survives every pair any of the tapes presents`);

    const sharedOnly = corpusCatch(twin, corpus("shared", {}).entries, pred);
    assert.equal(sharedOnly.caught, sharedOnly.want, "the shared corpus contradicts the predicate");
    assert.equal(
      sharedOnly.caught === 0,
      blind.corpus,
      `the shared corpus's blindness to the ${label} twin changed — re-derive it`,
    );
    console.log(
      `  TEETH/${label}: caught on ${all.caught} of ${wide.length} real pairs, ` +
        `${sharedOnly.caught} of them on the shared tape`,
    );
  });

  test(`TEETH: the ${label} twin at the real dispatch, blindness re-derived`, { skip }, () => {
    const e = entryState();
    const expected = pred(inputsOf(e));
    assert.equal(expected, !blind.dispatch, `the ${label} predicate disagrees with its own record`);
    const d = ramDiff(twin, e);
    assert.equal(d !== null, expected, `the real dispatch contradicts the ${label} predicate`);
    console.log(
      `  TEETH/${label}: real dispatch ${d ? `caught — ${show(d)}` : "BLIND, as the predicate says"}`,
    );
  });

  test(`TEETH: the ${label} twin forks the whole machine on the turning tape`, { skip }, () => {
    const w = replay(twin);
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
    assert.equal(w.equal, false, `the ${label} twin ran clean — the replay has no teeth`);
    console.log(`  TEETH/${label}: forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  });

  test(`SHARED REPLAY: a whole shared session on the ${label} twin, both directions`, { skip }, () => {
    const w = replay(twin, makeMachine);
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
    assert.equal(
      w.equal,
      blind.replay,
      `the shared tape's whole-session blindness to the ${label} twin changed — the turning tape ` +
        "exists because of what the shared one cannot see, so re-derive this rather than delete it",
    );
    console.log(
      `  SHARED REPLAY/${label}: ${w.equal
        ? `${WHOLE_FRAMES} frames identical — only the turning tape catches it`
        : `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`}`,
    );
  });
}
