// SPDX-License-Identifier: GPL-3.0-only
/**
 * showCreditLine — memory-equivalent to the frozen oracle at ROM 0x2D3F.
 *
 * WHAT IT IS. A free-play short circuit, a panel repaint, one queued caption request, a guard
 * byte, and a twenty-byte fold handed down a tail chain. Every callee of those is
 * ALREADY DECOMPILED — 0x0F1A, 0x4AFB, the queue at 0x0038, 0x0B06, 0x0B39 and the fold at
 * 0x43E8 — so the rewrite calls each of them directly and dissolving those transfers belongs
 * to this caller's unit. One further transfer has no callee at all: on a raised guard the ROM
 * jumps into 0x2E3E, a velocity TABLE read as data rather than a routine, so the rewrite reaches it
 * the only way the frozen form does — through the dispatch registry, where nothing is registered
 * and the transfer RAISES. That is reproduced, not repaired.
 *
 * ★ TWO SEAM SHAPES IN ONE ROUTINE, and the gate asserts both. The free-play arm ends in a
 *   dissolved call, so the rewrite omits the ROM `ret` and comes back with SP where it found it.
 *   Every other arm ends by transferring into a chain that is still frozen from 0x07AD on, and
 *   that chain performs the `ret` itself — so on those arms the rewrite comes back with SP UP TWO
 *   and pc on the caller's return address, exactly as the oracle does. A dispatch seam that
 *   assumed either shape for the whole routine would be wrong half the time.
 *
 * ★ THE ORACLE PUSHES AND THE REWRITE DOES NOT, so DEAD STACK SCRATCH is left below the seat. The
 *   window is MEASURED — the WINDOW arm instruments the oracle's own `push16` over this file's
 *   whole sweep — never assumed and never copied from another gate.
 *
 * WHY THE LIVE-OUT IS MEMORY ONLY, derived from the ORACLE's exit successors and not from the
 *   module: every returning exit lands on 0x167B, which re-reads all three of its inputs out of
 *   memory before it branches, so no register this entry leaves is read before it is overwritten;
 *   the raising exit reaches no successor at all. Confirmed by running the tape: the oracle's pc
 *   after the captured dispatch is 0x167B.
 *
 * GATE: strict unit-capture at the real dispatch with one measured exclusion, plus CRAFTED arms,
 *   because the tape reaches this entry once and on one path. One-cell nudges make the rest:
 *   the free-play cell, the guard byte, the frame counter's parity and the ring cell the write
 *   cursor names.
 *
 *   1. EQUAL      — identical across the whole state dump outside the measured window, at the real
 *                   dispatch and over every crafted arm.
 *   2. SEAM       — the two shapes above, asserted per arm.
 *   3. WINDOW     — the oracle's own deepest push, measured over the whole sweep and PINNED.
 *   4. BOUNDARY   — the exclusion is exactly as wide as it declares: one byte BELOW the window is
 *                   caught, one AT the entry seat is caught, one INSIDE is masked.
 *   5. THE TRAP   — on a raised guard both sides raise, with the SAME message naming the SAME
 *                   transfer target, and on a clear guard neither raises. The second half is what
 *                   stops the first from being an instrument that raises on everything.
 *   6. ARMS ARE DISTINGUISHABLE — the frame counter's two parities and the ring cell's two states
 *                   really change what the ORACLE writes, so the arms scored on them are not
 *                   scored on a difference that does not exist.
 *   7. THE BLOCK HANDED ON — measured at the 0x07AD seam into still-frozen code: the total and the
 *                   end pointer the rewrite hands on are the oracle's own, flipping a byte INSIDE
 *                   the block moves that total on both sides alike, and flipping either flanking
 *                   byte moves neither. That is the block's extent measured rather than read off
 *                   the module.
 *   8. EXCLUDED   — no register outside the declared CEILING moves, with a two-sided control.
 *   9. CALLS, NOT RESTATES — the module's text: it must name each callee's file and call it rather
 *                   than carry that callee's body, with each callee's own body as a control.
 *  10. TEETH      — broken twins with measured catch counts over the sweep.
 *
 * ★ HOLE, MEASURED AND NAMED RATHER THAN MASKED. On a TAMPERED image the frozen chain past 0x07AD
 * takes its other exit, and that exit reads registers the rewrite's already-decompiled callees do
 * not reproduce — the caption stamper leaves an index register set and the queue path leaves a
 * byte register set, both of which are those callees' own declared divergences. Two sprite bytes
 * then differ. Attributed, not assumed: a reference candidate identical to the module except that
 * it reaches those callees through the registry instead agrees with the oracle on both
 * registers at the seam. So this gate compares the chain only on an untampered image, and states
 * that rather than widening a mask over it.
 * HOLE: every callee is gated by its own file. What this file gates is the two tests, the
 * two constants handed to the queue, the block handed to the fold, and the dissolves.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2d3f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { showCreditLine } from "../showCreditLine.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { flashCopyrightLine } from "../flashCopyrightLine.js";
import { loc_4afb } from "../loc_4afb.js";
import { postCommand } from "../postCommand.js";
import { stampCopyrightStrip } from "../stampCopyrightStrip.js";
import { sumImageBlockForTheTamperCheck } from "../sumImageBlockForTheTamperCheck.js";
import { loc_2d3f as oracle } from "../../translated/loc_2d3f.js";
import { COMMAND_RING, FRAME_TICK, FREE_PLAY } from "../names.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x2d3f;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CAPTION_COMMAND = 1;
const CAPTION_RECORD = 8;
const GUARD_RESULT = 0xa817;
const TRAP = 0x2e3e;
const BLOCK_START = 0x086b;
const BLOCK_BYTES = 20;
const WRITE_CURSOR = 0xa9b2;
const SEAM = 0x07ad;
const PANEL_CELL = 0xa47f;

/** Measured by the WINDOW arm: the deepest the oracle's own pushes reach below the entry seat. */
const SCRATCH_BYTES = 10;

