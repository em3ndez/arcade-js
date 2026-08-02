// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for carryMarioUpWithLift (ROM 0x276F) — the [0x2C,0x43) X-band arm of the
 * vertical-reposition machine dispatchElevatorRideByColumn.
 *
 * carryMarioUpWithLift's whole memory-observable behaviour is a function of ONE byte — the prior
 * MARIO_Y (0x6205) — so the gate is EXHAUSTIVE over MARIO_Y in 0..255, and that single
 * sweep covers both arms outright:
 *
 *   PATH RESET  (MARIO_Y  < 0x71, values 0x00..0x70) — hands off to killMarioAtEndOfLiftTravel, which clears
 *               MARIO_ACTIVE (0x6200) and EDGE_REPOSITION_FLAG (0x6398) to 0.
 *   PATH STEP   (MARIO_Y >= 0x71, values 0x71..0xFF) — decrements MARIO_Y by one and mirrors
 *               the new value into Mario's sprite-record Y (0x694F).
 *
 * The oracle nets exactly ONE caller-return pop on EVERY path (killMarioAtEndOfLiftTravel's `ret` on the reset
 * arm; carryMarioUpWithLift's own `ret` on the step arm) and only READS the stack — it never pushes. The
 * idiomatic routine models no stack (a direct killMarioAtEndOfLiftTravel call + a plain JS return), so
 * runCandidate performs ONE m.ret() after it to line pc + SP up with the oracle. Because
 * neither side WRITES the stack, the RAM diff is the whole dump with NO STACK_SCRATCH
 * exclusion — the compare would catch a stray stack write if one existed.
 *
 * The crafted entries seed MARIO_ACTIVE / EDGE_REPOSITION_FLAG nonzero and the sprite-record
 * Y mirror to a value the step never produces, so every write on both arms is a REAL
 * overwrite (not a no-op) and the teeth below are actually observable.
 *
 * 0x276F is NEVER dispatched in attract (verified 0 over 6000 frames — it fires only when
 * this reposition arm is live, which attract's 25m demo never drives), so realism comes from
 * building the crafted entries on a REAL booted attract base rather than a bare reset.
 *
 *   0. REACHABILITY — confirm 0x276F stays unreached in attract, so crafted coverage carries
 *      the gate (if it ever fires, add captured coverage).
 *   1. EQUAL (exhaustive) — carryMarioUpWithLift == oracle over RAM (whole dump) + pc + SP across all 256
 *      MARIO_Y priors.
 *   2. NON-VACUITY — a step-arm entry writes EXACTLY {MARIO_Y, 0x694F} and a reset-arm entry
 *      writes EXACTLY {MARIO_ACTIVE, 0x6398}, both to the expected values, neighbours
 *      untouched — so the sweep compares real overwrites.
 *   3. TEETH (exhaustive) — four deliberately-broken twins, each of which the same sweep MUST
 *      catch:
 *        (a) wrong limit (0x72 not 0x71) — flips the arm at MARIO_Y == 0x71.
 *        (b) dropped sprite mirror — skips the 0x694F write; caught at 0x694F.
 *        (c) no decrement — writes MARIO_Y unchanged; caught at 0x6205.
 *        (d) skipped edge reset — does nothing on the reset arm; caught at 0x6200.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-276f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_276f as oracle } from "../../translated/loc_276f.js";
import { carryMarioUpWithLift } from "../carryMarioUpWithLift.js";
import { killMarioAtEndOfLiftTravel } from "../killMarioAtEndOfLiftTravel.js"; // idiomatic edge reset, used by the broken twins
import { MARIO_Y, MARIO_SPRITE_RECORD, SPRITE_Y, MARIO_ACTIVE, EDGE_REPOSITION_FLAG } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x276f;
const SPRITE_Y_CELL = MARIO_SPRITE_RECORD + SPRITE_Y; // 0x694F — Mario's sprite-record Y
const TOP_LIMIT = 0x71; // MARIO_Y < this -> reset arm; >= this -> step arm

// The caller sub_271e does `push16(0x2721); call 0x2745`, and dispatchElevatorRideByColumn tail-jumps into
// 0x276F, so the return address on the stack when 0x276F runs is 0x2721.
const RET_ADDR = 0x2721;

// Priors seeded so BOTH arms' writes are real overwrites (never no-ops), and neighbours to
// catch an off-by-one write target.
const MIRROR_PRIOR = 0x00; // 0x694F prior; the step writes MARIO_Y-1 (>= 0x70), never 0x00
const ACTIVE_PRIOR = 0xa5; // MARIO_ACTIVE prior; the reset clears it to 0
const EDGE_PRIOR = 0xc3;   // EDGE_REPOSITION_FLAG prior; the reset clears it to 0
const NOISE = new Map([
  [MARIO_Y - 1, 0x11], [MARIO_Y + 1, 0x22],       // 0x6204 / 0x6206
  [SPRITE_Y_CELL - 1, 0x33], [SPRITE_Y_CELL + 1, 0x44], // 0x694E / 0x6950
]);

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A real, self-consistent machine: boot + a stretch of attract so work RAM holds realistic
// values. 0x276F is never dispatched here; every entry is crafted by poking MARIO_Y.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

/**
 * A crafted entry: a clone of `base` with the swept MARIO_Y, the two arms' target cells
 * seeded to observable priors, neighbour noise, and a stack carrying a plausible caller
 * return so the terminal pop is well-defined.
 */
function makeEntry(base, y) {
  const e = base.clone();
  e.mem.write8(MARIO_Y, y);
  e.mem.write8(SPRITE_Y_CELL, MIRROR_PRIOR);
  e.mem.write8(MARIO_ACTIVE, ACTIVE_PRIOR);
  e.mem.write8(EDGE_REPOSITION_FLAG, EDGE_PRIOR);
  for (const [addr, val] of NOISE) e.mem.write8(addr, val);
  e.regs.sp = 0x6c00;
  e.push16(RET_ADDR);
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/** The full memory-equivalence contract: RAM (whole dump) + pc + SP. Live-out is memory-only;
 *  pc/SP are asserted only to prove the dissolved tail-jump/ret bracket lines up. */
function contractDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return { kind: "RAM", addr: ram.addr, msg: `RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}` };
  if (a.pc !== b.pc) return { kind: "pc", msg: `pc oracle=${hx(a.pc)} cand=${hx(b.pc)}` };
  if (a.regs.sp !== b.regs.sp) return { kind: "SP", msg: `SP oracle=${hx(a.regs.sp)} cand=${hx(b.regs.sp)}` };
  return null;
}

/**
 * Run the oracle and a candidate on two FRESH, byte-identical crafted entries and diff the
 * contract. The oracle performs its own terminal `ret`; the candidate models no stack, so
 * one m.ret() after it lines pc + SP up. Returns the diff (or null).
 */
function runPair(base, y, candidate) {
  const a = makeEntry(base, y); // oracle
  const b = makeEntry(base, y); // candidate
  oracle(a);
  candidate(b);
  b.ret(); // model the candidate's terminal return (the oracle's ret / killMarioAtEndOfLiftTravel's ret)
  return contractDiff(a, b);
}

/** Sweep MARIO_Y over all 256 priors. Returns the first mismatch (or null) and the count. */
function fullSweep(base, candidate) {
  let count = 0;
  for (let y = 0; y < 256; y++) {
    const diff = runPair(base, y, candidate);
    count++;
    if (diff) return { mismatch: { y, diff }, count };
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) => mm && `at MARIO_Y=${hx(mm.y)}: ${mm.diff.msg}`;

// -- 0. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x276F is NOT dispatched in attract — the gate rests on crafted entries", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(6000);
  assert.equal(count, 0, "expected 0x276F to stay unreached in attract; if it now fires, add captured coverage");
  console.log(`  REACHABILITY: ${count} natural 0x276F dispatches in 6000 frames — crafted coverage carries the gate`);
});

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): carryMarioUpWithLift == oracle across all 256 MARIO_Y priors (RAM + pc + SP)", () => {
  const base = attractBase();
  const { mismatch, count } = fullSweep(base, carryMarioUpWithLift);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256, "must have swept the full MARIO_Y input space");
  console.log(`  EQUAL/exhaustive: ${count} MARIO_Y priors — RAM + pc + SP identical to the oracle`);
});

