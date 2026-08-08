// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3dda — memory-equivalent to the frozen oracle at ROM 0x3DDA.
 *
 * WHAT IT IS. A guard on the era index, then two constant record bases handed to the slot
 * servicer at ROM 0x3DEB — WHICH IS ALREADY DECOMPILED, so the rewrite calls loc_3deb directly
 * and dissolving that transfer belongs to this caller's unit. The guard is `dec a / ret nz` on
 * the era cell, so it passes on exactly one value and the rewrite writes that comparison out.
 *
 * ★★ EVERY REAL DISPATCH THIS GATE HAS EVER SEEN IS MEMORY-DEGENERATE, IN TWO WAYS AT ONCE. The
 *   driven sessions sit in an era the guard rejects, so they never get past the first line. The
 *   undriven session is in the era the guard accepts — at every one of its dispatches — but the
 *   slot it then services is EMPTY every time, so the servicer returns without writing. NOT ONE
 *   REAL DISPATCH IN ANY SESSION WRITES A BYTE, and the whole-run masked diff is consequently
 *   BLIND TO EVERY TWIN HERE, which is asserted per twin rather than glossed. What still bites at
 *   a real dispatch is the pair of bases the entry sets: those are held outside the ceiling, so a
 *   twin that aims elsewhere is caught on a register even when no cell moves. FOR MEMORY EFFECTS
 *   THE CRAFTED CROSS IS THE ENTIRE GATE, and arms 2, 6 and 11 assert that rather than describe
 *   it — each with a control showing the instrument would have seen the thing it did not find.
 *
 * ★ LIVE-OUT, DERIVED FROM THE ORACLE, NOT FROM THE MODULE. One site reaches this entry: the
 *   fixed per-frame call list at ROM 0x1199, which calls it and returns to 0x11C3. That is
 *   `call 0x3E36`, and 0x3E36 begins `ld ix,0xA810 / ld iy,0xAA12` before calling 0x3E63, whose
 *   own first instruction is `ld a,(ix+0)`. So neither index register nor any other register this
 *   entry leaves is read, and nothing tests the flags. THE DECLARED LIVE-OUT IS MEMORY ONLY.
 *   The ceiling below is wide because the servicer's own contract is wide — its gate lets the
 *   accumulator, the flags and both scratch pairs move — and this entry inherits that. It is a
 *   CEILING: a register outside it fails, a rewrite that diverged on fewer still passes. Both
 *   index registers are OUTSIDE it, so the choice of bases is held exactly.
 *
 * ★ THE ORACLE PUSHES ON THE SERVICED PATH AND NOT ON THE REJECTED ONE. The window is MEASURED by
 *   instrumenting the oracle's own pushes over the whole cross, not inferred from the diff.
 *
 * GATE: strict unit-capture with one measured exclusion, every replayed session at every
 *   dispatch, a crafted cross over the era, the slot's head byte and where the object sits, and
 *   a whole-run masked diff. Holes stated:
 *
 *   1. EQUAL at the real dispatch — identical outside the measured window.
 *   2. MEMORY-DEGENERATE AT THE REAL DISPATCH — a no-op is caught there only on a REGISTER, and
 *      the SAME masked diff catches it on a CELL on a crafted serviced entry, so the silence in
 *      memory is the corpus's doing and not the instrument's.
 *   3. WINDOW — the oracle's deepest push over the whole cross, measured.
 *   4. EXCLUDED — the registers that move over the cross, bounded by the ceiling, with an in-arm
 *      control that moves one outside it so the clean reading means something.
 *   5. THE GUARD — every era value swept against a slot that would definitely be serviced; the
 *      set of eras the oracle acts on is asserted to be exactly one value.
 *   6. UNIFORM CORPUS — measured dispatch counts, the eras and head bytes every real dispatch
 *      arrives with, and the assertion that not one of them writes a byte.
 *   7. CORPUS — every dispatch of every session, which proves only that nothing broke.
 *   8. CROSSED — every head byte at each swept era and each of three placements.
 *   9. THREE ARMS REACHED — the cross is shown to drive all three of the servicer's arms, by
 *      classifying what the ORACLE writes at each head byte, so the sweep is not secretly one arm.
 *  10. CALLS, NOT RESTATES — the module's text, with the servicer's own body as a control.
 *  11. WHOLE-MACHINE — a driven session with the rewrite wired, diffed every frame. It catches
 *      NOTHING here, so it carries a control candidate that scribbles one sprite cell and must
 *      be seen; without that its clean verdict would be indistinguishable from an unwired arm.
 *  12. TEETH — a bank of twins, each with an exact catch count over the cross and per session,
 *      and its whole-run verdict recorded rather than assumed. Every one is whole-run BLIND, and
 *      one — the guard that tests a bit rather than the value — is invisible on every real
 *      dispatch too, since the only era real play presents past the guard is one the bit test
 *      also admits. The crafted cross is the only thing holding that twin.
 *
 * HOLE: the crafted records are seeded with a fixed synthetic pattern, not with states the game
 * produced; nothing here says the servicer is ever REACHED with a live slot in real play, only
 * what happens if it is.
 * HOLE: the two neighbouring slots and sprite entries are seeded so a mis-aimed twin diverges;
 * no arm sweeps the whole table of slots.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3dda.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_3dda } from "../loc_3dda.js";
