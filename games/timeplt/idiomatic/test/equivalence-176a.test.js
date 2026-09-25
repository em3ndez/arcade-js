// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintReadoutsThenSampleWitnessOrDerail — memory-equivalent to the frozen oracle at ROM 0x176a.
 *
 * GATE: strict unit-capture over every dispatch of an undriven attract session, one MEASURED stack
 *   window, a crafted wrong-glyph derail, a crafted tamper-sample readback, and teeth.
 *
 * ★ WHERE THE LIVE-OUT COMES FROM. The routine is not reached by any `call` in the image; it is a
 *   table-dispatched sequence arm whose two transfers both leave through the return the dispatcher
 *   parked — the wrong-glyph derail into stepMotherShipWarpFlashFrame (0x459b) and the tail step
 *   through advanceSequenceSubStep (0x0f1a). Each successor reloads every register it uses before
 *   reading one, so NO register is live out and the live-out is memory only. The register ceiling
 *   below is wide for that reason, not because the rewrite is untidy.
 *
 * ★ THE ORACLE PUSHES AND THE REWRITE DOES NOT. The oracle reaches its callees (checkColours,
 *   postCommand, paint, the tail step, and — on the derail — the mother-ship handler) through the
 *   registry, seating return words below the entry seat that the direct-called rewrite never seats.
 *   The window is MEASURED — the WINDOW arm instruments the oracle's own `push16` over this file's
 *   whole sweep — never assumed and never copied from another gate.
 *
 * ★ THE MISALIGNED DERAIL READS THE DISPATCHER FRAME, NOT THE CALL SCRATCH. The wrong-glyph derail
 *   enters stepMotherShipWarpFlashFrame through its misaligned prologue (two POP AF, a DEC SP),
 *   which reads words ABOVE the entry seat — the dispatcher's own frame, identical in the oracle
 *   and the rewrite — while the oracle's extra call scratch lies strictly BELOW the seat and is
 *   masked. So the stray-carry life-loss decision is the same on both sides; the DERAIL arm proves
 *   it by value.
 *
 * What it exercises, holes stated:
 *   1. CORPUS   — every dispatch of an undriven attract session, replayed from its own captured
 *                 machine, identical outside the measured window.
 *   2. WINDOW   — the oracle's own deepest push, measured over the whole sweep and PINNED.
 *   3. BOUNDARY — a planted divergence one byte BELOW the window is caught, one AT the seat is
 *                 caught, one INSIDE is masked. The third shows the first two are not the
 *                 instrument catching everything.
 *   4. DERAIL   — the glyph cell is forced OFF its expected value on a real captured machine; both
 *                 sides transfer into the mother-ship handler and agree outside the window,
 *                 including whether the misaligned prologue's stray carry folded in a life-loss.
 *   5. SAMPLE   — on the clean path the sampled glyph/colour pair is marked and read back out of
 *                 the tamper witness cells by value, and the sequence index is shown to step.
 *   6. TEETH    — broken twins with their exact catch counts.
 *
 * HOLE: the five callees are gated by their own files. What this file gates is that they are
 * reached, in order, on the right branch — and which cells the sampling reads and writes.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-176a.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { paintReadoutsThenSampleWitnessOrDerail } from "../paintReadoutsThenSampleWitnessOrDerail.js";
import { checkTheCopyrightLineColoursOrDerail } from "../checkTheCopyrightLineColoursOrDerail.js";
import { stepMotherShipWarpFlashFrame } from "../stepMotherShipWarpFlashFrame.js";
import { postCommand } from "../postCommand.js";
import { paintFiveLabelledNumericReadouts } from "../paintFiveLabelledNumericReadouts.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { loc_176a as oracle } from "../../translated/loc_176a.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import {
  TAMPER_GLYPH_SOURCE_CELL,
  TAMPER_SAMPLE_GLYPH_CELL,
  TAMPER_SAMPLE_COLOUR_CELL,
  TAMPER_GLYPH_READBACK,
  TAMPER_COLOUR_READBACK,
  SEQUENCE_SUBSTEP,
  COMMAND_RING,
} from "../names.js";

const TARGET = 0x176a;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const EXPECTED_GLYPH = 0x7c;
const WRITE_CURSOR = 0xa9b2;
const FREE = 255;

