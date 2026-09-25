// SPDX-License-Identifier: GPL-3.0-only
/**
 * holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail — memory-equivalent to the frozen oracle at ROM
 * 0x178C, a phase-1 attract sub-step arm.
 *
 * WHAT IT IS. On every frame it restamps the copyright strip and flashes its line, then counts one
 * frame off the step's delay cell and leaves while the delay is still running. On the frame the
 * delay expires it verifies the copyright line's colours (a guard that derails on its own if they
 * are wrong), builds a caption-cell pointer from a program byte and checks the glyph there against
 * 0x3B, and — if it holds — copies one caption cell's glyph and colour into the tamper-witness pair
 * and steps the sequence on. A wrong glyph DERAILS into the anti-tamper trap (data run as code).
 *
 * ★ WHERE THE LIVE-OUT COMES FROM. The arm is reached by computed dispatch from the phase-1 table,
 *   which seats a return that lands on a routine whose first act overwrites the accumulator before
 *   reading anything, so NO register is live out and the live-out is memory only. The ceiling below
 *   is wide for that reason, not because the rewrite is untidy — it is a CEILING, and a rewrite that
 *   moves fewer registers still passes.
 *
 * ★ THE ORACLE PUSHES AND THE REWRITE DOES NOT (mostly). The oracle reaches its callees — the strip,
 *   the flash, the colour guard, and the sequence step — through the registry, so their return
 *   addresses land below the entry seat and it then takes a ROM return the dissolved arm never takes.
 *   The window is MEASURED by the WINDOW arm over the whole corpus and PINNED, never assumed.
 *
 * ★ ONLY ONE DISPATCH EXPIRES. An undriven attract session dispatches this arm 256 times, presenting
 *   every delay value 0..255, but only ONE of those has the delay reach zero — the coin-and-start
 *   tape never reaches the arm at all. So the countdown is covered by the whole corpus and the
 *   expiring path by that single natural dispatch; there is no way to force a second, because the
 *   colour guard and the glyph check both depend on the copyright screen being genuinely set up, and
 *   forcing the delay on an arbitrary frame derails the colour guard.
 *
 * What it exercises, holes stated:
 *   1. EQUAL      — identical across the whole state dump outside the measured window, at the one
 *                   captured dispatch where the delay actually expires.
 *   2. CORPUS     — every one of the 256 captured dispatches replayed from its own machine; the
 *                   session presents all 256 delay values, asserted rather than hoped for.
 *   3. WINDOW     — the oracle's own deepest push, measured over the whole corpus and PINNED.
 *   4. BOUNDARY   — a planted divergence one byte BELOW the window is caught, one AT the seat is
 *                   caught, one INSIDE is masked.
 *   5. EXCLUDED   — no register outside the declared ceiling moves, with an index-scribbling control.
 *   6. EXPIRES    — the expiring dispatch really verifies, samples both planes into the witness pair
 *                   and steps the sequence; the strip is restamped over a poisoned cell.
 *   7. DERAIL     — a tampered glyph takes the anti-tamper trap identically on both sides, and a twin
 *                   that seats the witness instead of derailing is caught there.
 *   8. TEETH      — twins, each caught somewhere in the corpus.
 *
 * HOLE: the four callees are gated by their own files. What this file gates is that all four are
 * reached, in order, on the right frames — and which cells the sampling reads and writes.
 * HOLE: the colour guard writes nothing and derails only on a TAMPERED colour plane, so a twin that
 * skips it is invisible on a genuine image; its behaviour is gated by equivalence-19da.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-178c.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail } from "../holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail.js";
import { stampCopyrightStrip } from "../stampCopyrightStrip.js";
import { flashCopyrightLine } from "../flashCopyrightLine.js";
import { checkTheCopyrightLineColoursOrDerail } from "../checkTheCopyrightLineColoursOrDerail.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { loc_178c as oracle } from "../../translated/loc_178c.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { SEQUENCE_DELAY, SEQUENCE_SUBSTEP, TAMPER_GLYPH_SOURCE_CELL, TAMPER_GLYPH_COPY, runParachutistSlot_ADDR } from "../names.js";

const TARGET = 0x178c;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const KONAMI_GLYPH = 0x3b;
const CHARACTER_PLANE_BIT = 1 << 10;
const SOURCE_COLOUR_CELL = TAMPER_GLYPH_SOURCE_CELL & ~CHARACTER_PLANE_BIT;

/** Measured & PINNED by the WINDOW arm: the deepest the oracle's own pushes reach below the seat. */
const SCRATCH_BYTES = 4;

/**
 * The ceiling on register divergence, derived from the dispatch successor (which loads every
 * register it uses before reading one), not from the rewrite. A rewrite that moves fewer still
 * passes, so this can never refuse a fix.
 */