import { loc_3deb } from "../loc_3deb.js";
import { ERA_INDEX } from "../names.js";
import { loc_3dda as oracle } from "../../translated/loc_3dda.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8 } from "../../../../core/int.js";

const TARGET = 0x3dda;

/** The three constants the entry exists to choose. */
const SERVICED_ERA = 1;
const SLOT_RECORD = 0xa8e0;
const SPRITE_ENTRY = 0xaa2c;

const RECORD_STRIDE = 16;
const SPRITE_STRIDE = 2;
/** Where the servicer looks for the other coordinate, and the two lines it retires on. */
const SCREEN_ROW_CELL = 49;
const RETIRE_ROW = 248;
const RETIRE_COLUMN = 4;

/** Measured by the WINDOW arm: the deepest the oracle's own pushes reach below the entry seat. */
const SCRATCH_BYTES = 4;

/**
 * The ceiling on divergence, inherited from the servicer's own contract. Both index registers are
 * deliberately absent: the choice of bases is the content of this entry and is held exactly.
 */
const MOVED = ["a", "f", "d", "e", "h", "l", "sp"];

const CORPUS_FRAMES = 2000;
const WHOLE_FRAMES = 1400;
const RET_TSTATES = 10;

const IN0 = 0xc300;
const IN1 = 0xc320;
const HOLD = 8;
const TURN_HOLD = 60;
const TURN_FIRST_FRAME = 640;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const everyByte = Array.from({ length: 256 }, (_unused, v) => v);

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

/**
 * The module's text against the servicer it is supposed to CALL, identified by a constant out of
 * the servicer's own body. The same predicate runs over the servicer as a positive control, so
 * the absence is evidence only once the check is shown able to see the thing present.
 */
const HELPER = ["loc_3deb", "../loc_3deb.js", "ALL_ONES"];

function callsRatherThanRestates(text, [name, file, ownConstant]) {
  return text.includes(`from "./${file.slice(3)}"`) &&
    text.includes(`${name}(m)`) &&
    !text.includes(ownConstant);
}

function turnTape() {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: 0x01, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: 0x08, dur: HOLD },
    { frame: TURN_FIRST_FRAME - HOLD, port: IN1, bits: 0x10, dur: CORPUS_FRAMES },
  ];
  const compass = [0x01, 0x05, 0x04, 0x06, 0x02, 0x0a, 0x08, 0x09, 0x01, 0x04, 0x02, 0x08];
  let frame = TURN_FIRST_FRAME;
  for (const bits of compass) {
    tape.push({ frame, port: IN1, bits, dur: TURN_HOLD });
    frame += TURN_HOLD;
  }
  return tape;
}

const sharedMachine = (overrides) => makeMachine(overrides);
const attractMachine = (overrides) => makeMachine(overrides, { tape: [] });
const turningMachine = (overrides) => makeMachine(overrides, { tape: turnTape() });

const SESSIONS = [
  ["shared", sharedMachine],
  ["attract", attractMachine],
  ["turning", turningMachine],
];

