// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_1bf2 -- the SECOND direction-gate of the AIRBORNE update
 * (dec e ; jp nz,0x1c05 ; ld (ix+0x10),0xff ; ld (ix+0x11),0x80 ; res 7,(ix+0x07) ;
 * jp 0x1bd8). COLLAPSED to one m.step per branch total (gate-ON 14 t -> 0x1C05;
 * gate-OFF 80 t -> 0x1BD8). See optimized/entry_1bf2.js for the fold, the flag analysis,
 * the X-passthrough contract, and why the gate-OFF arm charges the not-taken jp nz as
 * 5 t (it matches the oracle, not textbook Z80).
 *
 * REACHABILITY + ATOMICITY (measured, not assumed). entry_1bf2 is dispatched from the
 * per-frame movement cascade under loc_197a (loc_197a -> entry_1ac3 -> loc_1bb2[airborne]
 * -> entry_1bf2). Probed over attract: 360 entries in 5000 frames (83 by frame 1200). It
 * is ATOMIC: every entry occurs with io.nmiMask CLEARED -- inside the vblank NMI (360/360
 * in-NMI, 0 out) where the handler cleared the mask so it cannot re-enter -- and ix is
 * 0x6200 at every entry (the three record writes are 0x62xx work RAM, no hardware latch).
 * So despite older "the loc_197a cascade is interruptible" docstrings, no NMI lands inside
 * THIS routine: an atomic collapse pushes no mistimed PC and tears no raster, and passes
 * the BYTE-EXACT whole-machine gate directly (confirmed below). The STRICT gate is the
 * right license -- NOT the convergent gate (which is for interruptible collapses whose
 * mistimed-NMI tear / dead-stack PC false-fail the strict gate).
 *
 * THE X-PASSTHROUGH is exercised explicitly. The whole-machine dispatch only ever passes
 * the live caller's X; so the unit + branch gates build an X closure over a CHOSEN ix and
 * (a) prove both arms thread it to the right callee and (b) on the gate-OFF arm prove the
 * three record writes land at X(0x10)/X(0x11)/X(0x07) -- including with a NON-0x6200 ix,
 * so a dropped/absolute-address X bug would diverge.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth;
 * UNIT EQUAL on the natural first entry (gate-ON arm) and its behavioural teeth;
 * FULL-BRANCH coverage of both arms from crafted entries (EQUAL over RAM+regs+pc+SP AND
 * each arm's exact cycle TOTAL -- the gate-OFF arm is not reached naturally in attract,
 * so it is synthesised); and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_1bf2 as translated_1bf2 } from "../../translated/state0.js";
import { entry_1bf2 as optimized_1bf2 } from "../entry_1bf2.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1bf2;
const FRAMES_WHOLE = 1200; // ~83 invocations (all gate-ON) by frame 1200
const FRAMES_UNIT = 1200;  // the unit host must run past the first dispatch

const RET_ADDR = 0x4d17;   // sentinel caller return address for the tail callee
const IX_BASE = 0x6200;    // the airborne record base X indexes (loc_1bb2's IX regime)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed entry_1bf2 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1bf2]]));
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

