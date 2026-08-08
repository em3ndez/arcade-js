// SPDX-License-Identifier: GPL-3.0-only
/**
 * holdCopyrightThenEraseTheCoinInvitation — memory-equivalent to the frozen oracle at ROM 0x1748.
 *
 * GATE: strict unit-capture over every dispatch of an undriven attract session, one measured stack
 *   exclusion, an exhaustive crafted sweep of the delay cell, and teeth.
 *
 * ★ WHERE THE LIVE-OUT COMES FROM. The routine is not reached by any `call` in the image; a jump
 *   table dispatched from ROM 0x1651 through the RST 0x30 handler arrives here with 0x167B pushed
 *   as the return, so BOTH exits — the early return while the delay is still counting, and the
 *   tail transfer that steps the sequence on — land on 0x167B. That routine's first instruction is
 *   `ld a,(0xA986)`, which overwrites the accumulator and its flags before reading anything; it
 *   then transfers to 0x0F11, 0x15B6 or 0x1690, and each of those three loads every register it
 *   uses from memory or an immediate before reading one. So NO register is live out of this
 *   routine and the live-out is memory only. The ceiling below is wide for that reason, not
 *   because the rewrite happens to be untidy.
 *
 * ★ THE ORACLE PUSHES AND THE REWRITE DOES NOT. The oracle reaches its four callees through the
 *   registry, so their return addresses land below the entry seat and it then takes a return the
 *   dissolved chain never takes. The window is MEASURED — the WINDOW arm instruments the oracle's
 *   own `push16` over this file's whole sweep — never assumed and never copied from another gate.
 *
 * What it exercises, holes stated:
 *   1. EQUAL      — identical across the whole state dump outside the measured window, at the one
 *                   captured dispatch where the delay actually expires.
 *   1b. REACHED   — the coin-and-start tape the shared harness drives also dispatches it, so the
 *                   attract-only corpus is not the only path in.
 *   2. WINDOW     — the oracle's own deepest push, measured over the whole sweep and PINNED, so a
 *                   change that deepens its stack traffic turns this gate red instead of being
 *                   absorbed by a wider mask.
 *   3. BOUNDARY   — a planted divergence one byte BELOW the window is caught, one AT the entry
 *                   seat is caught, and one INSIDE is masked. The third is what shows the first
 *                   two are not simply the instrument catching everything.
 *   4. CORPUS     — every dispatch of the session, replayed from its own captured machine. The
 *                   session happens to present all 256 delay values and both parities of the
 *                   frame counter, and that coverage is asserted rather than hoped for.
 *   5. EXPIRES    — the expiring frame is ONE dispatch in the corpus, so the arms that see the
 *                   sampling and the two queued commands are crafted: the delay is forced to its
 *                   last frame on a real machine and the effects read back by value. The crafted
 *                   machine also POISONS the caption strip's own cells, because restamping is
 *                   idempotent and a twin that skips it is otherwise invisible on a screen that
 *                   already carries the strip — measured, and asserted in the arm.
 *   6. EXCLUDED   — no register outside the declared ceiling moves, with a twin that moves one as
 *                   the in-arm control that the measurement can see one.
 *   7. TEETH      — six twins with their exact catch counts over the crafted sweep.
 *
 * HOLE: the four callees are gated by their own files. What this file gates is that all four are
 * reached, in order, on the right frames — and which cells the sampling reads and writes.
 * HOLE: the ring may be full, in which case a queued pair is dropped and the two command twins go
 * invisible. The corpus is not filtered for that; the crafted sweep frees eight cells ahead of the
 * write cursor first — the flashing call takes a pair of its own before these two — so the
 * commands are observable, and the arm reads the cursor AFTERWARDS rather than assuming where
 * they landed.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-1748.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { holdCopyrightThenEraseTheCoinInvitation } from "../holdCopyrightThenEraseTheCoinInvitation.js";
import { stampCopyrightStrip } from "../stampCopyrightStrip.js";
import { flashCopyrightLine } from "../flashCopyrightLine.js";
import { postCommand } from "../postCommand.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { loc_1748 as oracle } from "../../translated/loc_1748.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { COMMAND_RING, FRAME_TICK, SEQUENCE_DELAY, SEQUENCE_SUBSTEP } from "../names.js";

const TARGET = 0x1748;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SAMPLED_GLYPH_CELL = 0xa63c;
const SAMPLED_COLOUR_CELL = 0xa23c;
const KEEP = 0xacc7;
const WRITE_CURSOR = 0xa9b2;
const FREE = 255;

/** Measured by the WINDOW arm: the deepest the oracle's own pushes reach below the entry seat. */
const SCRATCH_BYTES = 4;