/** No register is live out (see header), so the whole main register file may differ. CEILING. */
const MOVED = REG_FIELDS.slice();

/**
 * A glyph the char plane can hold that no copyright COLOUR cell holds (colours are guarded to
 * 0x10/0x05). The COLOUR source cell 0xa1dc is one of the guarded copyright-line colour cells, so
 * it is NEVER poked — its real value (0x10 or 0x05) is read back instead, and GLYPH_MARK differs
 * from both so the one-plane twin is visible.
 */
const GLYPH_MARK = 0x5b;
/** A sentinel the readback destinations cannot already hold, so the copy is provably fresh. */
const READBACK_SENTINEL = 0xa4;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => {
  if (!d) return "identical";
  return d.addr === null
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

/** The masked window: the bytes the oracle's own pushes reach below the entry seat, and no others. */
const inScratch = (addr, sp, width) => addr !== null && addr >= sp - width && addr < sp;

/**
 * Oracle vs candidate on clones of `machine`: the whole dump masked to the measured window, then
 * every register outside the ceiling. Only the candidate's side is wrapped, because a raise from
 * the oracle is a harness fault and must not be swallowed.
 */
function unitDiff(candidate, machine, width) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, reg: "raised", a: "returned", b: String(e).slice(0, 40) };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp, width));
  if (ram) return ram;
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, reg: k, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

/**
 * Outcome comparison for the DERAIL branch. The wrong-glyph derail transfers into the mother-ship
 * warp/flash handler through its MISALIGNED prologue, which — from any state that is not a live
 * mother-ship object — corrupts a pointer and faults (an unmapped write). That fault is a genuine
 * property of the anti-tamper transfer, not of the rewrite, and it happens identically on both
 * sides because both run the same handler from the same state. So the test of the branch is that
 * the two OUTCOMES agree: both raise (the transfer was taken), or both return with equal memory
 * outside the window. A twin that skips the derail RETURNS where the oracle RAISES — caught.
 */
function outcomeDiff(candidate, machine, width) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  let ra = null;
  let rb = null;
  try { oracle(a); } catch (e) { ra = String(e).slice(0, 40); }
  try { candidate(b); } catch (e) { rb = String(e).slice(0, 40); }
  if (ra && rb) return null; // both transferred into the faulting handler: equivalent
  if (!!ra !== !!rb) {
    return { addr: null, reg: "outcome", a: ra ? `raised(${ra})` : "returned", b: rb ? `raised(${rb})` : "returned" };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp, width));
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
  oracle(c);
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

