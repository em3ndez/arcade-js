// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for dispatchElevatorRideByColumn (ROM 0x2745) — the vertical-reposition machine that
 * gates on the reposition flag + airborne state, then dispatches by Mario's X into the
 * mover arms (carryMarioUpWithLift / carryMarioDownWithLift) or the edge reset (loc_2766).
 *
 * The routine's whole memory-observable behaviour is decided by four bytes:
 *   EDGE_REPOSITION_FLAG (0x6398) — clear -> return, nothing repositioned.
 *   MARIO_AIRBORNE       (0x6216) — set   -> return, busy in the air.
 *   MARIO_X              (0x6203) — five bands: reset [<44], carryMarioUpWithLift [44,67),
 *                                   reset [67,108), carryMarioDownWithLift [108,131), reset [>=131].
 *   MARIO_Y              (0x6205) — read only inside the mover arms; decides each
 *                                   mover's step-vs-handoff sub-arm.
 * It writes NONE of its own cells — every effect is the dispatched arm's.
 *
 * The oracle nets exactly ONE caller-return pop on EVERY path — the two guard `ret`s,
 * and, on the dispatch paths, a tail-jump into a callee whose own single `ret` returns
 * on dispatchElevatorRideByColumn's behalf (each callee only POPS, never pushes). The idiomatic routine
 * models no stack (direct arm calls + a plain JS return), so runPair performs ONE
 * m.ret() after the candidate to line pc + SP up. Because neither side WRITES the
 * stack, the RAM diff is the whole dump with NO STACK_SCRATCH exclusion — it would
 * catch a stray stack write if one existed.
 *
 * 0x2745 is NEVER dispatched in attract (verified 0 over 6000 frames — the reposition
 * flag it gates on is only raised by a gameplay mover the 25m demo never drives), so
 * crafted entries on a REAL booted attract base carry the gate.
 *
 *   0. REACHABILITY — confirm 0x2745 stays unreached in attract, so crafted coverage
 *      carries the gate (if it ever fires, add captured coverage).
 *   1. EQUAL (crafted, exhaustive dispatch) — dispatchElevatorRideByColumn == oracle over RAM (whole dump)
 *      + pc + SP across ALL 256 MARIO_X values (every band boundary) crossed with a
 *      MARIO_Y set that drives both sub-arms of each mover, active path (flag set,
 *      grounded). PLUS the two guard early-outs (flag clear; airborne set) — each must
 *      match AND write nothing.
 *   2. NON-VACUITY — each band writes its arm's exact cells (reset -> {EDGE, START_FALL},
 *      mover step -> {MARIO_Y, sprite-Y}, mover handoff -> {MARIO_ACTIVE, EDGE}), so the
 *      sweep compares real overwrites, not no-ops.
 *   3. TEETH — three deliberately-broken twins the same sweep MUST catch:
 *        (a) wrong band boundary (44 -> 45) — steals X==44 from carryMarioUpWithLift; caught at X==44.
 *        (b) inverted reposition-flag guard — skips all work while active; caught.
 *        (c) inverted airborne guard — skips all work while grounded; caught.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2745.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2745 as oracle } from "../../translated/loc_2745.js";
import { dispatchElevatorRideByColumn } from "../dispatchElevatorRideByColumn.js";
import { loc_2766 } from "../loc_2766.js"; // idiomatic arms, used by the broken twins
import { carryMarioUpWithLift } from "../carryMarioUpWithLift.js";
import { carryMarioDownWithLift } from "../carryMarioDownWithLift.js";
import {
  EDGE_REPOSITION_FLAG,
  MARIO_AIRBORNE,
  MARIO_X,
  MARIO_Y,
  MARIO_ACTIVE,
  MARIO_START_FALL,
  MARIO_SPRITE_RECORD,
  SPRITE_Y,
} from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2745;
const SPRITE_Y_CELL = MARIO_SPRITE_RECORD + SPRITE_Y; // 0x694F — Mario's sprite-record Y

// The caller sub_271e does `push16(0x2721); call 0x2745`, so the return address on the
// stack when 0x2745 runs is 0x2721.
const RET_ADDR = 0x2721;

// MARIO_Y priors that drive BOTH sub-arms of each mover: carryMarioUpWithLift steps for Y >= 0x71
// (else hands off to killMarioAtEndOfLiftTravel); carryMarioDownWithLift steps for Y < 0xE8 (else hands off). This set
// hits each mover's step AND handoff arm.
const Y_SET = [0x00, 0x70, 0x71, 0x80, 0xe7, 0xe8, 0xff];