/**
 * The ceiling on register divergence, and the whole of it: the oracle marshals its callees through
 * registers, and on the free-play arm it takes a return the dissolved call does not. Not a set the
 * rewrite is REQUIRED to fill — a rewrite that diverged on fewer still passes.
 */
const CEILING = ["a", "f", "c", "d", "e", "h", "l", "iy", "sp"];
/** Outside the ceiling, so the EXCLUDED arm can show the measurement reports one. */
const OUTSIDE = "ix";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

const HELPERS = [
  ["advanceSequenceSubStep", "../advanceSequenceSubStep.js", "SEQUENCE_SUBSTEP"],
  ["loc_4afb", "../loc_4afb.js", "PEN_COLOUR"],
  ["postCommand", "../postCommand.js", "RING_CELLS"],
  ["stampCopyrightStrip", "../stampCopyrightStrip.js", "PIECE_PITCH"],
  ["flashCopyrightLine", "../flashCopyrightLine.js", "ARGUMENT_ON_THE_ODD_TURN"],
  ["sumImageBlockForTheTamperCheck", "../sumImageBlockForTheTamperCheck.js", "LENGTH_ZERO_MEANS"],
];

function callsRatherThanRestates(text, [name, file, ownName]) {
  const called = new RegExp(`\\b${name}\\(\\s*m[,)]`);
  return text.includes(`from "./${file.slice(3)}"`) && called.test(text) && !text.includes(ownName);
}

// ── capture and craft ───────────────────────────────────────────────────────────────────

let entries = null;

function captured() {
  if (entries === null) {
    const got = [];
    const host = makeMachine(new Map([[TARGET, (mm) => {
      got.push(mm.clone());
      return oracle(mm);
    }]]));
    host.runFrames(ENTRY_FRAMES);
    assert.equal(host.stoppedBy, null, `the tape stopped early: ${host.stoppedBy}`);
    entries = got;
  }
  assert.ok(entries.length > 0, "vacuous: the tape never reached the routine");
  return entries;
}

const entryState = () => captured()[0];

/** A real captured machine with the named cells nudged, one arm at a time. */
function craft({ freePlay = null, guard = null, tick = null, ringFree = null } = {}) {
  const m = entryState().clone();
  if (freePlay !== null) m.mem8[FREE_PLAY] = freePlay;
  if (guard !== null) m.mem8[GUARD_RESULT] = guard;
  if (tick !== null) m.mem8[FRAME_TICK] = (m.mem8[FRAME_TICK] & ~1) | tick;
  if (ringFree !== null) {
    const cell = COMMAND_RING + m.mem8[WRITE_CURSOR];
    m.mem8[cell] = ringFree ? 0xff : 0x00;
  }
  return m;
}