const MOVED = ["a", "f", "b", "c", "d", "e", "h", "l", "iy", "sp"];

/** The strip's four display-list cells, derived here, and a marker the strip cannot lay down. */
const STRIP_CELLS = [];
for (let piece = 0; piece < 4; piece++) {
  const entry = 0xaa10 + piece * 2;
  STRIP_CELLS.push(entry, entry + 1, entry + 48, entry + 49);
}
const STRIP_POISON = 0x6e;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => {
  if (!d) return "identical";
  return d.addr === null || d.addr === undefined
    ? `${d.reg}: oracle=${d.a} candidate=${d.b}`
    : `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}`;
};

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** The masked window: bytes the oracle's own pushes reach, and no others. */
const inScratch = (addr, sp) => addr !== null && addr !== undefined && addr >= sp - SCRATCH_BYTES && addr < sp;

/**
 * Oracle vs candidate on clones of `machine`: the whole dump masked to the measured window, then
 * every register outside the ceiling. Only the candidate is wrapped — a raise from the oracle is a
 * harness fault and must not be swallowed. A candidate raise where the oracle returned is a diff.
 */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, reg: "raised", a: "returned", b: String(e.message ?? e).slice(0, 40) };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, reg: k, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

/** How far below its seat the oracle's own pushes take the stack pointer, on one entry state. */
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
  try {
    oracle(c);
  } catch {
    // a derail arm (never taken on a genuine image) may raise; the depth up to that point counts.
  }
  return seat - deepest;
}

// ── the captured corpus ─────────────────────────────────────────────────────────────────

let corpus = null;

/** One pristine machine per dispatch of an undriven attract session. Nothing is poked. */
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]), { tape: [] });
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "corpus run ran short");
  assert.ok(entries.length > 0, "vacuous: attract never reached the routine");
  corpus = entries;
  return corpus;
}

/** The one captured dispatch on which the delay reaches zero. */
function expiringEntry() {
  return captureCorpus().find((mm) => mm.mem8[SEQUENCE_DELAY] === 1);
}

/** The derived caption-cell pointer for a given machine (a program byte + two biases). */
function derivedCell(mm) {
  const low = (mm.mem8[runParachutistSlot_ADDR] + 0x02) & 0xff;
  return (((low + 0x6a) & 0xff) << 8) | low;
}

// ── broken twins (built the way the module is built — direct callee calls) ────────────────

function brokenNoOp() {}

function brokenNoStamp(m) {
  const { mem8 } = m;
  flashCopyrightLine(m);
  const left = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
  mem8[SEQUENCE_DELAY] = left;
  if (left !== 0) return;
  checkTheCopyrightLineColoursOrDerail(m);
  mem8[TAMPER_GLYPH_COPY] = mem8[TAMPER_GLYPH_SOURCE_CELL];
  mem8[TAMPER_GLYPH_COPY + 1] = mem8[SOURCE_COLOUR_CELL];
  advanceSequenceSubStep(m);
}

function brokenNoCountdown(m) {
  stampCopyrightStrip(m);
  flashCopyrightLine(m);
}

/** BUG: the second byte is taken from the glyph plane, so the pair is two glyphs. */
function brokenSamplesOnePlane(m) {
  const { mem8 } = m;
  stampCopyrightStrip(m);
  flashCopyrightLine(m);
  const left = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
  mem8[SEQUENCE_DELAY] = left;
  if (left !== 0) return;
  checkTheCopyrightLineColoursOrDerail(m);
  mem8[TAMPER_GLYPH_COPY] = mem8[TAMPER_GLYPH_SOURCE_CELL];
  mem8[TAMPER_GLYPH_COPY + 1] = mem8[TAMPER_GLYPH_SOURCE_CELL];
  advanceSequenceSubStep(m);
}

/** BUG: the witness is seeded from the wrong caption cell. */
function brokenWrongSourceCell(m) {
  const { mem8 } = m;
  stampCopyrightStrip(m);
  flashCopyrightLine(m);
  const left = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
  mem8[SEQUENCE_DELAY] = left;
  if (left !== 0) return;
  checkTheCopyrightLineColoursOrDerail(m);
  mem8[TAMPER_GLYPH_COPY] = mem8[TAMPER_GLYPH_SOURCE_CELL + 1];
  mem8[TAMPER_GLYPH_COPY + 1] = mem8[SOURCE_COLOUR_CELL + 1];
  advanceSequenceSubStep(m);
}