/**
 * The ceiling on divergence, and the whole of it. Derived from the exit successor, which loads
 * every register it uses before reading one — not from the rewrite. Not a set the rewrite is
 * required to fill: one that diverged on fewer still passes, so this can never refuse a fix.
 */
const MOVED = ["a", "f", "b", "c", "d", "e", "h", "l", "iy", "sp"];

const DELAYS = Array.from({ length: 256 }, (_unused, d) => d);
/** Values no glyph or colour on this screen holds, so a copy of either one is visible. */
const GLYPH_MARK = 0x5b;
const COLOUR_MARK = 0x2d;

/**
 * The caption strip's own cells, derived here rather than imported, and a marker byte the strip
 * cannot lay down. Restamping is IDEMPOTENT, so on a screen that already carries the strip a twin
 * that skips it is invisible; filling these first is what makes the stamp observable at all.
 */
const STRIP_CELLS = [];
for (let piece = 0; piece < 4; piece++) {
  const entry = 0xaa10 + piece * 2;
  STRIP_CELLS.push(entry, entry + 1, entry + 48, entry + 49);
}
const STRIP_POISON = 0x6e;

/** Ring cells freed ahead of the cursor: two for the flashing call, four for the two pairs. */
const RING_CELLS_FREED = 8;

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

/** The masked window, and nothing else: the bytes the oracle's own pushes reach and no others. */
const inScratch = (addr, sp) => addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;

/**
 * Oracle vs candidate on clones of `machine`: the whole dump masked to the measured window, then
 * every register outside the ceiling. Only the candidate's side is wrapped, because a raise from
 * the oracle is a harness fault and must not be swallowed.
 */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, reg: "raised", a: "returned", b: String(e).slice(0, 40) };
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

/** The one captured dispatch on which the delay reaches zero, if the session produced one. */
function expiringEntry() {
  return captureCorpus().find((mm) => mm.mem8[SEQUENCE_DELAY] === 1);
}

/**
 * A real machine with the delay forced to `delay` and the sampled pair marked. The ring's two
 * next cells are freed as well, so a queued command actually lands rather than being dropped —
 * without that the two command twins would be invisible for a reason unrelated to them.
 */
function withDelay(delay) {
  const mm = captureCorpus()[0].clone();
  mm.mem8[SEQUENCE_DELAY] = delay;
  mm.mem8[SAMPLED_GLYPH_CELL] = GLYPH_MARK;
  mm.mem8[SAMPLED_COLOUR_CELL] = COLOUR_MARK;
  for (const cell of STRIP_CELLS) mm.mem8[cell] = STRIP_POISON;
  const cursor = mm.mem8[WRITE_CURSOR];
  for (let i = 0; i < RING_CELLS_FREED; i++) mm.mem8[COMMAND_RING + ((cursor + i) & 63)] = FREE;
  return mm;
}

/** Every machine this file compares on. What the WINDOW arm measures the oracle over. */
function sweep() {
  return [...captureCorpus(), ...DELAYS.map(withDelay)];
}

// ── broken twins ────────────────────────────────────────────────────────────────────────
// Each is the module with one thing wrong, built the way the module is built — direct calls to
// the four callees. A twin reaching them through the registry would match the oracle's stack
// traffic and so would never be masked, which would let the teeth pass without exercising the
// exclusion.

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: never restamps, so the caption decays as anything else overwrites it. */
function brokenNoStamp(m) {
  const { mem8 } = m;
  flashCopyrightLine(m);
  const left = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
  mem8[SEQUENCE_DELAY] = left;
  if (left !== 0) return;
  mem8[KEEP] = mem8[SAMPLED_GLYPH_CELL];
  mem8[KEEP + 1] = mem8[SAMPLED_COLOUR_CELL];
  postCommand(m, 3, 3);
  postCommand(m, 3, 4);
  advanceSequenceSubStep(m);
}

/** BUG: leaves the delay standing, so the step never ends. */
function brokenNoCountdown(m) {
  stampCopyrightStrip(m);
  flashCopyrightLine(m);
}

/** BUG: samples the colour from the glyph plane, so the kept pair is two glyphs. */
function brokenSamplesOnePlane(m) {
  const { mem8 } = m;
  stampCopyrightStrip(m);
  flashCopyrightLine(m);
  const left = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
  mem8[SEQUENCE_DELAY] = left;
  if (left !== 0) return;
  mem8[KEEP] = mem8[SAMPLED_GLYPH_CELL];
  mem8[KEEP + 1] = mem8[SAMPLED_GLYPH_CELL];
  postCommand(m, 3, 3);
  postCommand(m, 3, 4);
  advanceSequenceSubStep(m);
}

