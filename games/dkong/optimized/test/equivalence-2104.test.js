// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_2104 -- the OFF-SCREEN BOUNDS GATE of the object-update
 * cascade (branch_20ec -> loc_2104). It tests an object's X field ((ix+3)+8) and either
 * tail-jumps the still-on-screen object to the animation-delay tail loc_1fce, or
 * DEACTIVATES the slot ((ix+0):=0, (ix+3):=0) and tail-jumps into the shared object-sprite
 * tail loc_21ba (both `jp`, no push). See optimized/loc_2104.js for the full behaviour block.
 *
 * COLLAPSED: each arm folds its per-instruction m.steps into ONE charge placed at the tail
 * jump -- ON-SCREEN 43 t, DEACTIVATE 95 t (the oracle's exact per-arm sums, both confirmed
 * by measuring the oracle in isolation). The routine writes only work RAM ((ix+0)/(ix+3) are
 * per-object record bytes, NOT a hardware latch) and its only control transfers are the two
 * terminal tail `jp`s -- so the collapse is licensed, and (being ATOMIC) it is proven
 * byte-exact by the STRICT whole-machine gate.
 *
 * REACHABILITY / ATOMICITY (MEASURED -- probe over 1400 attract frames):
 *   - loc_2104 dispatches 171x (first entry frame 613, once the demo starts PLAYING 25m).
 *   - ATOMIC: io.nmiMask == 0 at 171/171 dispatches (inside the NMI, mask cleared by
 *     entry_0066; mask-set 0). The NMI's pushed PC never lands in the body [0x2104,0x2117]
 *     -- 0 landings over 1394 NMIs.
 *   So an atomic byte-exact collapse passes the STRICT whole-machine gate directly.
 *   - BRANCH COVERAGE: the attract run reaches ONLY the ON-SCREEN arm (NC -> loc_1fce,
 *     171/171); the DEACTIVATE arm (C) fires 0x naturally, so it is proven by a crafted
 *     identical-both-sides poke ((ix+3) < 8) with its exact 95 t cycle total pinned.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry (real loc_1fce tail) and its behavioural teeth; FULL-BRANCH
 * coverage of BOTH arms from crafted identical-both-sides pokes (EQUAL over RAM + full
 * register file + pc + SP AND each arm's exact cycle TOTAL, with the tails stubbed
 * identically on both sides to isolate loc_2104's own contribution); and cycle + behavioural
 * teeth the gates CATCH.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2104 as translated_2104 } from "../../translated/state0.js";
import { loc_2104 as optimized_2104 } from "../loc_2104.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2104;
const TAIL_ONSCREEN = 0x1fce; // NC arm: the animation-delay tail
const TAIL_DEACT = 0x21ba;    // C arm: the shared object-sprite tail
const FRAMES_WHOLE = 1400; // past the ~f613 first dispatch; ~171 invocations (all ON-SCREEN)
const FRAMES_UNIT = 650;   // the unit host must run past the first dispatch (~f613) to capture it

const OBJ_BASE = 0x6700; // an object-record base in work RAM (sub_1f72's table base)
const RET_ADDR = 0x4d17; // sentinel caller-return frame for crafted entries

const ONSCREEN_TOTAL = 43; // ld(19)+add(7)+cp(7)+jp nc taken(10)
const DEACT_TOTAL = 95;    // +jp nc NT(10)+xor(4)+ld(ix+0)(19)+ld(ix+3)(19)+jp(10) instead of jp-taken

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) --------------

test("STRICT (whole-machine): loc_2104 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_2104]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic)`);
});

test("STRICT-TEETH (cycles): a wrong per-arm total forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging the ON-SCREEN arm 42 t
  // instead of 43 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG entropy) and
  // where a later NMI's pushed PC lands -> the byte-exact trace diverges. (The ON-SCREEN arm is
  // the one the attract run actually takes, so this twin's teeth bite in the whole-machine gate.)
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    regs.a = mem.read8((ix + 0x03) & 0xffff);
    regs.add(0x08);
    regs.cp(0x10);
    if (regs.fNC) {
      m.step(TAIL_ONSCREEN, 42); // DROPPED: 43 -> 42 on the ON-SCREEN arm
      return m.call(TAIL_ONSCREEN);
    }
    regs.xor(regs.a);
    mem.write8((ix + 0x00) & 0xffff, regs.a);
    mem.write8((ix + 0x03) & 0xffff, regs.a);
    m.step(TAIL_DEACT, 95);
    return m.call(TAIL_DEACT);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry, real loc_1fce tail) ---------------------------