/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 598, attract: 879, turning: 823 };

// ── the entry, and the masked comparison ────────────────────────────────────────────────

let entry = null;

/** The undriven session is the only one whose dispatches even reach the guard's accepting value. */
function gate(candidate) {
  return unitEquivalence(
    attractMachine,
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
  if (entry === null) gate(loc_3dda);
  return entry;
}

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

/** Oracle vs candidate on clones: masked RAM, then every register outside the ceiling. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: `raised ${String(e).slice(0, 40)}` };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: a.regs[k], b: b.regs[k] };
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

/** What the oracle writes outside the window, as a signature that can be compared and classified. */
function oracleWrites(machine) {
  const after = machine.clone();
  oracle(after);
  return allDiffs(machine, after)
    .filter((d) => !inScratch(d.addr, machine.regs.sp))
    .map((d) => `${hex4(d.addr)}=${d.b}`);
}

// ── the crafted cross ───────────────────────────────────────────────────────────────────

/**
 * The two neighbouring slot records and sprite entries are given values of their own, so a twin
 * aimed one record or one entry along parts company instead of quietly agreeing.
 */
function seed(m) {
  for (let a = SLOT_RECORD - RECORD_STRIDE; a < SLOT_RECORD + 2 * RECORD_STRIDE; a++) {
    m.mem8[a] = u8(a * 37 + 11);
  }
  for (let a = SPRITE_ENTRY - SPRITE_STRIDE; a < SPRITE_ENTRY + 2 * SPRITE_STRIDE; a++) {
    m.mem8[a] = u8(a * 53 + 7);
  }
  const row = SPRITE_ENTRY + SCREEN_ROW_CELL;
  for (let a = row - SPRITE_STRIDE; a < row + 2 * SPRITE_STRIDE; a++) m.mem8[a] = u8(a * 91 + 23);
}

const PLACEMENTS = [
  ["adrift", () => {}],
  ["on the row line", (m) => { m.mem8[SPRITE_ENTRY + SCREEN_ROW_CELL] = RETIRE_ROW; }],
  ["on the column line", (m) => { m.mem8[SPRITE_ENTRY] = RETIRE_COLUMN; }],
];

function craft(era, head, place) {
  const m = entryState().clone();
  seed(m);
  m.mem8[ERA_INDEX] = era;
  m.mem8[SLOT_RECORD] = head;
  place(m);
  return m;
}

/** Eras either side of the accepting one, plus the wrap. */
const ERAS = [0, SERVICED_ERA, 2, 255];

let crossCache = null;
function cross() {
  if (crossCache) return crossCache;
  const out = [];
  for (const era of ERAS) {
    for (const head of everyByte) out.push([era, head, PLACEMENTS[0]]);
  }
  for (const placement of PLACEMENTS.slice(1)) {
    for (const head of everyByte) out.push([SERVICED_ERA, head, placement]);
  }
  crossCache = out;
  return out;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(factory, candidate) {
  let dispatches = 0;
  let caught = 0;
  let wrote = 0;
  const eras = new Set();
  const heads = new Set();
  const m = factory(
    new Map([[TARGET, (mm) => {
      dispatches++;
      eras.add(mm.mem8[ERA_INDEX]);
      if (mm.mem8[ERA_INDEX] === SERVICED_ERA) heads.add(mm.mem8[SLOT_RECORD]);
      if (oracleWrites(mm).length > 0) wrote++;
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, wrote, eras, heads };
}

let sessionCache = null;
function sessions() {
  if (sessionCache) return sessionCache;
  sessionCache = SESSIONS.map(([label, factory]) => ({ label, ...replaySession(factory, loc_3dda) }));
  return sessionCache;
}

// ── the cycle shim ──────────────────────────────────────────────────────────────────────

function hosted(candidate) {
  return (mm) => {
    const probe = mm.clone();
    const before = probe.cycles;
    oracle(probe);
    const total = probe.cycles - before;
    candidate(mm);
    mm.tick(total - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

let baselineRun = null;
function baseline() {
  if (!baselineRun) {
    const base = sharedMachine();
    const frames = base.runFrames(WHOLE_FRAMES);
    baselineRun = { frames, offsetToAddr: (o) => base.stateOffsetToAddr(o) };
  }
  return baselineRun;
}

/**
 * Every cell that EVER differs between an all-oracle run and one with the candidate wired. A
 * first-difference helper cannot express "differs only inside the scratch window", so this walks
 * the whole dump every frame and hands back the set.
 */
function wholeRunCells(candidate) {
  const base = baseline();
  let fired = 0;
  const host = sharedMachine(new Map([[TARGET, (mm) => (fired++, hosted(candidate)(mm))]]));
  let hostFrames = [];
  let threw = null;
  try {
    hostFrames = host.runFrames(WHOLE_FRAMES);
  } catch (e) {
    threw = String(e).slice(0, 70);
  }
  const cells = new Set();
  const n = Math.min(base.frames.length, hostFrames.length);
  for (let i = 0; i < n; i++) {
    const x = base.frames[i];
    const y = hostFrames[i];
    for (let o = 0; o < x.length; o++) if (x[o] !== y[o]) cells.add(base.offsetToAddr(o));
  }
  return { cells: [...cells].sort((a, b) => a - b), frames: n, fired, threw };
}

const STACK_FLOOR = 0xafc0;
const STACK_TOP = 0xb000;

/**
 * Measured over a whole run with the CORRECT rewrite wired: the driven session is byte-identical,
 * every frame. It is also identical for EVERY twin below, because the slot this entry services is
 * empty in that session and a mis-aimed base moves only index registers, which no RAM dump holds.
 */
const WHOLE_RUN_CELLS = [];

const sameCells = (cells) =>
  cells.length === WHOLE_RUN_CELLS.length && cells.every((c, i) => c === WHOLE_RUN_CELLS[i]);

// ── the twins ───────────────────────────────────────────────────────────────────────────

function brokenNoOp() {}

/** BUG: the guard is inverted, so every era but the right one is serviced. */
function brokenGuardInverted(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] === SERVICED_ERA) return;
  regs.ix = SLOT_RECORD;
  regs.iy = SPRITE_ENTRY;
  loc_3deb(m);
}

/** BUG: there is no guard, so the slot is serviced in every era. */
function brokenNoGuard(m) {
  const { regs } = m;
  regs.ix = SLOT_RECORD;
  regs.iy = SPRITE_ENTRY;
  loc_3deb(m);
}

/** BUG: the guard admits the next era along. */
function brokenGuardOffByOne(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== SERVICED_ERA + 1) return;
  regs.ix = SLOT_RECORD;
  regs.iy = SPRITE_ENTRY;
  loc_3deb(m);
}

/** BUG: the guard tests a bit instead of the value, so every odd era passes. */
function brokenGuardTestsLowBit(m) {
  const { regs, mem8 } = m;
  if ((mem8[ERA_INDEX] & 1) === 0) return;
  regs.ix = SLOT_RECORD;
  regs.iy = SPRITE_ENTRY;
  loc_3deb(m);
}

/** BUG: the slot one record along is serviced. */
function brokenNextRecord(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== SERVICED_ERA) return;
  regs.ix = SLOT_RECORD + RECORD_STRIDE;
  regs.iy = SPRITE_ENTRY;
  loc_3deb(m);
}

/** BUG: the slot one record back is serviced. */
function brokenPreviousRecord(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== SERVICED_ERA) return;
  regs.ix = SLOT_RECORD - RECORD_STRIDE;
  regs.iy = SPRITE_ENTRY;
  loc_3deb(m);
}

/** BUG: the record is right but the sprite entry beside it is not. */
function brokenNextSpriteEntry(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== SERVICED_ERA) return;
  regs.ix = SLOT_RECORD;
  regs.iy = SPRITE_ENTRY + SPRITE_STRIDE;
  loc_3deb(m);
}

/** BUG: the two bases change places. */
function brokenBasesSwapped(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== SERVICED_ERA) return;
  regs.ix = SPRITE_ENTRY;
  regs.iy = SLOT_RECORD;
  loc_3deb(m);
}

/** BUG: the bases the caller was holding are used instead of the entry's own. */
function brokenKeepsCallerBases(m) {
  if (m.mem8[ERA_INDEX] !== SERVICED_ERA) return;
  loc_3deb(m);
}

/** BUG: only the record base is set, so the sprite entry is whatever arrived. */
function brokenOnlyRecordBase(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== SERVICED_ERA) return;
  regs.ix = SLOT_RECORD;
  loc_3deb(m);
}

const TWINS = [
  ["no-op", brokenNoOp, 768, [0, 847, 0], false],
  ["guard-inverted", brokenGuardInverted, 1536, [598, 847, 823], false],
  ["no-guard", brokenNoGuard, 768, [598, 0, 823], false],
  ["guard-off-by-one", brokenGuardOffByOne, 1024, [0, 847, 0], false],
  ["guard-tests-low-bit", brokenGuardTestsLowBit, 256, [0, 0, 0], false],
  ["next-record", brokenNextRecord, 768, [0, 879, 0], false],
  ["previous-record", brokenPreviousRecord, 768, [0, 879, 0], false],
  ["next-sprite-entry", brokenNextSpriteEntry, 768, [0, 879, 0], false],
  ["bases-swapped", brokenBasesSwapped, 768, [0, 879, 0], false],
  ["keeps-caller-bases", brokenKeepsCallerBases, 768, [0, 847, 0], false],
  ["only-record-base", brokenOnlyRecordBase, 768, [0, 847, 0], false],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the measured window", { skip }, () => {
  gate(loc_3dda);
  assert.notEqual(entry, null, "vacuous: the session never reached the routine");
  const e = entryState();
  const sp = e.regs.sp;
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  loc_3dda(b);
  const all = allDiffs(a, b);
  const strays = all.filter((d) => !inScratch(d.addr, sp));
  console.log(
    `  EQUAL: era ${e.mem8[ERA_INDEX]}, slot head ${e.mem8[SLOT_RECORD]}, arriving bases ` +
      `${hex4(e.regs.ix)}/${hex4(e.regs.iy)}, sp ${hex4(sp)}; ${all.length} differing bytes, ` +
      `${strays.length} outside the window`,
  );
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.equal(a.regs.ix, b.regs.ix, "the record base left behind differs");
  assert.equal(a.regs.iy, b.regs.iy, "the sprite entry left behind differs");
});

