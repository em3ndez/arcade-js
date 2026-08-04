// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2243 (ROM 0x2243) — the "has Mario reached the target"
 * three-condition hit test.
 *
 * sub_2243's whole memory-observable behaviour is a PURE FUNCTION of three decisions
 * and it writes NO memory: the result is
 *
 *     hit = (MARIO_Y < 0x7a) && (MARIO_AIRBORNE == 0) && (MARIO_X == target)
 *
 * where `target` is the byte the caller points at through HL. On a hit the oracle
 * returns to its caller (true); on any miss it tail-calls the shared caller-skip
 * 0x2257 (skip_2257 / idiomatic reportNoHitAndSkipCaller), which returns false. Both exits only READ
 * the stack — neither writes RAM — so the memory-equivalence contract is exactly:
 * (1) neither side writes any RAM (whole 5120-byte dump, no STACK_SCRATCH exclusion
 * needed) and (2) both return the same hit/no-hit signal. pc/SP are dead (the oracle's
 * stack drop is replaced by the boolean), so they are not compared.
 *
 * Because the result factors into three independent decisions and the routine writes
 * nothing, four disjoint 256-wide sweeps over a real attract base are an EXHAUSTIVE
 * proof, not a sample:
 *
 *   SWEEP Y     — vary MARIO_Y over all 256 with airborne clear and X == target;
 *                 exercises the REACH_Y threshold at every value including 0x79/0x7a.
 *   SWEEP AIR   — vary MARIO_AIRBORNE over all 256 with Y in-band and X == target;
 *                 exercises the airborne gate at every value.
 *   SWEEP MATCH — vary the target byte over all 256 with a fixed MARIO_X, Y in-band,
 *                 grounded; exactly one value hits, the other 255 miss.
 *   SWEEP XEQ   — vary MARIO_X over all 256 with target == X (always aligned), Y
 *                 in-band, grounded; the hit path across every X value.
 *
 *   1. EQUAL (exhaustive) — loc_2243 == oracle on every swept state (RAM + return),
 *      and the oracle itself produces the expected hit/no-hit (non-vacuity: both a
 *      hit and a miss are actually observed).
 *
 *   2. TEETH (exhaustive) — three deliberately-broken twins, each of which the SAME
 *      sweeps MUST catch via the return signal:
 *        (a) dropped airborne gate — hits while airborne.
 *        (b) off-by-one Y boundary — uses `> REACH_Y` so it hits at exactly 0x7a.
 *        (c) inverted X test — hits when X != target.
 *
 *   3. REALISM (captured) — 0x2243 is a gameplay-only hit-test (its callers hold50mObjectParked /
 *      slide50mObjectDown are never reached in attract, so 0x2243 never dispatches there). Real
 *      in-play machine states are therefore captured at the nearest reachable ancestor,
 *      dispatch50mObjectState (ROM 0x2207), whose stack and Mario cells hold realistic values; on
 *      each, loc_2243 must reproduce the oracle (no RAM, same signal).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2243.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2243 as oracle } from "../../translated/loc_2243.js";
import { marioReachedTargetColumn as loc_2243 } from "../marioReachedTargetColumn.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { MARIO_X, MARIO_Y, MARIO_AIRBORNE } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const ANCESTOR = 0x2207; // dispatch50mObjectState: the reachable same-subsystem ancestor of 0x2243
const REACH_Y = 0x7a;    // the oracle's `cp 0x7a`: hit needs MARIO_Y < 0x7a
// A work-RAM cell used as the caller's target pointer (HL). Distinct from the Mario
// cells and from the stack region, so writing the target never aliases either.
const TARGET_PTR = 0x66a2;
// Point SP at work RAM so the oracle's `ret` / `pop` on either exit read valid bytes
// (never I/O) — those pops write nothing, so they never affect the compared memory.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The oracle's true result for a given decision triple — the ground truth the sweeps
// assert against for non-vacuity.
const expectedHit = (y, air, x, target) => y < REACH_Y && air === 0 && x === target;

/**
 * A crafted entry: a clone of `base` with the three Mario cells and the caller's
 * target byte set, HL pointing at that byte, and a safe stack. Frame machinery is
 * neutralised so a stray NMI can't masquerade as a side effect.
 */
