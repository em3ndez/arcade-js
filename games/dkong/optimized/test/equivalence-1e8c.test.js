// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_1e8c -- the (0x6350) CALLER-SKIP guard at the head of
 * loc_197a's per-frame update cascade (`ld a,(0x6350) ; and a ; ret z ; call 0x1e96`,
 * whose non-zero path falls into the `pop hl ; ret` skip-tail entry_1e94). COLLAPSED:
 * the prologue `ld a` + `and a` fold to one m.step (17 t) at 0x1E90; each arm's total is
 * preserved. See optimized/entry_1e8c.js for the fold, the flag analysis, and the
 * boolean contract.
 *
 * THE BOOLEAN IS THE CONTRACT. entry_1e8c returns a boolean the caller branches on
 * (`if (!m.call(0x1e8c)) return;`): the ZERO path returns `true` (guard inactive ->
 * caller CONTINUES the cascade); the NON-ZERO path returns `false` (guard active -> the
 * skip-tail already unwound one frame, so the caller must ABORT). The RAM+register diff
 * CANNOT see a JS return value, so every arm asserts the returned boolean DIRECTLY, and
 * a boolean-flipping twin is caught by that assertion (teeth the state diff lacks).
 *
 * REACHABILITY (measured, not assumed). loc_197a is dispatched from the NMI game-state
 * gameplay path, and entry_1e8c is its 2nd call. Probed: entry_1e8c dispatches 816x over
 * 1400 attract frames (616x/1200, first entry ~frame 586 once the attract demo starts
 * PLAYING 25m). Every natural dispatch is on the ZERO path (0x6350 is always 0 in
 * attract), so the whole-machine gate exercises the zero arm and is NON-vacuous; the
 * NON-ZERO arm is covered by SYNTHESIS below.
 *
 * ATOMIC, so the STRICT byte-exact whole-machine gate is the right license (not the
 * convergent gate, which is for INTERRUPTIBLE collapses whose mistimed-NMI raster tear /
 * dead-stack PC false-fail the strict gate). Probed: every entry_1e8c dispatch occurs
 * INSIDE the NMI handler (nmiMask==0 at 616/616 attract entries; outside-NMI 0), where
 * entry_0066 has cleared the NMI mask so the interrupt cannot re-enter -- and the NMI's
 * pushed PC NEVER lands in [0x1E8C,0x1E93] (0 landings over 1194 NMIs; 1185 fall in the
 * 0x02BD-0x0372 main-loop band). A correct atomic collapse is therefore byte-exact here,
 * confirmed below by the strict gate passing over a 136-invocation window.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry and its dropped-flag + wrong-boolean teeth; FULL-BRANCH
 * coverage of BOTH arms -- the ZERO (no-skip) arm from the natural entry and the NON-ZERO
 * (skip) arm SYNTHESISED both end-to-end (real sub_1e96 subtree) and isolated (subtree
 * stubbed) -- each EQUAL over RAM+regs+pc+SP AND its exact cycle TOTAL AND its returned
 * boolean; and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_1e8c as translated_1e8c } from "../../translated/state0.js";
import { entry_1e8c as optimized_1e8c } from "../entry_1e8c.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence, unitEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1e8c;
const SUBTREE = 0x1e96;   // call 0x1e96 -- the 0x6345 rst-0x28 dispatch on the non-zero arm
const GUARD = 0x6350;     // ram.js SCRATCH_6350 (the guard byte) -- unevidenced, kept hex
const DISPATCH_IDX = 0x6345; // ram.js SCRATCH_6345 (sub_1e96's index) -- unevidenced, kept hex
const FRAMES_WHOLE = 720; // past the ~f586 first dispatch: 136 invocations, teeth diverge ~f588
const FRAMES_UNIT = 650;  // the unit host must run past the first dispatch (~f586) to capture it