test("MEMORY-DEGENERATE AT THE REAL DISPATCH: the no-op is caught there ON A REGISTER, and on " +
  "a crafted serviced entry ON A CELL", { skip }, () => {
  const atReal = unitDiff(brokenNoOp, entryState());
  const serviced = craft(SERVICED_ERA, 255, PLACEMENTS[1][1]);
  const atCrafted = unitDiff(brokenNoOp, serviced);
  console.log(
    `  MEMORY-DEGENERATE: at the real entry the no-op is caught on ` +
      `${atReal && atReal.addr === null ? "a register" : `a cell — ${show(atReal)}`}; on a ` +
      `crafted serviced entry it is caught on ${atCrafted && atCrafted.addr !== null
        ? `a cell — ${show(atCrafted)}` : "a register only"}`,
  );
  assert.notEqual(atCrafted, null, "the masked diff passes a no-op even on a crafted entry the " +
    "oracle demonstrably writes on, so this gate's instrument is broken rather than its corpus");
  assert.notEqual(atCrafted.addr, null, "on a serviced entry the no-op is caught only on a " +
    "register, so the crafted arms are not reaching the servicer's memory effects at all");
  assert.notEqual(atReal, null, "the no-op now passes at the real entry outright, so even the " +
    "bases this entry sets stopped discriminating and the corpus proves nothing whatever");
  assert.equal(atReal.addr, null, "the real entry now distinguishes a no-op ON A CELL, so it " +
    "stopped being memory-degenerate and every verdict below has to be re-derived");
  assert.equal(oracleWrites(entryState()).length, 0, "the oracle writes at the real entry after " +
    "all, which contradicts the degeneracy this file is built around");
});