/** BUG: queues the same argument twice instead of stepping it. */
function brokenSameArgument(m) {
  const { mem8 } = m;
  stampCopyrightStrip(m);
  flashCopyrightLine(m);
  const left = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
  mem8[SEQUENCE_DELAY] = left;
  if (left !== 0) return;
  mem8[KEEP] = mem8[SAMPLED_GLYPH_CELL];
  mem8[KEEP + 1] = mem8[SAMPLED_COLOUR_CELL];
  postCommand(m, 3, 3);
  postCommand(m, 3, 3);
  advanceSequenceSubStep(m);
}

/** BUG: never leaves the step, so the sequence stalls here after the delay runs out. */
function brokenNoAdvance(m) {
  const { mem8 } = m;
  stampCopyrightStrip(m);
  flashCopyrightLine(m);
  const left = (mem8[SEQUENCE_DELAY] - 1) & 0xff;
  mem8[SEQUENCE_DELAY] = left;
  if (left !== 0) return;
  mem8[KEEP] = mem8[SAMPLED_GLYPH_CELL];
  mem8[KEEP + 1] = mem8[SAMPLED_COLOUR_CELL];
  postCommand(m, 3, 3);
  postCommand(m, 3, 4);
}

/** BUG: scribbles on an index register, the in-arm control for the ceiling. */
function brokenMovesIndex(m) {
  holdCopyrightThenEraseTheCoinInvitation(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["no-stamp", brokenNoStamp],
  ["no-countdown", brokenNoCountdown],
  ["samples-one-plane", brokenSamplesOnePlane],
  ["same-argument", brokenSameArgument],
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

test("EQUAL at the expiring dispatch: identical outside the measured window", { skip }, () => {
  const e = expiringEntry();
  assert.notEqual(e, undefined, "vacuous: no captured dispatch reached the last frame of the delay");
  const sp = e.regs.sp;
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  holdCopyrightThenEraseTheCoinInvitation(b);
  const all = allDiffs(a, b);
  const strays = all.filter((d) => !inScratch(d.addr, sp));
  console.log(
    `  EQUAL: seat ${hex4(sp)}; ${all.length} differing bytes, ${strays.length} outside the window`,
  );
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.ok(all.length <= SCRATCH_BYTES, "more bytes differ than the window is wide");
});

test("REACHED: the shared harness enters the routine too", { skip }, () => {
  const r = unitEquivalence(makeMachine, TARGET, oracle, holdCopyrightThenEraseTheCoinInvitation, {
    maxFrames: ENTRY_FRAMES,
  });
  assert.notEqual(r.pc, undefined, "the harness returned no verdict");
  console.log("  REACHED: the coin-and-start tape dispatches the routine as well as attract");
});

test("WINDOW: the oracle's own deepest push, measured over the whole sweep", { skip }, () => {
  let deepest = 0;
  for (const m of sweep()) deepest = Math.max(deepest, oracleDepth(m));
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is no longer the measured one and every arm below is masking the wrong bytes");
});

test("BOUNDARY: the exclusion is exactly as wide as it declares", { skip }, () => {
  const at = withDelay(1);
  const sp = at.regs.sp;
  const below = unitDiff(scribbler(-SCRATCH_BYTES - 1), at);
  const seat = unitDiff(scribbler(0), at);
  const inside = unitDiff(scribbler(-1), at);
  console.log(
    `  BOUNDARY: ${hex4(sp - SCRATCH_BYTES - 1)} caught, ${hex4(sp)} caught, ${hex4(sp - 1)} masked`,
  );
  assert.notEqual(below, null, "a divergence one byte BELOW the window was swallowed, so the " +
    "exclusion is wider than it declares and a leaking stack pointer would walk out of sight");
  assert.notEqual(seat, null, "a divergence AT the entry seat was swallowed: the window must lie " +
    "strictly below the seat, and live stack above it must still fail");
  assert.equal(inside, null, "a divergence INSIDE the window was caught, so the two catches above " +
    "are the instrument catching everything rather than the boundary being where it says");
});

test("CORPUS: every captured dispatch replays identically", { skip }, () => {
  const entries = captureCorpus();
  const delays = new Set(entries.map((e) => e.mem8[SEQUENCE_DELAY]));
  const even = entries.filter((e) => (e.mem8[FRAME_TICK] & 1) === 0).length;
  assert.equal(delays.size, 256, `the session presented ${delays.size} delay values, not all 256`);
  assert.ok(even > 0 && even < entries.length, "one parity of the frame counter is missing, so " +
    "only one of the flashing routine's two arms is covered by real states");
  for (const e of entries) {
    const d = unitDiff(holdCopyrightThenEraseTheCoinInvitation, e);
    assert.equal(d, null, `delay=${e.mem8[SEQUENCE_DELAY]}: ${show(d)}`);
  }
  console.log(
    `  CORPUS: ${entries.length} dispatches, ${delays.size} distinct delays, ` +
      `${even} on an even frame and ${entries.length - even} on an odd one`,
  );
});

test("EXPIRES: the crafted last frame really samples and really queues", { skip }, () => {
  for (const delay of DELAYS) {
    const d = unitDiff(holdCopyrightThenEraseTheCoinInvitation, withDelay(delay));
    assert.equal(d, null, `delay=${delay}: ${show(d)}`);
  }

  const waiting = withDelay(9);
  const beforeSubStep = waiting.mem8[SEQUENCE_SUBSTEP];
  holdCopyrightThenEraseTheCoinInvitation(waiting);
  assert.equal(waiting.mem8[SEQUENCE_DELAY], 8, "the delay must come down by one while waiting");
  assert.equal(waiting.mem8[SEQUENCE_SUBSTEP], beforeSubStep, "the step must not move while the " +
    "delay is still counting");

  const expiring = withDelay(1);
  const stepBefore = expiring.mem8[SEQUENCE_SUBSTEP];
  holdCopyrightThenEraseTheCoinInvitation(expiring);
  assert.equal(expiring.mem8[SEQUENCE_DELAY], 0, "the delay must reach zero on the last frame");
  assert.equal(expiring.mem8[KEEP], GLYPH_MARK, "the glyph must be taken from the character plane");
  assert.equal(expiring.mem8[KEEP + 1], COLOUR_MARK, "the second byte must be taken from the " +
    "COLOUR plane; sampling the same plane twice keeps a glyph where a colour belongs");
  // The flashing call queues a pair of its own on some frames, so the cursor is read AFTER and
  // the two pairs this routine appends are the last four cells it passed over.
  const after = expiring.mem8[WRITE_CURSOR];
  const tail = [4, 3, 2, 1].map((back) => expiring.mem8[COMMAND_RING + ((after - back) & 63)]);
  assert.deepEqual(tail, [3, 3, 3, 4], "the last two pairs queued must be the command with its " +
    "argument and then the same command with the next argument");
  assert.equal(expiring.mem8[SEQUENCE_SUBSTEP], (stepBefore + 1) & 0xff, "the sequence must move " +
    "on when the delay expires");
  assert.ok(STRIP_CELLS.every((cell) => expiring.mem8[cell] !== STRIP_POISON),
    "a poisoned caption cell survived, so the strip was not restamped and the no-stamp twin " +
      "below would be invisible");
  console.log(`  EXPIRES: 256 delays identical; the pair ${GLYPH_MARK}/${COLOUR_MARK} is kept, ` +
    `the ring's last two pairs are 3,3 then 3,4, and all ${STRIP_CELLS.length} strip cells were ` +
    "restamped over the marker");
});

/** Which registers a candidate parts company with the oracle on, over the whole sweep. */
function movedOver(candidate) {
  const moved = new Set();
  for (const m of sweep()) {
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
}

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const moved = movedOver(holdCopyrightThenEraseTheCoinInvitation);
  // The absence below is only evidence if the same measurement CAN report a register outside the
  // ceiling. The index-scribbling twin moves one, and the control asserts it is seen.
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that scribbles on an " +
      "index register, so a clean reading below proves nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}; the control twin also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  // MOVED is a CEILING. deepEqual against it would DEMAND the divergence and go RED on a rewrite
  // that became register-exact — a gate that requires a wart refuses the fix.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    let caught = 0;
    let firstAt = null;
    for (const delay of DELAYS) {
      const d = unitDiff(twin, withDelay(delay));
      if (d === null) continue;
      caught++;
      if (firstAt === null) firstAt = `delay=${delay} ${show(d)}`;
    }
    console.log(`  TEETH/${label}: caught at ${caught} of ${DELAYS.length} delays — ${firstAt}`);
    assert.ok(caught > 0, `the masked comparison PASSED the ${label} twin at every delay`);
  });
}