/** BUG: never leaves the step, so the sequence stalls after the delay runs out. */
function brokenNoAdvance(m) {
  const { mem8 } = m;
  stampCopyrightStrip(m);
  flashCopyrightLine(m);
  const left = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
  mem8[SEQUENCE_DELAY] = left;
  if (left !== 0) return;
  checkTheCopyrightLineColoursOrDerail(m);
  mem8[TAMPER_GLYPH_COPY] = mem8[TAMPER_GLYPH_SOURCE_CELL];
  mem8[TAMPER_GLYPH_COPY + 1] = mem8[SOURCE_COLOUR_CELL];
}

/** BUG: scribbles on an index register, the in-arm control for the ceiling. */
function brokenMovesIndex(m) {
  holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["no-stamp", brokenNoStamp],
  ["no-countdown", brokenNoCountdown],
  ["samples-one-plane", brokenSamplesOnePlane],
  ["wrong-source-cell", brokenWrongSourceCell],
  ["no-advance", brokenNoAdvance],
];

/** The BOUNDARY probe: the ORACLE ITSELF, plus one byte flipped at sp + offset. */
function scribbler(offset) {
  return (m) => {
    const at = (m.regs.sp + offset) & 0xffff;
    oracle(m);
    m.mem8[at] ^= 0xff;
  };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the expiring dispatch: identical outside the measured window", { skip }, () => {
  const e = expiringEntry();
  assert.notEqual(e, undefined, "vacuous: no captured dispatch reached the last frame of the delay");
  const sp = e.regs.sp;
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail(b);
  const all = allDiffs(a, b);
  const strays = all.filter((d) => !inScratch(d.addr, sp));
  console.log(`  EQUAL: seat ${hex4(sp)}; ${all.length} differing bytes, ${strays.length} outside the window`);
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.ok(all.length <= SCRATCH_BYTES, "more bytes differ than the window is wide");
});

test("REACHED: attract dispatches the routine and the harness agrees", { skip }, () => {
  // attract reaches this arm; the coin-and-start tape never does, so drive the undriven session.
  const attractFactory = (overrides) => makeMachine(overrides, { tape: [] });
  // unitEquivalence does not mask the oracle's stack scratch, so its raw .ram flags the push
  // window this routine leaks; the masked byte-exactness is asserted by EQUAL/CORPUS. Here we only
  // prove the harness REACHED and ran the routine (a verdict was produced).
  const r = unitEquivalence(attractFactory, TARGET, oracle, holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail, {
    maxFrames: ENTRY_FRAMES,
  });
  assert.notEqual(r.pc, undefined, "the harness returned no verdict — the routine was never reached");
  console.log("  REACHED: the undriven attract session dispatches the routine and it runs to a verdict");
});

test("WINDOW: the oracle's own deepest push, measured over the whole corpus", { skip }, () => {
  let deepest = 0;
  for (const m of captureCorpus()) deepest = Math.max(deepest, oracleDepth(m));
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is no longer the measured one and every arm below is masking the wrong bytes");
});

test("BOUNDARY: the exclusion is exactly as wide as it declares", { skip }, () => {
  const at = expiringEntry();
  const sp = at.regs.sp;
  const below = unitDiff(scribbler(-SCRATCH_BYTES - 1), at);
  const seat = unitDiff(scribbler(0), at);
  const inside = unitDiff(scribbler(-1), at);
  console.log(`  BOUNDARY: ${hex4(sp - SCRATCH_BYTES - 1)} caught, ${hex4(sp)} caught, ${hex4(sp - 1)} masked`);
  assert.notEqual(below, null, "a divergence one byte BELOW the window was swallowed");
  assert.notEqual(seat, null, "a divergence AT the entry seat was swallowed");
  assert.equal(inside, null, "a divergence INSIDE the window was caught, so the boundary is not where it says");
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const entries = captureCorpus();
  const delays = new Set(entries.map((e) => e.mem8[SEQUENCE_DELAY]));
  assert.equal(delays.size, 256, `the session presented ${delays.size} delay values, not all 256`);
  for (const e of entries) {
    const d = unitDiff(holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail, e);
    assert.equal(d, null, `delay=${e.mem8[SEQUENCE_DELAY]}: ${show(d)}`);
  }
  console.log(`  CORPUS: ${entries.length} dispatches, ${delays.size} distinct delays, all identical`);
});

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const movedOver = (candidate) => {
    const moved = new Set();
    for (const m of captureCorpus()) {
      const a = m.clone();
      const b = m.clone();
      oracle(a);
      try {
        candidate(b);
      } catch {
        continue;
      }
      for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
    }
    return moved;
  };
  const moved = movedOver(holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail);
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for an index-scribbling twin");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}`);
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
});