/** Capture the pristine machine the instant loc_2104 is first entered (via m.call, deep in
 *  the loc_197a NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_2104(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry` (real tail runs on both); report the diff. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_2104(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_2104 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_2104);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural entry, real tail)");
});

test("TEETH (unit behavioural): taking the WRONG branch (inverted condition) is CAUGHT", () => {
  // On the naturally-taken ON-SCREEN arm loc_2104 writes no RAM and its exit A/F are DEAD
  // (loc_1fce overwrites A before reading it and never reads F), so the only observable effect
  // of loc_2104 on this arm is WHICH tail runs. A twin that inverts the carry test therefore
  // sends the on-screen object down the DEACTIVATE arm instead: it zeroes (ix+0)/(ix+3) and
  // runs loc_21ba rather than loc_1fce -- a divergence the gate must catch in RAM + pc.
  const broken_flip = (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    regs.a = mem.read8((ix + 0x03) & 0xffff);
    regs.add(0x08);
    regs.cp(0x10);
    if (regs.fC) { // BUG: inverted (correct is fNC) -- on-screen objects wrongly deactivated
      m.step(TAIL_ONSCREEN, 43);
      return m.call(TAIL_ONSCREEN);
    }
    regs.xor(regs.a);
    mem.write8((ix + 0x00) & 0xffff, regs.a);
    mem.write8((ix + 0x03) & 0xffff, regs.a);
    m.step(TAIL_DEACT, 95);
    return m.call(TAIL_DEACT);
  };
  const r = runBoth(NATURAL_ENTRY, broken_flip);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch an inverted branch -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "ram@0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? r.regs.reg : !r.pcEqual ? "pc" : "SP"} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted pokes, tails stubbed identically both sides) --

// A no-op stub for BOTH tails (loc_1fce / loc_21ba): charges nothing and writes nothing, so
// the crafted tests measure loc_2104's OWN contribution (RAM writes, exit reg file, pc, SP,
// and the collapsed per-arm cycle total) in isolation. Installed on BOTH the oracle and the
// optimized machine, so the comparison stays fair. (The real on-screen tail is exercised by
// the whole-machine and natural-entry tests above.)
const TAIL_STUB = () => {};

/** Fresh machine with both tails stubbed, a sentinel caller frame, IX at an object record,
 *  (ix+0) active, and (ix+3) poked to steer the arm -- the sanctioned identical-both-sides seed. */