// Observable priors so every arm's writes are REAL overwrites (never no-ops), plus
// neighbour noise to catch an off-by-one write target.
const ACTIVE_PRIOR = 0xa5;       // MARIO_ACTIVE prior; the handoff reset clears it to 0
const START_FALL_PRIOR = 0x00;   // MARIO_START_FALL prior; the reset arm sets it to 1
const MIRROR_PRIOR = 0x00;       // sprite-Y prior; a mover step writes >= 0x70 here, never 0
const NOISE = new Map([
  [MARIO_Y - 1, 0x11], [MARIO_Y + 1, 0x22],           // 0x6204 / 0x6206
  [SPRITE_Y_CELL - 1, 0x33], [SPRITE_Y_CELL + 1, 0x44], // 0x694E / 0x6950
]);

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A real, self-consistent machine: boot + a stretch of attract so work RAM holds
// realistic values. 0x2745 is never dispatched here; every entry is crafted by poking.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

/**
 * A crafted 0x2745 entry: a clone of `base` with the two guard inputs, MARIO_X, MARIO_Y,
 * the arms' target cells seeded to observable priors, neighbour noise, and a stack
 * carrying a plausible caller return so the terminal pop is well-defined.
 */
function makeEntry(base, x, y, { flag = 0x01, airborne = 0x00 } = {}) {
  const e = base.clone();
  e.mem.write8(EDGE_REPOSITION_FLAG, flag);
  e.mem.write8(MARIO_AIRBORNE, airborne);
  e.mem.write8(MARIO_X, x);
  e.mem.write8(MARIO_Y, y);
  e.mem.write8(MARIO_ACTIVE, ACTIVE_PRIOR);
  e.mem.write8(MARIO_START_FALL, START_FALL_PRIOR);
  e.mem.write8(SPRITE_Y_CELL, MIRROR_PRIOR);
  for (const [addr, val] of NOISE) e.mem.write8(addr, val);
  e.regs.sp = 0x6c00;
  e.push16(RET_ADDR);
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/** The full memory-equivalence contract: RAM (whole dump) + pc + SP. Live-out is
 *  memory-only; pc/SP are asserted only to prove the dissolved tail-jump/ret bracket
 *  lines up. Returns { kind, addr?, msg } | null. */
function contractDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return { kind: "RAM", addr: ram.addr, msg: `RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}` };
  if (a.pc !== b.pc) return { kind: "pc", msg: `pc oracle=${hx(a.pc)} cand=${hx(b.pc)}` };
  if (a.regs.sp !== b.regs.sp) return { kind: "SP", msg: `SP oracle=${hx(a.regs.sp)} cand=${hx(b.regs.sp)}` };
  return null;
}

/**
 * Run the oracle and a candidate on two FRESH, byte-identical crafted entries and diff
 * the contract. The oracle performs its own terminal `ret`; the candidate models no
 * stack, so one m.ret() after it lines pc + SP up. Returns the diff (or null).
 */
function runPair(base, x, y, opts, candidate) {
  const a = makeEntry(base, x, y, opts); // oracle
  const b = makeEntry(base, x, y, opts); // candidate
  oracle(a);
  candidate(b);
  b.ret(); // model the candidate's terminal return (the oracle's guard ret / callee ret)
  return contractDiff(a, b);
}

/** Sweep all 256 MARIO_X values crossed with Y_SET, active path. First mismatch + count. */
function fullSweep(base, candidate) {
  let count = 0;
  for (let x = 0; x < 256; x++) {
    for (const y of Y_SET) {
      const diff = runPair(base, x, y, {}, candidate);
      count++;
      if (diff) return { mismatch: { x, y, diff }, count };
    }
  }
  return { mismatch: null, count };
}

// Every non-stack RAM address that changed between two machines (there is no stack write
// here, so this is the whole-dump change set).
function changedAddrs(pre, post) {
  const da = pre.dumpState(), db = post.dumpState();
  const out = [];
  for (let i = 0; i < Math.min(da.length, db.length); i++) {
    if (da[i] !== db[i]) out.push(pre.stateOffsetToAddr(i));
  }
  return out.sort((p, q) => p - q);
}
const sortAddrs = (a) => a.slice().sort((p, q) => p - q);

const describeMismatch = (mm) => mm && `at MARIO_X=${hx(mm.x)} MARIO_Y=${hx(mm.y)}: ${mm.diff.msg}`;