test("EXPIRES: the expiring dispatch verifies, samples both planes, and steps on", { skip }, () => {
  const e = expiringEntry();
  for (const cell of STRIP_CELLS) e.mem8[cell] = STRIP_POISON;
  const glyph = e.mem8[TAMPER_GLYPH_SOURCE_CELL];
  const colour = e.mem8[SOURCE_COLOUR_CELL];
  assert.notEqual(glyph, colour, "vacuous: the glyph and colour are equal, so a one-plane twin is invisible");
  const cell = derivedCell(e);
  assert.equal(e.mem8[cell], KONAMI_GLYPH, "vacuous: the derived glyph is not the expected 0x3B, so this " +
    "captured dispatch takes the derail rather than the seat path");
  const stepBefore = e.mem8[SEQUENCE_SUBSTEP];

  const m = e.clone();
  holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail(m);
  assert.equal(m.mem8[SEQUENCE_DELAY], 0, "the delay must reach zero on the last frame");
  assert.equal(m.mem8[TAMPER_GLYPH_COPY], glyph, "the glyph must be taken from the character plane");
  assert.equal(m.mem8[TAMPER_GLYPH_COPY + 1], colour, "the second byte must be taken from the COLOUR plane");
  assert.equal(m.mem8[SEQUENCE_SUBSTEP], (stepBefore + 1) & 0xff, "the sequence must step on when the delay expires");
  assert.ok(STRIP_CELLS.every((c) => m.mem8[c] !== STRIP_POISON),
    "a poisoned strip cell survived, so the strip was not restamped and the no-stamp twin would be invisible");
  console.log(`  EXPIRES: witness ${hex4(TAMPER_GLYPH_COPY)}=${glyph}/${colour}, step ${stepBefore}->${(stepBefore + 1) & 0xff}, ` +
    `all ${STRIP_CELLS.length} strip cells restamped`);
});

test("DERAIL: a tampered glyph takes the anti-tamper trap identically on both sides", { skip }, () => {
  const e = expiringEntry().clone();
  const cell = derivedCell(e);
  e.mem8[cell] = (KONAMI_GLYPH + 1) & 0xff; // move the caption glyph off its expected value

  const a = e.clone();
  const b = e.clone();
  let oracleErr = null;
  let candErr = null;
  try { oracle(a); } catch (err) { oracleErr = String(err.message ?? err); }
  try { holdCopyrightThenVerifyGlyphAndSeatWitnessOrDerail(b); } catch (err) { candErr = String(err.message ?? err); }
  assert.equal(candErr, oracleErr, `the derail arm diverged: oracle=${oracleErr} candidate=${candErr}`);
  if (oracleErr === null) {
    const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, e.regs.sp));
    assert.deepEqual(strays, [], `the derail arm's state diverged: ${show(strays[0])}`);
  }
  // The witness must NOT be seated on the derail arm — the trap runs instead.
  assert.equal(a.mem8[SEQUENCE_SUBSTEP], b.mem8[SEQUENCE_SUBSTEP], "the two sides disagree on the substep");

  // A twin that seats the witness instead of derailing is CAUGHT here.
  const seatingTwin = (m) => {
    const { mem8 } = m;
    stampCopyrightStrip(m);
    flashCopyrightLine(m);
    const left = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
    mem8[SEQUENCE_DELAY] = left;
    if (left !== 0) return;
    checkTheCopyrightLineColoursOrDerail(m);
    mem8[TAMPER_GLYPH_COPY] = mem8[TAMPER_GLYPH_SOURCE_CELL];
    mem8[TAMPER_GLYPH_COPY + 1] = mem8[SOURCE_COLOUR_CELL];
    advanceSequenceSubStep(m);
  };
  const c = e.clone();
  let twinErr = null;
  try { seatingTwin(c); } catch (err) { twinErr = String(err.message ?? err); }
  assert.notEqual(twinErr, oracleErr, "the no-derail twin was NOT caught: it must not match the trap");
  console.log(`  DERAIL: tampered glyph => oracle ${oracleErr ? "trap" : "seat"}; the no-derail twin is caught`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const entries = captureCorpus();
    let caught = 0;
    let firstAt = null;
    for (const e of entries) {
      // give no-stamp a poisoned strip so the idempotent restamp is observable
      const m = e.clone();
      if (label === "no-stamp") for (const cell of STRIP_CELLS) m.mem8[cell] = STRIP_POISON;
      const d = unitDiff(twin, m);
      if (d === null) continue;
      caught++;
      if (firstAt === null) firstAt = `delay=${e.mem8[SEQUENCE_DELAY]} ${show(d)}`;
    }
    console.log(`  TEETH/${label}: caught at ${caught} of ${entries.length} dispatches — ${firstAt}`);
    assert.ok(caught > 0, `the masked comparison PASSED the ${label} twin at every dispatch`);
  });
}