const ZERO_TOTAL = 28;    // zero arm own total: ld+and 17 + ret z taken 11
const NONZERO_OWN = 59;   // non-zero own (subtree stubbed): 17 + ret-not-taken 5 + call 17 + skip-tail 20
const NONZERO_E2E = 189;  // non-zero end-to-end with the real 0x6345=1 subtree

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed entry_1e8c is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1e8c]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic collapse)`);
});

test("STRICT-TEETH (cycles): a wrong prologue total forks the trajectory and is CAUGHT", () => {
  // The collapse's load-bearing invariant is total-cycle preservation. Charging the
  // prologue 16 t instead of 17 shifts the frame's cycle budget -> the spin count 0x6019
  // (PRNG entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(GUARD);
    regs.and(regs.a);
    m.step(0x1e90, 16); // DROPPED: 17 -> 16
    if (regs.fZ) { m.ret(11); return true; }
    m.step(0x1e91, 5);
    m.push16(0x1e94); m.step(SUBTREE, 17); m.call(SUBTREE);
    m.call(0x1e94);
    return false;
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- the ZERO/no-skip arm) ------------------------

/** Capture the pristine machine the instant entry_1e8c is first entered (via m.call,
 *  deep in the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1e8c(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

test("EQUAL (unit): idiomatic entry_1e8c matches translated in RAM + full register file + pc", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_1e8c, optimized_1e8c, { maxFrames: FRAMES_UNIT });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, SP) + pc identical (natural zero-path entry)");
});

test("TEETH (unit behavioural): dropping `and a` leaves F wrong and is CAUGHT", () => {
  // `and a` is BOTH the branch condition and the exit-flag writer. A twin that skips it
  // reads a stale Z (may take the wrong arm) and leaves the wrong F -- caught by the diff.
  const broken_noAnd = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(GUARD);
    // BUG: regs.and(regs.a) dropped -- F not set from A
    m.step(0x1e90, 17);
    if (regs.fZ) { m.ret(11); return true; }
    m.step(0x1e91, 5);
    m.push16(0x1e94); m.step(SUBTREE, 17); m.call(SUBTREE);
    m.call(0x1e94);
    return false;
  };
  const a = NATURAL_ENTRY.clone();
  const b = NATURAL_ENTRY.clone();
  translated_1e8c(a);
  broken_noAnd(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  const caught = ram != null || regs != null || a.pc !== b.pc || a.regs.sp !== b.regs.sp;
  assert.ok(caught, "unit gate FAILED to catch a dropped `and a` -- it is worthless");
  console.log(`  TEETH/unit: caught -- diff at ${regs ? regs.reg : (ram ? "0x" + ram.addr.toString(16) : "pc/sp")}`);
});

// -- FULL-BRANCH COVERAGE (both arms: EQUAL + cycle TOTAL + returned boolean) --

/** Clone the natural entry, optionally poke the guard/index, install an optional
 *  zero-cost 0x1e96 stub, run `fn`, and report the full contract (return value, own
 *  cycles, SP, PC, machine). The stub consumes the 0x1E94 return frame that our
 *  `call 0x1e96` pushes -- exactly the NET stack effect of the real subtree's `ret` --
 *  so the skip-tail choreography stays correct while charging 0 subtree cycles. */
function runArm(fn, { guard, idx, stubSubtree = false } = {}) {
  const c = NATURAL_ENTRY.clone();
  if (guard !== undefined) c.mem.write8(GUARD, guard);
  if (idx !== undefined) c.mem.write8(DISPATCH_IDX, idx);
  if (stubSubtree) c.routines.set(SUBTREE, (mm) => { mm.pop16(); }); // consume 0x1E94, 0 cycles
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP), pin its exact cycle total
 *  against both the oracle and the structural constant `expectCycles`, and assert the
 *  returned boolean matches the oracle and equals `expectBool`. */
function assertArm(label, opts, expectCycles, expectBool) {
  const o = runArm(translated_1e8c, opts);
  const p = runArm(optimized_1e8c, opts);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match the oracle");
  assert.equal(o.sp, p.sp, "SP must match the oracle");
  assert.equal(p.cycles, o.cycles, `${label}: cycle total mismatch (oracle ${o.cycles} t vs collapsed ${p.cycles} t)`);
  assert.equal(o.cycles, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${o.cycles})`);
  assert.equal(o.ret, expectBool, `${label}: oracle boolean should be ${expectBool}`);
  assert.equal(p.ret, o.ret, `${label}: optimized boolean must match the oracle (${o.ret})`);
  console.log(`  BRANCH/${label}: EQUAL -- ret=${p.ret}, pc=0x${p.pc.toString(16)}, ` +
    `sp=0x${p.sp.toString(16)}, ${p.cycles} t == oracle ${o.cycles} t`);
}