test("WINDOW: the oracle's own deepest push, measured over the whole cross", { skip }, () => {
  let deepest = 0;
  for (const [era, head, [, place]] of cross()) {
    deepest = Math.max(deepest, oracleDepth(craft(era, head, place)));
  }
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is no longer the measured one and every arm below is masking the wrong bytes");
});

/** Which registers a candidate parts company with the oracle on, over the whole cross. */
function movedOver(candidate) {
  const moved = new Set();
  for (const [era, head, [, place]] of cross()) {
    const a = craft(era, head, place);
    const b = a.clone();
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
  const moved = movedOver(loc_3dda);
  // The absence is evidence only if the measurement CAN report a register outside the ceiling;
  // the bases are outside it, and the twin that swaps them moves both.
  const control = movedOver(brokenBasesSwapped);
  assert.ok(control.has("ix") && control.has("iy"), "the measurement misses a candidate that " +
    "plainly moves both bases, so a clean reading below proves nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}; the control also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  // MOVED is a CEILING. deepEqual against it would DEMAND the divergence and go RED on a rewrite
  // that became register-exact — a gate that requires a wart refuses the fix.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
});

test("THE GUARD: exactly one era value gets past it", { skip }, () => {
  const acting = everyByte.filter(
    (era) => oracleWrites(craft(era, 255, PLACEMENTS[1][1])).length > 0,
  );
  console.log(`  THE GUARD (measured): the oracle acts on eras [${acting.join(",")}]`);
  assert.deepEqual(acting, [SERVICED_ERA], "the set of era values the oracle acts on moved");
  for (const era of everyByte) {
    const d = unitDiff(loc_3dda, craft(era, 255, PLACEMENTS[1][1]));
    assert.equal(d, null, `era ${era}: ${show(d)}`);
  }
});

test("UNIFORM CORPUS: not one real dispatch writes a byte", { skip }, () => {
  const seen = sessions();
  console.log(
    `  UNIFORM CORPUS (measured): ${seen.map((s) =>
      `${s.label} ${s.dispatches} dispatches / eras [${[...s.eras].join(",")}] / heads at the ` +
      `serviced era [${[...s.heads].join(",")}] / ${s.wrote} that write`).join("; ")}`,
  );
  for (const s of seen) assert.equal(s.dispatches, DISPATCHES[s.label], `${s.label} count moved`);
  const wrote = seen.reduce((n, s) => n + s.wrote, 0);
  assert.equal(wrote, 0, "a real dispatch now writes, so the corpus stopped being degenerate and " +
    "every twin's real-dispatch verdict below has to be re-derived");
});

test("CORPUS: every dispatch of every session replays identically", { skip }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    total += s.dispatches;
  }
  assert.ok(total > 0, "vacuous: no session reaches the routine at all");
  console.log(`  CORPUS: ${total} real dispatches, identical outside the window`);
});