// -- 0. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x2745 is NOT dispatched in attract — the gate rests on crafted entries", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(6000);
  assert.equal(count, 0, "expected 0x2745 to stay unreached in attract; if it now fires, add captured coverage");
  console.log(`  REACHABILITY: ${count} natural 0x2745 dispatches in 6000 frames — crafted coverage carries the gate`);
});

// -- 1. EQUAL (crafted) -------------------------------------------------------

test("EQUAL (crafted): dispatchElevatorRideByColumn == oracle across all 256 MARIO_X x Y_SET (active), RAM + pc + SP", () => {
  const base = attractBase();
  const { mismatch, count } = fullSweep(base, dispatchElevatorRideByColumn);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 * Y_SET.length, "must have swept the full MARIO_X x Y_SET grid");
  console.log(`  EQUAL/dispatch: ${count} (MARIO_X, MARIO_Y) combos — RAM + pc + SP identical to the oracle`);
});

test("EQUAL (crafted): both guard early-outs match the oracle AND write nothing", () => {
  const base = attractBase();

  // Flag clear -> the first guard returns; nothing is repositioned.
  for (const y of Y_SET) {
    for (const x of [0x00, 0x30, 0x50, 0x70, 0x90]) {
      const diff = runPair(base, x, y, { flag: 0x00 }, dispatchElevatorRideByColumn);
      assert.equal(diff, null, `flag-clear guard diverged at MARIO_X=${hx(x)} MARIO_Y=${hx(y)}: ${diff && diff.msg}`);
    }
  }
  // Airborne set -> the second guard returns; the reposition waits for a grounded frame.
  for (const y of Y_SET) {
    for (const x of [0x00, 0x30, 0x50, 0x70, 0x90]) {
      const diff = runPair(base, x, y, { flag: 0x01, airborne: 0x01 }, dispatchElevatorRideByColumn);
      assert.equal(diff, null, `airborne guard diverged at MARIO_X=${hx(x)} MARIO_Y=${hx(y)}: ${diff && diff.msg}`);
    }
  }

  // And the guard paths write NOTHING (non-vacuous "no-op" — a real early return).
  const flagClear = makeEntry(base, 0x30, 0x80, { flag: 0x00 });
  const flagClearPost = flagClear.clone(); oracle(flagClearPost);
  assert.deepEqual(changedAddrs(flagClear, flagClearPost), [], "flag-clear guard wrote RAM — should be a pure early return");

  const airborne = makeEntry(base, 0x30, 0x80, { flag: 0x01, airborne: 0x01 });
  const airbornePost = airborne.clone(); oracle(airbornePost);
  assert.deepEqual(changedAddrs(airborne, airbornePost), [], "airborne guard wrote RAM — should be a pure early return");

  console.log("  EQUAL/guards: flag-clear and airborne early-outs identical to the oracle and write nothing");
});

// -- 2. NON-VACUITY -----------------------------------------------------------

test("NON-VACUITY: each band writes exactly its arm's cells (reset / mover-step / mover-handoff)", () => {
  const base = attractBase();

  // RESET band (X=0x10, below the first mover band): loc_2766 sets START_FALL and clears EDGE.
  const reset = makeEntry(base, 0x10, 0x80);
  const resetPost = reset.clone(); oracle(resetPost);
  assert.equal(resetPost.mem.read8(MARIO_START_FALL), 1, "reset arm must set MARIO_START_FALL");
  assert.equal(resetPost.mem.read8(EDGE_REPOSITION_FLAG), 0, "reset arm must clear EDGE_REPOSITION_FLAG");
  assert.deepEqual(changedAddrs(reset, resetPost), sortAddrs([EDGE_REPOSITION_FLAG, MARIO_START_FALL]),
    "reset band write set must be exactly {EDGE_REPOSITION_FLAG, MARIO_START_FALL}");

  // MOVER-STEP band (X=0x30 -> carryMarioUpWithLift, Y=0x80 step): decrement MARIO_Y and mirror it.
  const step = makeEntry(base, 0x30, 0x80);
  const stepPost = step.clone(); oracle(stepPost);
  assert.equal(stepPost.mem.read8(MARIO_Y), 0x7f, "mover step must decrement MARIO_Y");
  assert.equal(stepPost.mem.read8(SPRITE_Y_CELL), 0x7f, "mover step must mirror MARIO_Y to the sprite record");
  assert.deepEqual(changedAddrs(step, stepPost), sortAddrs([MARIO_Y, SPRITE_Y_CELL]),
    "mover-step write set must be exactly {MARIO_Y, sprite-Y}");
  for (const [addr, val] of NOISE) assert.equal(stepPost.mem.read8(addr), val, `step: neighbour ${hx(addr)} disturbed`);

  // MOVER-HANDOFF band (X=0x30 -> carryMarioUpWithLift, Y=0x00 handoff to killMarioAtEndOfLiftTravel): clear ACTIVE + EDGE.
  const handoff = makeEntry(base, 0x30, 0x00);
  const handoffPost = handoff.clone(); oracle(handoffPost);
  assert.equal(handoffPost.mem.read8(MARIO_ACTIVE), 0, "mover handoff must clear MARIO_ACTIVE");
  assert.equal(handoffPost.mem.read8(EDGE_REPOSITION_FLAG), 0, "mover handoff must clear EDGE_REPOSITION_FLAG");
  assert.deepEqual(changedAddrs(handoff, handoffPost), sortAddrs([MARIO_ACTIVE, EDGE_REPOSITION_FLAG]),
    "mover-handoff write set must be exactly {MARIO_ACTIVE, EDGE_REPOSITION_FLAG}");

  // The up-mover band routes to carryMarioDownWithLift (X=0x70, Y=0x80 step): increment MARIO_Y and mirror.
  const upStep = makeEntry(base, 0x70, 0x80);
  const upStepPost = upStep.clone(); oracle(upStepPost);
  assert.equal(upStepPost.mem.read8(MARIO_Y), 0x81, "up-mover step must increment MARIO_Y");
  assert.deepEqual(changedAddrs(upStep, upStepPost), sortAddrs([MARIO_Y, SPRITE_Y_CELL]),
    "up-mover-step write set must be exactly {MARIO_Y, sprite-Y}");

  console.log("  NON-VACUITY: reset -> {EDGE, START_FALL}; mover-step -> {MARIO_Y, sprite-Y}; handoff -> {MARIO_ACTIVE, EDGE}");
});