test("BRANCH (unit): ZERO arm -- (0x6350)==0 -> ret z, returns TRUE (28 t)", () => {
  // The natural entry is already on the zero path (0x6350==0). Guard inactive: `ret z`
  // pops loc_197a's 0x1980 and the caller CONTINUES; the JS boolean is true.
  assert.equal(NATURAL_ENTRY.mem.read8(GUARD), 0x00, "natural entry is on the zero path");
  assertArm("zero/true", {}, ZERO_TOTAL, true);
  const r = runArm(optimized_1e8c, {});
  assert.equal(r.pc, 0x1980, "zero arm returns to loc_197a @0x1980 (caller continues)");
  assert.equal(r.sp, (NATURAL_ENTRY.regs.sp + 2) & 0xffff, "zero arm pops exactly one frame (the 0x1980 push)");
});

test("BRANCH (unit): NON-ZERO arm end-to-end -- (0x6350)!=0 -> sub_1e96 subtree + skip, returns FALSE (189 t)", () => {
  // Synthesised: guard != 0, dispatch index 0x6345=1 (a clean-completing arm). The real
  // sub_1e96 subtree runs on BOTH sides via m.call, then the skip-tail unwinds a frame.
  // Cycle total 189 t covers the WHOLE dispatched subtree, not just the prologue.
  assertArm("nonzero/false-e2e", { guard: 0x80, idx: 0x01 }, NONZERO_E2E, false);
});

test("BRANCH (unit): NON-ZERO arm isolated -- own total 59 t, index-independent, returns FALSE", () => {
  // Subtree stubbed to 0 cycles (but its NET stack effect preserved), so the measured
  // total is entry_1e8c's OWN charge alone -- a structural, index-independent teeth for a
  // wrong collapsed prologue on the skip arm. SP unwinds two frames (0x1E94 via the stub,
  // then 0x1980 via the skip-tail's `pop hl`+`ret`).
  assertArm("nonzero/false-own", { guard: 0x80, idx: 0x01, stubSubtree: true }, NONZERO_OWN, false);
  const r = runArm(optimized_1e8c, { guard: 0x80, idx: 0x01, stubSubtree: true });
  assert.equal(r.sp, (NATURAL_ENTRY.regs.sp + 4) & 0xffff, "skip arm unwinds two frames (SP = entry + 4)");
});

test("BRANCH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // Zero arm charged 16 instead of 17 -> total no longer matches the oracle.
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(GUARD);
    regs.and(regs.a);
    m.step(0x1e90, 16); // DROPPED: 17 -> 16
    if (regs.fZ) { m.ret(11); return true; }
    m.step(0x1e91, 5);
    m.push16(0x1e94); m.step(SUBTREE, 17); m.call(SUBTREE);
    m.call(0x1e94);
    return false;
  };
  const o = runArm(translated_1e8c, {});
  const b = runArm(dropped, {});
  assert.equal(o.cycles, ZERO_TOTAL, `the correct zero-arm total is ${ZERO_TOTAL} t`);
  assert.notEqual(b.cycles, o.cycles, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${o.cycles} t vs dropped-charge ${b.cycles} t -- caught`);
});

// -- BOOLEAN TEETH (the caller-skip contract the RAM+reg diff cannot see) ------

test("BOOLEAN-TEETH: a flipped return value is CAUGHT on both arms (the caller-skip contract)", () => {
  // The returned boolean IS the contract. A twin that flips it leaves RAM+regs+pc+SP
  // identical (same machine effects) yet breaks the caller's `if (!m.call(...)) return;`.
  // Only a direct return-value assertion catches it.
  const flipped = (m) => (translated_1e8c(m) ? false : true); // same effects, wrong boolean

  const zO = runArm(translated_1e8c, {});
  const zB = runArm(flipped, {});
  assert.equal(zO.ret, true, "zero arm oracle returns true");
  assert.notEqual(zB.ret, zO.ret, "flipped zero-arm boolean must be caught");

  const nO = runArm(translated_1e8c, { guard: 0x80, idx: 0x01 });
  const nB = runArm(flipped, { guard: 0x80, idx: 0x01 });
  assert.equal(nO.ret, false, "non-zero arm oracle returns false");
  assert.notEqual(nB.ret, nO.ret, "flipped non-zero-arm boolean must be caught");
  console.log(`  BOOLEAN-TEETH: caught -- zero true->${zB.ret}, non-zero false->${nB.ret}`);
});