// -- 2. NON-VACUITY -----------------------------------------------------------

// Every non-stack RAM address that changed between two machines.
function changedAddrs(pre, post) {
  const da = pre.dumpState(), db = post.dumpState();
  const out = [];
  for (let i = 0; i < Math.min(da.length, db.length); i++) {
    if (da[i] !== db[i]) out.push(pre.stateOffsetToAddr(i));
  }
  return out.sort((x, y) => x - y);
}

test("NON-VACUITY: the step arm writes {MARIO_Y, 0x694F} and the reset arm writes {MARIO_ACTIVE, 0x6398}", () => {
  const base = attractBase();

  // STEP arm (MARIO_Y = 0x80): decrement to 0x7F and mirror it; nothing else moves.
  const stepPre = makeEntry(base, 0x80);
  const stepPost = stepPre.clone();
  oracle(stepPost);
  assert.equal(stepPost.mem.read8(MARIO_Y), 0x7f, "step arm must decrement MARIO_Y");
  assert.equal(stepPost.mem.read8(SPRITE_Y_CELL), 0x7f, "step arm must mirror MARIO_Y-1 to the sprite record");
  assert.deepEqual(changedAddrs(stepPre, stepPost), [MARIO_Y, SPRITE_Y_CELL].sort((x, y) => x - y),
    "step arm write set must be exactly {MARIO_Y, 0x694F}");
  for (const [addr, val] of NOISE) assert.equal(stepPost.mem.read8(addr), val, `step: neighbour ${hx(addr)} disturbed`);

  // RESET arm (MARIO_Y = 0x40): clear MARIO_ACTIVE and the edge flag; nothing else moves.
  const resetPre = makeEntry(base, 0x40);
  const resetPost = resetPre.clone();
  oracle(resetPost);
  assert.equal(resetPost.mem.read8(MARIO_ACTIVE), 0, "reset arm must clear MARIO_ACTIVE");
  assert.equal(resetPost.mem.read8(EDGE_REPOSITION_FLAG), 0, "reset arm must clear EDGE_REPOSITION_FLAG");
  assert.deepEqual(changedAddrs(resetPre, resetPost), [MARIO_ACTIVE, EDGE_REPOSITION_FLAG].sort((x, y) => x - y),
    "reset arm write set must be exactly {MARIO_ACTIVE, 0x6398}");
  for (const [addr, val] of NOISE) assert.equal(resetPost.mem.read8(addr), val, `reset: neighbour ${hx(addr)} disturbed`);

  console.log("  NON-VACUITY: step -> {MARIO_Y, 0x694F}, reset -> {MARIO_ACTIVE, 0x6398}, neighbours untouched");
});