test("CROSSED: every head byte at each swept era and each placement", { skip }, () => {
  for (const [era, head, [label, place]] of cross()) {
    const d = unitDiff(loc_3dda, craft(era, head, place));
    assert.equal(d, null, `era ${era} head ${head} ${label}: ${show(d)}`);
  }
  console.log(`  CROSSED: ${cross().length} era x head x placement comparisons identical`);
});

test("THREE ARMS REACHED: the cross drives all three of the servicer's arms", { skip }, () => {
  const at = (head, place) => oracleWrites(craft(SERVICED_ERA, head, place)).join(" ");
  const empty = at(0, PLACEMENTS[0][1]);
  const other = at(7, PLACEMENTS[0][1]);
  const flownAdrift = at(255, PLACEMENTS[0][1]);
  const flownOnLine = at(255, PLACEMENTS[1][1]);
  console.log(
    `  THREE ARMS: empty slot writes [${empty}]; another value writes [${other}]; all-ones ` +
      `adrift writes [${flownAdrift}]; all-ones on the row line writes [${flownOnLine}]`,
  );
  assert.equal(empty, "", "an empty slot now writes, so the do-nothing arm is not what is reached");
  assert.notEqual(other, "", "the retire-on-the-spot arm writes nothing, so the cross is not " +
    "reaching it and the mis-aimed twins are being caught by something else");
  assert.notEqual(flownAdrift, "", "the fly arm writes nothing");
  assert.notEqual(flownAdrift, flownOnLine, "flying and flying-then-retiring leave the same " +
    "trace, so no arm here distinguishes the retire test");
  assert.notEqual(other, flownOnLine, "retiring on the spot and flying then retiring leave the " +
    "same trace, so the cross cannot tell the two arms apart");
});