// -- 3. TEETH -----------------------------------------------------------------

/** BUG (a): the first mover band starts at 45 not 44, stealing X==44 from carryMarioUpWithLift. */
function brokenWrongBand(m) {
  const { mem } = m;
  if (mem.read8(EDGE_REPOSITION_FLAG) === 0) return;
  if (mem.read8(MARIO_AIRBORNE) !== 0) return;
  const x = mem.read8(MARIO_X);
  if (x < 45) { loc_2766(m); return; } // BUG: should be 44
  if (x < 67) { carryMarioUpWithLift(m); return; }
  if (x < 108) { loc_2766(m); return; }
  if (x < 131) { carryMarioDownWithLift(m); return; }
  loc_2766(m);
}

/** BUG (b): inverts the reposition-flag guard — returns while active, works while clear. */
function brokenInvertedFlagGuard(m) {
  const { mem } = m;
  if (mem.read8(EDGE_REPOSITION_FLAG) !== 0) return; // BUG: should be `=== 0`
  if (mem.read8(MARIO_AIRBORNE) !== 0) return;
  const x = mem.read8(MARIO_X);
  if (x < 44) { loc_2766(m); return; }
  if (x < 67) { carryMarioUpWithLift(m); return; }
  if (x < 108) { loc_2766(m); return; }
  if (x < 131) { carryMarioDownWithLift(m); return; }
  loc_2766(m);
}

/** BUG (c): inverts the airborne guard — returns while grounded, works while airborne. */
function brokenInvertedAirborneGuard(m) {
  const { mem } = m;
  if (mem.read8(EDGE_REPOSITION_FLAG) === 0) return;
  if (mem.read8(MARIO_AIRBORNE) === 0) return; // BUG: should be `!== 0`
  const x = mem.read8(MARIO_X);
  if (x < 44) { loc_2766(m); return; }
  if (x < 67) { carryMarioUpWithLift(m); return; }
  if (x < 108) { loc_2766(m); return; }
  if (x < 131) { carryMarioDownWithLift(m); return; }
  loc_2766(m);
}

test("TEETH: the wrong-band twin is CAUGHT at MARIO_X == 44", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenWrongBand);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong band boundary — the gate is worthless");
  assert.equal(mismatch.x, 44, "the wrong-band twin must first diverge at MARIO_X == 44 (stolen from carryMarioUpWithLift)");
  console.log(`  TEETH/wrong-band: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH: the inverted-reposition-flag-guard twin is CAUGHT", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenInvertedFlagGuard);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted reposition-flag guard — worthless");
  console.log(`  TEETH/flag-guard: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH: the inverted-airborne-guard twin is CAUGHT", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenInvertedAirborneGuard);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted airborne guard — worthless");
  console.log(`  TEETH/airborne-guard: caught — ${describeMismatch(mismatch)}`);
});