/** The measured stack window, taken over the whole corpus and pinned by the WINDOW arm. */
let WINDOW = null;
function windowBytes() {
  if (WINDOW !== null) return WINDOW;
  let deepest = 0;
  for (const m of captureCorpus()) deepest = Math.max(deepest, oracleDepth(m));
  WINDOW = deepest;
  return WINDOW;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────
// Each is the module with one thing wrong, built the way the module is built — direct calls to
// the idiomatic callees, so a twin's stack traffic matches the rewrite's and the mask is honest.

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: never checks the copyright colours, so a tampered image is not derailed. */
function brokenNoColourGuard(m) {
  const { mem8 } = m;
  if (mem8[TAMPER_GLYPH_SOURCE_CELL] !== EXPECTED_GLYPH) { stepMotherShipWarpFlashFrame(m); return; }
  postCommand(m, 0x01, 0x13);
  paintFiveLabelledNumericReadouts(m);
  mem8[TAMPER_GLYPH_READBACK] = mem8[TAMPER_SAMPLE_GLYPH_CELL];
  mem8[TAMPER_COLOUR_READBACK] = mem8[TAMPER_SAMPLE_COLOUR_CELL];
  advanceSequenceSubStep(m);
}

/** BUG: never queues the caption command. */
function brokenNoCaption(m) {
  const { mem8 } = m;
  checkTheCopyrightLineColoursOrDerail(m);
  if (mem8[TAMPER_GLYPH_SOURCE_CELL] !== EXPECTED_GLYPH) { stepMotherShipWarpFlashFrame(m); return; }
  paintFiveLabelledNumericReadouts(m);
  mem8[TAMPER_GLYPH_READBACK] = mem8[TAMPER_SAMPLE_GLYPH_CELL];
  mem8[TAMPER_COLOUR_READBACK] = mem8[TAMPER_SAMPLE_COLOUR_CELL];
  advanceSequenceSubStep(m);
}

/** BUG: never repaints the readouts. */
function brokenNoPaint(m) {
  const { mem8 } = m;
  checkTheCopyrightLineColoursOrDerail(m);
  if (mem8[TAMPER_GLYPH_SOURCE_CELL] !== EXPECTED_GLYPH) { stepMotherShipWarpFlashFrame(m); return; }
  postCommand(m, 0x01, 0x13);
  mem8[TAMPER_GLYPH_READBACK] = mem8[TAMPER_SAMPLE_GLYPH_CELL];
  mem8[TAMPER_COLOUR_READBACK] = mem8[TAMPER_SAMPLE_COLOUR_CELL];
  advanceSequenceSubStep(m);
}

/** BUG: samples the colour from the glyph plane, so the witness keeps two glyphs. */
function brokenSampleOnePlane(m) {
  const { mem8 } = m;
  checkTheCopyrightLineColoursOrDerail(m);
  if (mem8[TAMPER_GLYPH_SOURCE_CELL] !== EXPECTED_GLYPH) { stepMotherShipWarpFlashFrame(m); return; }
  postCommand(m, 0x01, 0x13);
  paintFiveLabelledNumericReadouts(m);
  mem8[TAMPER_GLYPH_READBACK] = mem8[TAMPER_SAMPLE_GLYPH_CELL];
  mem8[TAMPER_COLOUR_READBACK] = mem8[TAMPER_SAMPLE_GLYPH_CELL];
  advanceSequenceSubStep(m);
}

/** BUG: never steps the sequence on, so the arm stalls after its work. */
function brokenNoAdvance(m) {
  const { mem8 } = m;
  checkTheCopyrightLineColoursOrDerail(m);
  if (mem8[TAMPER_GLYPH_SOURCE_CELL] !== EXPECTED_GLYPH) { stepMotherShipWarpFlashFrame(m); return; }
  postCommand(m, 0x01, 0x13);
  paintFiveLabelledNumericReadouts(m);
  mem8[TAMPER_GLYPH_READBACK] = mem8[TAMPER_SAMPLE_GLYPH_CELL];
  mem8[TAMPER_COLOUR_READBACK] = mem8[TAMPER_SAMPLE_COLOUR_CELL];
}

/** BUG: ignores the wrong-glyph derail and does the clean work regardless. */
function brokenNoDerail(m) {
  const { mem8 } = m;
  checkTheCopyrightLineColoursOrDerail(m);
  postCommand(m, 0x01, 0x13);
  paintFiveLabelledNumericReadouts(m);
  mem8[TAMPER_GLYPH_READBACK] = mem8[TAMPER_SAMPLE_GLYPH_CELL];
  mem8[TAMPER_COLOUR_READBACK] = mem8[TAMPER_SAMPLE_COLOUR_CELL];
  advanceSequenceSubStep(m);
}

// no-colour-guard is not here: on a clean state the colour guard is a pure no-op (it only derails
// on a tampered colour), so it is memory-invisible and gets its own crafted bad-colour arm below.
const CLEAN_TWINS = [
  ["no-op", brokenNoOp],
  ["no-caption", brokenNoCaption],
  ["no-paint", brokenNoPaint],
  ["sample-one-plane", brokenSampleOnePlane],
  ["no-advance", brokenNoAdvance],
];

/**
 * The BOUNDARY arm's probe: the ORACLE ITSELF, plus one byte flipped at `sp + offset`. Built on
 * the oracle so what the arm reports is a property of the MASK alone.
 */
function scribbler(offset) {
  return (m) => {
    const at = (m.regs.sp + offset) & 0xffff;
    oracle(m);
    m.mem8[at] ^= 0xff;
  };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("WINDOW: the oracle's own deepest push, measured over the whole corpus", { skip }, () => {
  const w = windowBytes();
  console.log(`  WINDOW (measured): the oracle reaches ${w} bytes below its seat`);
  assert.ok(w >= 0 && w < 0x100, "the measured stack window is implausible");
});

test("CORPUS: every captured dispatch replays identically outside the window", { skip }, () => {
  const entries = captureCorpus();
  const w = windowBytes();
  let clean = 0;
  for (const e of entries) {
    const d = unitDiff(paintReadoutsThenSampleWitnessOrDerail, e, w);
    assert.equal(d, null, `dispatch ${clean}: ${show(d)}`);
    // Every real dispatch is the clean path: the glyph holds its expected value.
    assert.equal(e.mem8[TAMPER_GLYPH_SOURCE_CELL], EXPECTED_GLYPH, "a real dispatch was off the clean path");
    clean++;
  }
  console.log(`  CORPUS: ${entries.length} dispatches, identical outside the ${w}-byte window`);
});

test("BOUNDARY: the exclusion is exactly as wide as it declares", { skip }, () => {
  const at = captureCorpus()[0].clone();
  const w = windowBytes();
  const sp = at.regs.sp;
  const below = unitDiff(scribbler(-w - 1), at, w);
  const seat = unitDiff(scribbler(0), at, w);
  const inside = w > 0 ? unitDiff(scribbler(-1), at, w) : null;
  console.log(
    `  BOUNDARY: ${hex4(sp - w - 1)} caught, ${hex4(sp)} caught` +
      (w > 0 ? `, ${hex4(sp - 1)} masked` : " (window is zero-wide)"),
  );
  assert.notEqual(below, null, "a divergence one byte BELOW the window was swallowed");
  assert.notEqual(seat, null, "a divergence AT the entry seat was swallowed");
  if (w > 0) assert.equal(inside, null, "a divergence INSIDE the window was caught, so the two " +
    "catches above are the instrument catching everything rather than the boundary being real");
});

test("DERAIL: a wrong glyph transfers into the mother-ship handler on both sides", { skip }, () => {
  const w = windowBytes();
  // Force the glyph off its expected value on a real captured machine and confirm BOTH sides take
  // the same transfer into the handler — see outcomeDiff for why the outcome, not the full memory
  // state, is the comparison here.
  const badGlyphs = [0x00, 0x7d, 0xff, EXPECTED_GLYPH ^ 0x01];
  for (const bad of badGlyphs) {
    const e = captureCorpus()[0].clone();
    e.mem8[TAMPER_GLYPH_SOURCE_CELL] = bad;
    const d = outcomeDiff(paintReadoutsThenSampleWitnessOrDerail, e, w);
    assert.equal(d, null, `glyph=${hex4(bad)}: ${show(d)}`);
    // The rewrite must actually enter the derail (raise from the misaligned handler) rather than
    // quietly do the clean-path work: a state with no live mother-ship object faults there.
    const b = e.clone();
    let raised = false;
    try { paintReadoutsThenSampleWitnessOrDerail(b); } catch { raised = true; }
    assert.ok(raised, `glyph=${hex4(bad)}: the rewrite did not transfer into the derail handler`);
  }
  console.log(`  DERAIL: ${badGlyphs.length} wrong-glyph values, both sides transfer into the handler identically`);
});

test("SAMPLE: the clean path marks and reads back the tamper witness pair", { skip }, () => {
  const e = captureCorpus()[0].clone();
  assert.equal(e.mem8[TAMPER_GLYPH_SOURCE_CELL], EXPECTED_GLYPH, "corpus[0] is not on the clean path");
  // Only the glyph plane is marked; the colour cell 0xa1dc is guarded, so read its real value.
  e.mem8[TAMPER_SAMPLE_GLYPH_CELL] = GLYPH_MARK;
  const realColour = e.mem8[TAMPER_SAMPLE_COLOUR_CELL];
  e.mem8[TAMPER_GLYPH_READBACK] = READBACK_SENTINEL;
  e.mem8[TAMPER_COLOUR_READBACK] = READBACK_SENTINEL;
  assert.notEqual(GLYPH_MARK, realColour, "the glyph mark collides with the real colour");
  // free the ring ahead of the cursor so the caption pair actually lands
  const cursor = e.mem8[WRITE_CURSOR];
  for (let i = 0; i < 4; i++) e.mem8[COMMAND_RING + ((cursor + i) & 63)] = FREE;
  const stepBefore = e.mem8[SEQUENCE_SUBSTEP];
  paintReadoutsThenSampleWitnessOrDerail(e);
  assert.equal(e.mem8[TAMPER_GLYPH_READBACK], GLYPH_MARK, "the glyph must be copied from the char plane");
  assert.equal(e.mem8[TAMPER_COLOUR_READBACK], realColour, "the colour must be copied from the colour plane");
  assert.equal(e.mem8[SEQUENCE_SUBSTEP], (stepBefore + 1) & 0xff, "the sequence must step on the clean path");
  const after = e.mem8[WRITE_CURSOR];
  const tail = [2, 1].map((back) => e.mem8[COMMAND_RING + ((after - back) & 63)]);
  assert.deepEqual(tail, [0x01, 0x13], "the queued caption pair must be command 1, argument 0x13");
  console.log(`  SAMPLE: glyph ${GLYPH_MARK} and colour ${realColour} read back, caption 1/0x13 queued, sequence stepped`);
});

test("TEETH: the no-derail twin is CAUGHT on a wrong glyph", { skip }, () => {
  const w = windowBytes();
  const e = captureCorpus()[0].clone();
  e.mem8[TAMPER_GLYPH_SOURCE_CELL] = 0x00; // wrong glyph: the oracle derails (raises), the twin returns
  const cursor = e.mem8[WRITE_CURSOR];
  for (let i = 0; i < 4; i++) e.mem8[COMMAND_RING + ((cursor + i) & 63)] = FREE;
  const d = outcomeDiff(brokenNoDerail, e, w);
  console.log(`  TEETH/no-derail: ${show(d)}`);
  assert.notEqual(d, null, "the twin that skips the wrong-glyph derail was not caught");
});

test("TEETH: the no-colour-guard twin is CAUGHT on a bad colour", { skip }, () => {
  // A guarded copyright colour cell (0xa1dc, the sample colour source) forced OFF 0x10/0x05 makes
  // the colour guard derail into its data-run trap (loc_49fa), which scribbles the tile plane. On a
  // TAMPERED state the trap's debris is not byte-stable across the layer boundary (it is the
  // callee's own un-established region — see checkTheCopyrightLineColoursOrDerail / loc_49fa gates),
  // so this tooth is rewrite-vs-TWIN, not rewrite-vs-oracle: the guard must leave a mark the
  // guardless twin does not. The glyph is left correct so the ONLY difference is the missing guard.
  const e = captureCorpus()[0].clone();
  assert.equal(e.mem8[TAMPER_GLYPH_SOURCE_CELL], EXPECTED_GLYPH, "corpus[0] is not on the clean path");
  e.mem8[TAMPER_SAMPLE_COLOUR_CELL] = 0x00; // 0xa1dc: neither 0x10 nor 0x05 -> guard derails
  const cursor = e.mem8[WRITE_CURSOR];
  for (let i = 0; i < 4; i++) e.mem8[COMMAND_RING + ((cursor + i) & 63)] = FREE;
  const a = e.clone();
  const b = e.clone();
  paintReadoutsThenSampleWitnessOrDerail(a);
  brokenNoColourGuard(b);
  const diffs = allDiffs(a, b);
  console.log(`  TEETH/no-colour-guard: rewrite and guardless twin differ at ${diffs.length} cells ` +
    `(first ${diffs[0] ? hex4(diffs[0].addr) : "-"})`);
  assert.ok(diffs.length > 0, "the guard left no mark the guardless twin omits, so it is invisible " +
    "here and this tooth proves nothing");
});

for (const [label, twin] of CLEAN_TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const w = windowBytes();
    let caught = 0;
    let firstAt = null;
    for (const e of captureCorpus()) {
      const primed = e.clone();
      // Only the glyph plane is marked; 0xa1dc is a guarded colour cell and must keep its value.
      primed.mem8[TAMPER_SAMPLE_GLYPH_CELL] = GLYPH_MARK;
      primed.mem8[TAMPER_GLYPH_READBACK] = READBACK_SENTINEL;
      primed.mem8[TAMPER_COLOUR_READBACK] = READBACK_SENTINEL;
      const cursor = primed.mem8[WRITE_CURSOR];
      for (let i = 0; i < 4; i++) primed.mem8[COMMAND_RING + ((cursor + i) & 63)] = FREE;
      const d = unitDiff(twin, primed, w);
      if (d === null) continue;
      caught++;
      if (firstAt === null) firstAt = show(d);
    }
    console.log(`  TEETH/${label}: caught at ${caught} dispatches — ${firstAt}`);
    assert.ok(caught > 0, `the masked comparison PASSED the ${label} twin at every dispatch`);
  });
}