test("STRICT-TEETH (cycles): a wrong branch total forks the trajectory and is CAUGHT", () => {
  // The collapse's load-bearing invariant is total-cycle preservation. Shorting each arm
  // shifts the frame's cycle budget -> the spin count 0x6019 (PRNG entropy) and where a
  // later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m, X) => {
    const { regs, mem } = m;
    regs.e = regs.dec8(regs.e);
    if (regs.fNZ) { m.step(0x1c05, 9); return m.call(0x1c05, X); }   // 14 -> 9
    mem.write8(X(0x10), 0xff);
    mem.write8(X(0x11), 0x80);
    mem.write8(X(0x07), regs.res(7, mem.read8(X(0x07))));
    m.step(0x1bd8, 75); return m.call(0x1bd8, X);                    // 80 -> 75
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry: the gate-ON arm) -------------------------------

/** Capture the pristine machine the instant entry_1bf2 is first entered (via m.call,
 *  deep in the NMI movement cascade). The snapshot override is wired at CONSTRUCTION so
 *  it fires however the routine is reached, then delegates to the oracle. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm, X) => {
    if (entry === null) entry = mm.clone();
    return translated_1bf2(mm, X);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** The X helper the caller chain threads in (IX-relative addressing for the callees). */
function makeX(m) {
  return (off) => (m.regs.ix + off) & 0xffff;
}

/** Run oracle and `fn` on independent clones of `entry`; report the diff. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1bf2(a, makeX(a));
  fn(b, makeX(b));
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic entry_1bf2 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1bf2);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, E) + pc identical (natural gate-ON entry)");
});

test("TEETH (unit behavioural): routing the gate-ON arm to the WRONG callee is CAUGHT", () => {
  // The natural entry takes the gate-ON arm (E != 1 -> 0x1C05). A twin that instead hands
  // off to loc_1bd8 (the gate-OFF callee) -- a "wrong branch destination" bug -- runs a
  // different routine subtree and leaves different RAM/registers.
  //
  // WHY THIS, not a dropped E write-back: on the gate-ON arm entry_1bf2 writes NO memory
  // and E is consumed by the 0x1C05 subtree; the observable difference is WHICH tail
  // routine runs, so that is what the teeth perturb. (A wrong-X bug is separately caught
  // by the gate-OFF branch tests, where X drives the record writes.)
  const broken_wrongTarget = (m, X) => {
    const { regs } = m;
    regs.e = regs.dec8(regs.e);
    if (regs.fNZ) { m.step(0x1c05, 14); return m.call(0x1bd8, X); } // BUG: gate-ON -> 0x1bd8
    m.step(0x1bd8, 80); return m.call(0x1bd8, X);
  };
  const r = runBoth(NATURAL_ENTRY, broken_wrongTarget);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong tail destination -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "RAM diff at 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? "reg diff at " + r.regs.reg : "pc/sp diff"}`);
});

// -- FULL-BRANCH COVERAGE (crafted entries: both arms) -------------------------

/**
 * Fresh machine seeded with entry_1bf2's register contract: E (the 2nd gate value), IX
 * (the airborne record base X indexes), a pre-set byte at X(0x07) (bit 7 SET so `res 7`
 * is observable), and a valid SP with a sentinel return address for the tail callee. Both
 * tail callees (entry_1c05 / loc_1bd8) are stubbed to zero-cost no-ops so each arm's cycle
 * TOTAL is entry_1bf2's OWN charge alone, not the callee's. `ixBase` is a parameter so a
 * test can prove the writes truly track X by choosing a non-0x6200 base.
 */
function seed(e, ixBase = IX_BASE) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // entry_1bf2's caller frame (the tail callee's ret lands here)
  const entrySP = m.regs.sp;
  m.regs.e = e;
  m.regs.ix = ixBase;
  const X = (off) => (m.regs.ix + off) & 0xffff;
  m.mem.write8(X(0x07), 0xc5); // bit 7 set (+ low bits) so `res 7,(ix+0x07)` -> 0x45 is observable
  m.routines.set(0x1c05, () => {}); // isolate entry_1bf2's own cycles
  m.routines.set(0x1bd8, () => {});
  return { m, entrySP, X };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle total
 *  against the oracle and against the structural constant `expectCycles`. */
function assertArm(label, e, expectCycles, ixBase = IX_BASE) {
  const A = seed(e, ixBase);
  const B = seed(e, ixBase);
  const ca0 = A.m.cycles, cb0 = B.m.cycles;
  translated_1bf2(A.m, A.X);
  optimized_1bf2(B.m, B.X);
  const dA = A.m.cycles - ca0, dB = B.m.cycles - cb0;

  const ram = firstStateDiff(A.m.dumpState(), B.m.dumpState(), (off) => A.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(A.m.regs, B.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(A.m.pc, B.m.pc, "pc must match");
  assert.equal(A.m.regs.sp, B.m.regs.sp, "SP must match");
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${B.m.pc.toString(16)}, E=${B.m.regs.e}, ${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): gate-ON arm -- E!=1, jp nz taken -> entry_1c05 (4+10 = 14 t)", () => {
  // e=2 -> dec to 1 (NZ). This is the naturally-reached arm; no record write.
  assertArm("gate-ON", 2, 14);
  const { m, X } = seed(2);
  optimized_1bf2(m, X);
  assert.equal(m.pc, 0x1c05, "gate-ON arm transfers to the 0x1C05 dispatch");
  assert.equal(m.regs.e, 1, "gate-ON arm decremented E to 1");
  assert.equal(m.mem.read8(X(0x07)), 0xc5, "gate-ON arm writes NO record field (X(0x07) untouched)");
});

test("BRANCH (unit): gate-OFF arm -- E==1 -> 3 record writes + loc_1bd8 (4+5+19+19+23+10 = 80 t)", () => {
  // SYNTHESISED: the E==1 arm is never reached naturally in attract. e=1 -> dec to 0 (Z).
  assertArm("gate-OFF", 1, 80);
  const { m, X } = seed(1);
  optimized_1bf2(m, X);
  assert.equal(m.pc, 0x1bd8, "gate-OFF arm transfers to the landing/gravity routine 0x1BD8");
  assert.equal(m.regs.e, 0, "gate-OFF arm decremented E to 0");
  assert.equal(m.mem.read8(X(0x10)), 0xff, "gate-OFF arm sets (ix+0x10) = 0xff");
  assert.equal(m.mem.read8(X(0x11)), 0x80, "gate-OFF arm sets (ix+0x11) = 0x80");
  assert.equal(m.mem.read8(X(0x07)), 0x45, "gate-OFF arm clears bit 7 of (ix+0x07): 0xC5 -> 0x45");
});

test("BRANCH (unit): gate-OFF record writes TRACK X (non-0x6200 ix) -- X-passthrough proof", () => {
  // Prove the three writes follow X, not a hardcoded 0x62xx: seed a DIFFERENT ix (0x6300)
  // and confirm the writes land at 0x6310/0x6311/0x6307 and the arm is still EQUAL + 80 t.
  const ALT = 0x6300;
  assertArm("gate-OFF@0x6300", 1, 80, ALT);
  const { m, X } = seed(1, ALT);
  optimized_1bf2(m, X);
  assert.equal(m.pc, 0x1bd8, "gate-OFF@alt still transfers to 0x1BD8");
  assert.equal(m.mem.read8(0x6310), 0xff, "write followed X: (0x6300+0x10) = 0xff");
  assert.equal(m.mem.read8(0x6311), 0x80, "write followed X: (0x6300+0x11) = 0x80");
  assert.equal(m.mem.read8(0x6307), 0x45, "write followed X: (0x6300+0x07) bit7 cleared -> 0x45");
  assert.equal(m.mem.read8(0x6210), 0x00, "the 0x6200 record was NOT touched (X was not hardcoded)");
});

test("BRANCH-TEETH (cycles): a dropped charge on the gate-OFF arm yields a wrong total and is CAUGHT", () => {
  // Gate-OFF arm charged 75 instead of 80 -> total no longer matches the oracle.
  const dropped = (m, X) => {
    const { regs, mem } = m;
    regs.e = regs.dec8(regs.e);
    if (regs.fNZ) { m.step(0x1c05, 14); return m.call(0x1c05, X); }
    mem.write8(X(0x10), 0xff);
    mem.write8(X(0x11), 0x80);
    mem.write8(X(0x07), regs.res(7, mem.read8(X(0x07))));
    m.step(0x1bd8, 75); return m.call(0x1bd8, X); // DROPPED: 80 -> 75
  };
  const a = seed(1);
  const b = seed(1);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1bf2(a.m, a.X);
  dropped(b.m, b.X);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