// -- 3. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): wrong limit (0x72 not 0x71) — takes the reset arm at MARIO_Y == 0x71 where the
 *  oracle steps. Caught at that boundary. */
function brokenWrongLimit(m) {
  const { mem } = m;
  const y = mem.read8(MARIO_Y);
  if (y < 0x72) { killMarioAtEndOfLiftTravel(m); return; } // BUG: should be 0x71
  const s = y - 1;
  mem.write8(MARIO_Y, s);
  mem.write8(SPRITE_Y_CELL, s);
}

/** BUG (b): drops the sprite-record mirror. Caught at 0x694F on the step arm. */
function brokenDropMirror(m) {
  const { mem } = m;
  const y = mem.read8(MARIO_Y);
  if (y < TOP_LIMIT) { killMarioAtEndOfLiftTravel(m); return; }
  mem.write8(MARIO_Y, y - 1);
  // BUG: dropped mem.write8(SPRITE_Y_CELL, y - 1)
}

/** BUG (c): writes MARIO_Y unchanged (no decrement). Caught at 0x6205 on the step arm. */
function brokenNoDecrement(m) {
  const { mem } = m;
  const y = mem.read8(MARIO_Y);
  if (y < TOP_LIMIT) { killMarioAtEndOfLiftTravel(m); return; }
  mem.write8(MARIO_Y, y); // BUG: should be y - 1
  mem.write8(SPRITE_Y_CELL, y);
}

/** BUG (d): does nothing on the reset arm (skips the edge reset). Caught at 0x6200. */
function brokenSkipEdgeReset(m) {
  const { mem } = m;
  const y = mem.read8(MARIO_Y);
  if (y < TOP_LIMIT) { return; } // BUG: dropped killMarioAtEndOfLiftTravel(m)
  const s = y - 1;
  mem.write8(MARIO_Y, s);
  mem.write8(SPRITE_Y_CELL, s);
}

test("TEETH (exhaustive): the wrong-limit twin is CAUGHT", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenWrongLimit);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong arm limit — worthless");
  assert.equal(mismatch.y, TOP_LIMIT, "the wrong-limit twin must first diverge at MARIO_Y == 0x71");
  console.log(`  TEETH/wrong-limit: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the dropped-sprite-mirror twin is CAUGHT at 0x694F", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenDropMirror);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped sprite mirror — worthless");
  assert.equal(mismatch.diff.addr, SPRITE_Y_CELL, "the dropped-mirror twin must diverge on the sprite-record Y");
  console.log(`  TEETH/drop-mirror: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the no-decrement twin is CAUGHT at 0x6205", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenNoDecrement);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a missing decrement — worthless");
  assert.equal(mismatch.diff.addr, MARIO_Y, "the no-decrement twin must diverge on MARIO_Y");
  console.log(`  TEETH/no-decrement: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the skipped-edge-reset twin is CAUGHT at 0x6200", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenSkipEdgeReset);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a skipped edge reset — worthless");
  assert.equal(mismatch.diff.addr, MARIO_ACTIVE, "the skipped-edge twin must diverge on MARIO_ACTIVE");
  console.log(`  TEETH/skip-reset: caught — ${describeMismatch(mismatch)}`);
});