function makeEntry(base, { y, air, x, target }) {
  const e = base.clone();
  e.regs.sp = SAFE_SP;
  e.regs.hl = TARGET_PTR;
  e.mem.write8(MARIO_Y, y);
  e.mem.write8(MARIO_AIRBORNE, air);
  e.mem.write8(MARIO_X, x);
  e.mem.write8(TARGET_PTR, target);
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and a candidate on two FRESH byte-identical clones of `entry` and
 * report the contract diffs: any RAM divergence over the whole dump (no exclusion —
 * neither side writes RAM) and any divergence in the boolean hit signal. Also returns
 * the oracle's own result for the non-vacuity check.
 */
function contractDiffs(entry, candidate) {
  const a = entry.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity;
  const b = entry.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity;
  const ro = oracle(a);
  const rc = candidate(b);
  const diffs = [];
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  if (ro !== rc) diffs.push(`return oracle=${ro} cand=${rc}`);
  return { diffs, ro };
}

/**
 * The four disjoint 256-wide sweeps. Returns the first mismatch (oracle vs candidate,
 * or oracle vs its own expected result) or null, the total combos compared, and
 * whether both a hit and a miss were observed from the oracle.
 */
function fullSweep(base, candidate) {
  let count = 0;
  let sawHit = false;
  let sawMiss = false;

  const run = (spec) => {
    const entry = makeEntry(base, spec);
    const { diffs, ro } = contractDiffs(entry, candidate);
    count++;
    if (ro) sawHit = true; else sawMiss = true;
    const exp = expectedHit(spec.y, spec.air, spec.x, spec.target);
    if (ro !== exp) return { spec, why: `oracle=${ro} but expected ${exp}` };
    if (diffs.length) return { spec, why: diffs.join("; ") };
    return null;
  };

  // SWEEP Y — threshold at every value (airborne clear, X == target).
  for (let y = 0; y < 256; y++) {
    const mm = run({ y, air: 0, x: 0x50, target: 0x50 });
    if (mm) return { mismatch: mm, count, sawHit, sawMiss };
  }
  // SWEEP AIR — airborne gate at every value (Y in-band, X == target).
  for (let air = 0; air < 256; air++) {
    const mm = run({ y: 0x40, air, x: 0x50, target: 0x50 });
    if (mm) return { mismatch: mm, count, sawHit, sawMiss };
  }
  // SWEEP MATCH — target byte over every value against fixed X (in-band, grounded).
  for (let target = 0; target < 256; target++) {
    const mm = run({ y: 0x40, air: 0, x: 0x50, target });
    if (mm) return { mismatch: mm, count, sawHit, sawMiss };
  }
  // SWEEP XEQ — X over every value with target == X (always aligned, in-band, grounded).
  for (let x = 0; x < 256; x++) {
    const mm = run({ y: 0x40, air: 0, x, target: x });
    if (mm) return { mismatch: mm, count, sawHit, sawMiss };
  }

  return { mismatch: null, count, sawHit, sawMiss };
}

const describe = (mm) => mm && `at y=${hx(mm.spec.y)} air=${hx(mm.spec.air)} x=${hx(mm.spec.x)} target=${hx(mm.spec.target)}: ${mm.why}`;

// A real, self-consistent machine: boot + a stretch of attract so work RAM (and the
// stack) hold realistic values. clone() neutralises the frame machinery.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone();
}

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_2243 == oracle across all four decision sweeps", () => {
  const base = attractBase();
  const { mismatch, count, sawHit, sawMiss } = fullSweep(base, loc_2243);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 4 * 256, "must have compared the full factored decision space");
  assert.ok(sawHit && sawMiss, "the sweeps must exercise BOTH a hit and a miss (non-vacuity)");
  console.log(`  EQUAL/exhaustive: ${count} decision states — RAM identical + same hit signal as the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** Broken twin (a): drops the airborne gate — reports a hit while airborne. */
function brokenDropAirborne(m) {
  const { regs, mem } = m;
  if (mem.read8(MARIO_Y) >= REACH_Y) return false;
  // BUG: no MARIO_AIRBORNE check
  if (mem.read8(MARIO_X) !== mem.read8(regs.hl)) return false;
  return true;
}

/** Broken twin (b): off-by-one Y boundary — uses `>` so it hits at exactly 0x7a. */
function brokenYBoundary(m) {
  const { regs, mem } = m;
  if (mem.read8(MARIO_Y) > REACH_Y) return false; // BUG: should be >=
  if (mem.read8(MARIO_AIRBORNE) !== 0) return false;
  if (mem.read8(MARIO_X) !== mem.read8(regs.hl)) return false;
  return true;
}

/** Broken twin (c): inverted X test — reports a hit when X != target. */
function brokenInvertX(m) {
  const { regs, mem } = m;
  if (mem.read8(MARIO_Y) >= REACH_Y) return false;
  if (mem.read8(MARIO_AIRBORNE) !== 0) return false;
  if (mem.read8(MARIO_X) === mem.read8(regs.hl)) return false; // BUG: === not !==
  return true;
}

test("TEETH (exhaustive): the dropped-airborne twin is CAUGHT (return signal diverges)", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenDropAirborne);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped airborne gate — the gate is worthless");
  console.log(`  TEETH/airborne: caught — ${describe(mismatch)}`);
});

test("TEETH (exhaustive): the off-by-one Y-boundary twin is CAUGHT", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenYBoundary);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an off-by-one Y boundary — worthless");
  console.log(`  TEETH/boundary: caught — ${describe(mismatch)}`);
});

test("TEETH (exhaustive): the inverted-X-test twin is CAUGHT", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenInvertX);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted X test — worthless");
  console.log(`  TEETH/xtest: caught — ${describe(mismatch)}`);
});

// -- 3. REALISM (captured) ----------------------------------------------------

// Capture up to K real machine states at ANCESTOR (dispatch50mObjectState) during an attract run,
// letting the original routine run afterwards so the game proceeds undisturbed.
function captureAncestorStates(K, frames) {
  const orig = new Machine(ROM).routines.get(ANCESTOR); // the translated dispatch50mObjectState
  const caps = [];
  const snap = new Map([[ANCESTOR, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return orig(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(frames);
  return caps;
}

test("REALISM (captured): loc_2243 == oracle on real in-play states from dispatch50mObjectState", () => {
  const caps = captureAncestorStates(200, 2000);
  assert.ok(caps.length >= 1, "expected dispatch50mObjectState (0x2207) to dispatch during attract");
  for (const cap of caps) {
    const { diffs } = contractDiffs(cap, loc_2243);
    assert.equal(diffs.length, 0, `real captured state: ${diffs.join("; ")}`);
  }
  console.log(`  REALISM: ${caps.length} real in-play states (from 0x2207) — RAM == oracle, same hit signal`);
});