test("CALLS, NOT RESTATES: the module's text, with the servicer as a positive control", () => {
  const module = read("../loc_3dda.js");
  assert.ok(callsRatherThanRestates(module, HELPER), `the module does not call ${HELPER[0]}`);
  assert.ok(!callsRatherThanRestates(read(HELPER[1]), HELPER), `the check passes ${HELPER[0]}'s ` +
    "OWN body, so it cannot tell a call from an inlined copy and proves nothing");
  console.log(`  CALLS, NOT RESTATES: ${HELPER[0]} is called, and its own body fails the same check`);
});

test("WHOLE-MACHINE: a driven session differs only in stack scratch", { skip }, () => {
  const r = wholeRunCells(loc_3dda);
  console.log(
    `  WHOLE-MACHINE: ${r.frames} frames, ${r.fired} dispatches, differing cells ` +
      `[${r.cells.map(hex4).join(" ")}]`,
  );
  assert.equal(r.threw, null, `the run threw: ${r.threw}`);
  assert.equal(r.frames, WHOLE_FRAMES, `compared ${r.frames} of ${WHOLE_FRAMES} frames`);
  assert.ok(r.fired > 0, "vacuous: the override never dispatched");
  for (const cell of r.cells) {
    assert.ok(cell >= STACK_FLOOR && cell < STACK_TOP, `${hex4(cell)} is not a stack address, so a ` +
      "real game cell diverged over the run");
  }
  assert.deepEqual(r.cells, WHOLE_RUN_CELLS, "the set of dead stack bytes a whole run leaves " +
    "differing moved, so the exclusion is no longer measured");
  // Every twin below is recorded BLIND to this arm, so the clean result above would look the same
  // if the instrument were not wired at all. The control makes the blindness attributable to the
  // game state rather than to the measurement: a candidate that touches one sprite cell IS seen.
  const control = wholeRunCells((mm) => {
    loc_3dda(mm);
    mm.mem8[SPRITE_ENTRY] = u8(mm.mem8[SPRITE_ENTRY] + 1);
  });
  assert.ok(control.threw !== null || !sameCells(control.cells), "a candidate that writes a " +
    "sprite cell on every dispatch also leaves the run identical, so this arm cannot see anything " +
    "and its clean verdict above is worthless");
  console.log(`  WHOLE-MACHINE control: a one-cell scribble IS seen, at ` +
    `[${control.cells.map(hex4).join(" ")}]`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, crossCaught, perSession, wholeRunSees] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    const caught = cross().filter(([e, h, [, p]]) => unitDiff(twin, craft(e, h, p)) !== null).length;
    console.log(`  TEETH/${label}: caught on ${caught} of ${cross().length} crafted entries`);
    assert.equal(caught, crossCaught, `the ${label} twin's crafted catch count moved`);
    assert.ok(caught > 0, `the crafted cross missed the ${label} twin everywhere`);
  });

  test(`TEETH: the ${label} twin is caught on an exact count of real dispatches`, { skip }, () => {
    const counts = SESSIONS.map(([, factory]) => replaySession(factory, twin));
    console.log(`  TEETH/${label}: real sessions catch ${counts.map((r) => r.caught).join("/")}`);
    for (const [i, r] of counts.entries()) {
      assert.equal(r.caught, perSession[i], `the ${label} twin's ${SESSIONS[i][0]} count moved`);
    }
  });

  test(`TEETH: the whole-run masked diff sees the ${label} twin, or is recorded blind`, { skip }, () => {
    const r = wholeRunCells(twin);
    const seen = r.threw !== null || !sameCells(r.cells);
    console.log(`  TEETH/${label}: whole run ${seen ? "catches it" : "is BLIND, as recorded"}`);
    assert.ok(r.fired > 0, "vacuous: the twin never dispatched");
    assert.equal(seen, wholeRunSees, `the whole-run verdict on the ${label} twin changed`);
  });
}