function craftedCases() {
  return [
    ["free-play", craft({ freePlay: 1 })],
    ["free-play-all-bits", craft({ freePlay: 0xff })],
    ["guard-raised", craft({ guard: 1 })],
    ["guard-raised-all-bits", craft({ guard: 0xff })],
    ["tick-even", craft({ tick: 0 })],
    ["tick-odd", craft({ tick: 1 })],
    ["ring-free", craft({ ringFree: true })],
    ["ring-occupied", craft({ ringFree: false })],
    ["tick-odd-ring-occupied", craft({ tick: 1, ringFree: false })],
    ["tick-even-ring-free", craft({ tick: 0, ringFree: true })],
  ];
}

let crafted = null;
const craftedOnce = () => (crafted ??= craftedCases());

function sweep() {
  return [...captured().map((m, i) => [`captured-${i}`, m]), ...craftedOnce()];
}

// ── comparison ──────────────────────────────────────────────────────────────────────────

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

function inScratch(addr, sp) {
  return addr !== null && addr >= sp - SCRATCH_BYTES && addr < sp;
}

/**
 * Run one side, reporting the raise rather than letting it escape. BOTH sides are wrapped here,
 * unlike the other gates in this directory, because one arm of this routine is SPECIFIED to raise:
 * an unwrapped oracle would turn that arm's correct behaviour into a harness fault.
 */
function runSide(fn, m) {
  try {
    fn(m);
    return null;
  } catch (e) {
    return String(e.message ?? e);
  }
}