function seed(slotX) {
  const m = new Machine(ROM, {
    overrides: new Map([[TAIL_ONSCREEN, TAIL_STUB], [TAIL_DEACT, TAIL_STUB]]),
  });
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // caller frame (loc_2104 does no push/ret, so SP must survive intact)
  const entrySP = m.regs.sp;
  m.regs.ix = OBJ_BASE;
  m.mem.write8((OBJ_BASE + 0x00) & 0xffff, 0x01);   // (ix+0) active slot
  m.mem.write8((OBJ_BASE + 0x03) & 0xffff, slotX);  // (ix+3) the object X (steers the branch)
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle total:
 *  optimized must equal the oracle, and the oracle total must equal the structural constant
 *  `expectCycles`. */
function assertArm(label, slotX, expectPc, expectCycles, checkRam) {
  const a = seed(slotX);
  const b = seed(slotX);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2104(a.m);
  optimized_2104(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(b.m.pc, expectPc, `${label}: must land at 0x${expectPc.toString(16)}`);
  assert.equal(b.m.regs.sp, a.entrySP, `${label}: SP unchanged (no push/ret in loc_2104)`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  checkRam(b.m); // the arm actually did its writes
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
    `${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): ON-SCREEN arm -- (ix+3)=0x08 -> +8=0x10 (NC), no writes, jp 0x1fce", () => {
  assertArm("onscreen", 0x08, TAIL_ONSCREEN, ONSCREEN_TOTAL, (m) => {
    assert.equal(m.mem.read8(OBJ_BASE + 0x00), 0x01, "onscreen: (ix+0) untouched (still active)");
    assert.equal(m.mem.read8(OBJ_BASE + 0x03), 0x08, "onscreen: (ix+3) untouched");
    assert.equal(m.regs.a, 0x10, "onscreen: A = (ix+3)+8 = 0x10");
  });
});

test("BRANCH (unit): DEACTIVATE arm -- (ix+3)=0x02 -> +8=0x0a (C), zero (ix+0)/(ix+3), jp 0x21ba", () => {
  assertArm("deactivate", 0x02, TAIL_DEACT, DEACT_TOTAL, (m) => {
    assert.equal(m.mem.read8(OBJ_BASE + 0x00), 0x00, "deactivate: (ix+0) zeroed (slot inactive)");
    assert.equal(m.mem.read8(OBJ_BASE + 0x03), 0x00, "deactivate: (ix+3) zeroed");
    assert.equal(m.regs.a, 0x00, "deactivate: A = 0 (xor a)");
  });
});

test("BRANCH-TEETH (cycles): a dropped charge on the DEACTIVATE arm yields a wrong total and is CAUGHT", () => {
  // DEACTIVATE arm charged 94 t instead of 95 -> total no longer matches the oracle. This is
  // the arm the attract run never reaches, so its cycle teeth live HERE (crafted), not in the
  // whole-machine gate -- exactly the full-branch-coverage requirement in docs/06.
  const dropped = (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    regs.a = mem.read8((ix + 0x03) & 0xffff);
    regs.add(0x08);
    regs.cp(0x10);
    if (regs.fNC) {
      m.step(TAIL_ONSCREEN, 43);
      return m.call(TAIL_ONSCREEN);
    }
    regs.xor(regs.a);
    mem.write8((ix + 0x00) & 0xffff, regs.a);
    mem.write8((ix + 0x03) & 0xffff, regs.a);
    m.step(TAIL_DEACT, 94); // DROPPED: the correct DEACTIVATE total is 95 t
    return m.call(TAIL_DEACT);
  };
  const a = seed(0x02);
  const b = seed(0x02);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2104(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});

test("BRANCH-TEETH (behavioural): omitting the (ix+0) deactivate store is CAUGHT", () => {
  // A twin that clears X but forgets to zero the state byte leaves the slot ACTIVE -- the
  // crafted DEACTIVATE seed makes (ix+0) deterministic (0x01 in, must become 0x00).
  const broken_noDeact = (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    regs.a = mem.read8((ix + 0x03) & 0xffff);
    regs.add(0x08);
    regs.cp(0x10);
    if (regs.fNC) {
      m.step(TAIL_ONSCREEN, 43);
      return m.call(TAIL_ONSCREEN);
    }
    regs.xor(regs.a);
    // BUG: the `ld (ix+0),a` deactivate store is dropped.
    mem.write8((ix + 0x03) & 0xffff, regs.a);
    m.step(TAIL_DEACT, 95);
    return m.call(TAIL_DEACT);
  };
  const a = seed(0x02);
  const b = seed(0x02);
  translated_2104(a.m);
  broken_noDeact(b.m);
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.notEqual(ram, null, "gate FAILED to catch an omitted deactivate store -- it is worthless");
  assert.equal(a.m.mem.read8(OBJ_BASE + 0x00), 0x00, "oracle deactivated the slot (ix+0)=0x00");
  assert.equal(b.m.mem.read8(OBJ_BASE + 0x00), 0x01, "broken twin left the slot active (ix+0)=0x01");
  console.log(`  BRANCH-TEETH/behavioural: caught -- (ix+0) oracle 0x00 vs broken 0x01 (RAM diff at 0x${(ram.addr ?? 0).toString(16)})`);
});