function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  const raisedA = runSide(oracle, a);
  const raisedB = runSide(candidate, b);
  if (raisedA !== raisedB) {
    return { addr: null, reg: "raise", a: raisedA ?? "returned", b: raisedB ?? "returned" };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  for (const k of REG_FIELDS) {
    if (CEILING.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, reg: k, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

const show = (d) => {
  if (!d) return "identical";
  return d.addr === null
    ? `${d.reg}: oracle=${d.a} candidate=${d.b}`
    : `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}`;
};

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
  runSide(oracle, c);
  return seat - deepest;
}

/**
 * The registers a side hands into the still-frozen chain, sampled by standing a probe in this
 * clone's OWN dispatch map at the chain's head so nothing past it runs. The clone gets its own map
 * rather than the shared one, or every later arm would inherit the probe.
 */
function seamRegs(fn, machine) {
  const m = machine.clone();
  m.routines = new Map(m.routines);
  let snap = null;
  m.routines.set(SEAM, (mm) => {
    if (snap === null) {
      snap = {};
      for (const k of REG_FIELDS) snap[k] = mm.regs[k];
    }
  });
  runSide(fn, m);
  return snap;
}

/** Run `fn` with ONE byte of the shared program image flipped, and always put it back. */
function withFlippedImageByte(addr, fn) {
  const rom = entryState().rom;
  const was = rom[addr];
  rom[addr] = was ^ 0xff;
  try {
    return fn();
  } finally {
    rom[addr] = was;
  }
}

function scribbler(offset) {
  return (m) => {
    const at = (m.regs.sp + offset) & 0xffff;
    oracle(m);
    m.mem8[at] ^= 0xff;
  };
}

function regScribbler(k) {
  return (m) => {
    oracle(m);
    m.regs[k] = m.regs[k] ^ 1;
  };
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

function build(o = {}) {
  const opt = {
    honourFreePlay: true, alwaysFreePlay: false, honourGuard: true, alwaysTrap: false,
    repaint: true, queue: true, command: CAPTION_COMMAND, record: CAPTION_RECORD,
    stamp: true, flash: true, start: BLOCK_START, length: BLOCK_BYTES, ...o,
  };
  return (m) => {
    const { mem8 } = m;
    if (opt.alwaysFreePlay || (opt.honourFreePlay && mem8[FREE_PLAY] !== 0)) {
      advanceSequenceSubStep(m);
      return;
    }
    if (opt.repaint) loc_4afb(m);
    if (opt.queue) postCommand(m, opt.command, opt.record);
    if (opt.alwaysTrap || (opt.honourGuard && mem8[GUARD_RESULT] !== 0)) return m.call(TRAP);
    if (opt.stamp) stampCopyrightStrip(m);
    if (opt.flash) flashCopyrightLine(m);
    return sumImageBlockForTheTamperCheck(m, opt.start, opt.length);
  };
}

/** BUG: does nothing — the twin that proves the comparison sees a real dispatch. */
function brokenNoOp() {}

const TWINS = [
  ["no-op", brokenNoOp],
  ["ignores-free-play", build({ honourFreePlay: false })],
  ["always-free-play", build({ alwaysFreePlay: true })],
  ["ignores-the-guard", build({ honourGuard: false })],
  ["always-traps", build({ alwaysTrap: true })],
  ["no-panel-repaint", build({ repaint: false })],
  ["no-caption-request", build({ queue: false })],
  ["wrong-caption-command", build({ command: CAPTION_COMMAND + 1 })],
  ["wrong-caption-record", build({ record: CAPTION_RECORD + 1 })],
  ["no-strip-stamp", build({ stamp: false })],
  ["no-line-flash", build({ flash: false })],
  ["block-starts-one-byte-on", build({ start: BLOCK_START + 1 })],
  ["block-one-byte-short", build({ length: BLOCK_BYTES - 1 })],
];

function caughtOver(candidate) {
  let caught = 0;
  let first = null;
  for (const [, m] of sweep()) {
    const d = unitDiff(candidate, m);
    if (!d) continue;
    caught++;
    first ??= d;
  }
  return { caught, first };
}

/** Measured catch counts over the sweep. A move in any of them is a finding, and zeros are kept. */
const CATCHES = {
  "no-op": 11,
  // Only the two free-play machines; everywhere else this twin does what the module does.
  "ignores-free-play": 2,
  "always-free-play": 9,
  // Only the two machines whose guard is raised, and there it is the RAISE that differs.
  "ignores-the-guard": 2,
  // Every machine that reaches the guard test with it clear.
  "always-traps": 7,
  "no-panel-repaint": 9,
  // Not the machines whose ring cell is occupied: there the request is dropped either way, so a
  // wrong request and no request at all leave the same memory.
  "no-caption-request": 7,
  "wrong-caption-command": 7,
  "wrong-caption-record": 7,
  "no-strip-stamp": 7,
  // Same blindness as the caption twins, on the two machines whose ring cell is occupied.
  "no-line-flash": 5,
  "block-starts-one-byte-on": 7,
  "block-one-byte-short": 7,
};

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at every real dispatch and over every crafted arm", { skip }, () => {
  for (const [label, m] of sweep()) {
    const d = unitDiff(showCreditLine, m);
    assert.equal(d, null, `${label}: ${show(d)}`);
  }
  const e = entryState();
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  showCreditLine(b);
  const diffs = allDiffs(a, b);
  assert.ok(diffs.length <= SCRATCH_BYTES, "more bytes differ than the window is wide");
  console.log(
    `  EQUAL: ${captured().length} dispatch(es) within ${ENTRY_FRAMES} frames and ` +
      `${craftedOnce().length} crafted arms, seat ${hex4(e.regs.sp)}; ${diffs.length} differing ` +
      "bytes at the real dispatch, all inside the window",
  );
});

test("SEAM: the chain arm returns for itself, the free-play arm does not", { skip }, () => {
  const e = entryState();
  const chainO = e.clone();
  const chainC = e.clone();
  oracle(chainO);
  showCreditLine(chainC);
  assert.equal(chainC.regs.sp, chainO.regs.sp, "on the chain arm the rewrite must come back with " +
    "the stack where the oracle leaves it, because the still-frozen chain performs the return");
  assert.equal(chainC.pc, chainO.pc, "on the chain arm the rewrite must come back on the same pc");
  assert.equal(chainC.regs.sp, (e.regs.sp + 2) & 0xffff, "the chain arm did not pop a slot at all");

  const free = craft({ freePlay: 1 });
  const freeC = free.clone();
  showCreditLine(freeC);
  assert.equal(freeC.regs.sp, free.regs.sp, "on the free-play arm the rewrite must leave the " +
    "stack pointer where it found it, so a dispatch seam knows to supply the return");
  assert.equal(freeC.pc, free.pc, "the free-play arm stepped, so it is not ret-free after all");
  console.log(
    `  SEAM: chain arm sp ${hex4(e.regs.sp)} -> ${hex4(chainC.regs.sp)} pc ${hex4(chainC.pc)}; ` +
      `free-play arm sp unmoved at ${hex4(freeC.regs.sp)}`,
  );
});

test("WINDOW: the oracle's own deepest push, measured over the whole sweep", { skip }, () => {
  let deepest = 0;
  for (const [, m] of sweep()) deepest = Math.max(deepest, oracleDepth(m));
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is no longer the measured one and every arm below is masking the wrong bytes");
});

test("BOUNDARY: the exclusion is exactly as wide as it declares", { skip }, () => {
  const sp = entryState().regs.sp;
  const below = unitDiff(scribbler(-SCRATCH_BYTES - 1), entryState());
  const seat = unitDiff(scribbler(0), entryState());
  const inside = unitDiff(scribbler(-1), entryState());
  console.log(
    `  BOUNDARY: ${hex4(sp - SCRATCH_BYTES - 1)} caught, ${hex4(sp)} caught, ` +
      `${hex4(sp - 1)} masked`,
  );
  assert.notEqual(below, null, "a divergence one byte BELOW the window was swallowed, so the " +
    "exclusion is wider than it declares and a leaking stack pointer would walk out of sight");
  assert.notEqual(seat, null, "a divergence AT the entry seat was swallowed: the window must lie " +
    "strictly below the seat, and live stack above it must still fail");
  assert.equal(inside, null, "a divergence INSIDE the window was caught, so the catches above " +
    "are the instrument catching everything rather than the boundary being where it says");
});

test("THE TRAP: a raised guard raises on both sides, a clear one on neither", { skip }, () => {
  const raised = craft({ guard: 1 });
  const fromOracle = runSide(oracle, raised.clone());
  const fromRewrite = runSide(showCreditLine, raised.clone());
  assert.notEqual(fromOracle, null, "the oracle did not raise on a raised guard, so this arm is " +
    "not the trap it is written to be and the agreement below means nothing");
  assert.equal(fromRewrite, fromOracle, "the rewrite did not raise the same way as the oracle");
  assert.ok(fromOracle.includes(hex4(TRAP)), "the raise does not name the transfer target, so it " +
    "could be any failure at all rather than the transfer into a place holding no routine");
  // The control: without the nudge NEITHER side raises, so the agreement above is about the guard
  // and not about an instrument that raises on everything.
  const clear = entryState();
  assert.equal(runSide(oracle, clear.clone()), null, "the oracle raises with the guard clear");
  assert.equal(runSide(showCreditLine, clear.clone()), null, "the rewrite raises with the guard clear");
  console.log(`  TRAP: both sides raise — ${fromOracle}; with the guard clear neither does`);
});

test("ARMS ARE DISTINGUISHABLE: parity and ring state change what is written", { skip }, () => {
  const after = (m) => {
    const c = m.clone();
    oracle(c);
    return c.dumpState();
  };
  const even = after(craft({ tick: 0, ringFree: true }));
  const odd = after(craft({ tick: 1, ringFree: true }));
  assert.notDeepEqual(even, odd, "the frame counter's two parities leave the same memory, so the " +
    "arms scored on them are scored on a difference that does not exist");
  const free = craft({ ringFree: true });
  const busy = craft({ ringFree: false });
  const cell = COMMAND_RING + free.mem8[WRITE_CURSOR];
  const freeAfter = free.clone();
  const busyAfter = busy.clone();
  oracle(freeAfter);
  oracle(busyAfter);
  assert.notEqual(freeAfter.mem8[cell], 0xff, "the queue wrote nothing into a free ring cell");
  assert.equal(busyAfter.mem8[cell], 0x00, "the queue overwrote an occupied ring cell, so the " +
    "drop this gate scores the caption arms against does not happen");
  console.log(`  ARMS: parity changes memory; ring cell ${hex4(cell)} takes a byte when free and ` +
    "keeps its own when occupied");
});

test("THE BLOCK HANDED ON, measured at the seam into still-frozen code", { skip }, () => {
  const base = entryState();
  const fromOracle = seamRegs(oracle, base);
  const fromRewrite = seamRegs(showCreditLine, base);
  assert.notEqual(fromOracle, null, "the oracle never reached the chain, so nothing was measured");
  assert.notEqual(fromRewrite, null, "the rewrite never reached the chain");
  assert.equal(fromRewrite.a, fromOracle.a, "the total handed on differs, so the rewrite folded " +
    "a different block, or folded it differently");
  const endPointer = (s) => (s.h << 8) | s.l;
  assert.equal(endPointer(fromRewrite), endPointer(fromOracle), "the end pointer differs");
  assert.equal(endPointer(fromOracle), BLOCK_START + BLOCK_BYTES, "the oracle's own end pointer " +
    "is not where this gate says the block ends");

  const inside = [BLOCK_START, BLOCK_START + BLOCK_BYTES - 1];
  const flanking = [BLOCK_START - 1, BLOCK_START + BLOCK_BYTES];
  for (const addr of inside) {
    withFlippedImageByte(addr, () => {
      const o = seamRegs(oracle, base);
      const r = seamRegs(showCreditLine, base);
      assert.notEqual(o.a, fromOracle.a, `flipping ${hex4(addr)} did not move the total, ` +
        "so that byte is not in the folded block and the block is narrower than declared");
      assert.equal(r.a, o.a, `flipping ${hex4(addr)} moved the two totals apart`);
    });
  }
  for (const addr of flanking) {
    withFlippedImageByte(addr, () => {
      const o = seamRegs(oracle, base);
      assert.equal(o.a, fromOracle.a, `flipping ${hex4(addr)} DID move the total, so the ` +
        "block reaches past where this gate says it ends");
    });
  }
  console.log(
    `  BLOCK: total ${fromOracle.a} and end pointer ${hex4(endPointer(fromOracle))} agree; ` +
      `${inside.map(hex4).join(" ")} move the total, ${flanking.map(hex4).join(" ")} do not`,
  );
});

function movedOver(candidate) {
  const moved = new Set();
  for (const [, m] of sweep()) {
    const a = m.clone();
    const b = m.clone();
    runSide(oracle, a);
    runSide(candidate, b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const outside = unitDiff(regScribbler(OUTSIDE), entryState());
  const inside = unitDiff(regScribbler(CEILING[0]), entryState());
  assert.notEqual(outside, null, `a planted move of ${OUTSIDE} was not reported, so a clean ` +
    "reading below proves nothing");
  assert.equal(inside, null, `a planted move of ${CEILING[0]} WAS reported, so the arm is not ` +
    "excluding the ceiling and the two-sided control has collapsed into one");
  const moved = movedOver(showCreditLine);
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${CEILING.join(", ")}; the control moves ${OUTSIDE} and is seen`);
  // CEILING is a CEILING. deepEqual against it would DEMAND the divergence and go RED on a rewrite
  // that became register-exact — a gate that requires a wart refuses the fix.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !CEILING.includes(k)), [],
    "a register outside the declared ceiling diverged");
});

test("CALLS, NOT RESTATES: the module's text, with each callee as a positive control", () => {
  const module = read("../showCreditLine.js");
  for (const helper of HELPERS) {
    assert.ok(callsRatherThanRestates(module, helper), `the module does not call ${helper[0]}`);
    assert.ok(!callsRatherThanRestates(read(helper[1]), helper),
      `the check passes ${helper[0]}'s ` +
      "OWN body, so it cannot tell a call from an inlined copy and proves nothing");
  }
  // The seventh transfer has no file to import, so the module must reach it through the registry.
  assert.match(module, /m\.call\(\s*TRAP\s*\)/, "the module does not reach the trap through the " +
    "dispatch registry, which is the only way a transfer into a place holding no routine can be " +
    "reproduced rather than repaired");
  console.log(`  CALLS, NOT RESTATES: ${HELPERS.map((h) => h[0]).join(", ")} called, each of ` +
    "their own bodies fails the same check, and the trap goes through the registry");
});

test("the panel repaint reaches the plane, so its twin has something to catch", { skip }, () => {
  const before = entryState();
  const after = before.clone();
  oracle(after);
  const poked = before.clone();
  poked.mem8[PANEL_CELL] = before.mem8[PANEL_CELL] ^ 0xff;
  const repainted = poked.clone();
  oracle(repainted);
  assert.equal(repainted.mem8[PANEL_CELL], after.mem8[PANEL_CELL], "the panel cell was not " +
    "rewritten from scratch, so the no-repaint twin rests on something else");
  console.log(`  REPAINT REACHES: ${hex4(PANEL_CELL)} is restored from a poked value`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const { caught, first: d } = caughtOver(twin);
    const total = sweep().length;
    assert.ok(caught > 0, `the masked comparison PASSED the ${label} twin everywhere`);
    assert.equal(caught, CATCHES[label], `the ${label} twin's catch count moved`);
    assert.ok(d.addr !== null || d.reg === "raise", `the ${label} twin is caught on a register ` +
      "alone, so nothing says a cell it writes is wrong or that it takes a different exit");
    console.log(`  TEETH/${label}: caught on ${caught} of ${total} — first ${show(d)}`);
  });
}
