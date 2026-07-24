// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1af5 -- the SECOND direction-gate of the walk/climb
 * direction pick (dec d ; jp z,0x1afe ; bit 1,a ; jp nz,0x1cab ; fall to loc_1afe).
 * COLLAPSED to one m.step per branch total (gate-off 14 t -> 0x1AFE; move 36 t ->
 * 0x1CAB; fall-through 26 t -> 0x1AFB). See optimized/loc_1af5.js for the fold, the
 * flag analysis, and why the fall-through arm rests PC at 0x1AFB with no jp-nz charge
 * (it matches the oracle, not textbook Z80).
 *
 * REACHABILITY + ATOMICITY (measured, not assumed). loc_1af5 is dispatched from the
 * per-frame movement cascade under loc_197a (entry_1ac3 -> loc_1ae6 -> loc_1af5).
 * Probed over 1400 attract frames: 287 entries, first at frame 842. It is ATOMIC:
 * every one of the 287 entries occurs with io.nmiMask CLEARED -- inside the vblank NMI
 * (287/287 in-NMI, 0 out) where the handler cleared the mask so it cannot re-enter --
 * and the NMI's pushed PC never lands in [0x1AF5,0x1AFE) (0 landings; all land in the
 * 0x02BD-0x0372 main-loop band). So despite older "the loc_197a cascade is
 * interruptible" docstrings, no NMI lands inside THIS routine: an atomic collapse
 * pushes no mistimed PC and tears no raster, and passes the BYTE-EXACT whole-machine
 * gate directly (confirmed below: EQUAL over a 200+-invocation window). The STRICT
 * gate is the right license -- NOT the convergent gate (which is for interruptible
 * collapses whose mistimed-NMI tear / dead-stack PC false-fail the strict gate).
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth;
 * UNIT EQUAL on the natural first entry (fall-through arm) and its behavioural teeth;
 * FULL-BRANCH coverage of all three arms from crafted entries (EQUAL over
 * RAM+regs+pc+SP AND each arm's exact cycle TOTAL -- the gate-off arm is not reached
 * naturally in attract, so it is synthesised); and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1af5 as translated_1af5 } from "../../translated/state0.js";
import { loc_1af5 as optimized_1af5 } from "../loc_1af5.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1af5;
const FRAMES_WHOLE = 1100; // past the ~f842 first dispatch, ~205 invocations
const FRAMES_UNIT = 900;   // the unit host must run past the first dispatch (~f842)

const RET_ADDR = 0x4d17;   // sentinel caller return address for the tail callee
const IX_BASE = 0x6200;    // the player-record base R indexes (entry_1ac3's IX regime)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed loc_1af5 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1af5]]));
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
  // The collapse's load-bearing invariant is total-cycle preservation. Shorting every
  // arm by 5 t shifts the frame's cycle budget -> the spin count 0x6019 (PRNG entropy)
  // and where a later NMI's pushed PC lands -> the byte-exact trace diverges (measured
  // at the stack byte 0x6be4, the NMI-landing channel).
  const cyclebroken = (m, R) => {
    const { regs } = m;
    regs.d = regs.dec8(regs.d);
    if (regs.fZ) { m.step(0x1afe, 9); return m.call(0x1afe, R); }   // 14 -> 9
    regs.bit(1, regs.a);
    if (regs.fNZ) { m.step(0x1cab, 31); return m.call(0x1cab); }    // 36 -> 31
    m.step(0x1afb, 21); return m.call(0x1afe, R);                    // 26 -> 21
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry: the fall-through arm) --------------------------

/** Capture the pristine machine the instant loc_1af5 is first entered (via m.call,
 *  deep in the NMI movement cascade). The snapshot override is wired at CONSTRUCTION
 *  so it fires however the routine is reached, then delegates to the oracle. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm, R) => {
    if (entry === null) entry = mm.clone();
    return translated_1af5(mm, R);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** The R helper the caller chain threads in (IX-relative addressing for loc_1afe). */
function makeR(m) {
  return (off) => (m.regs.ix + off) & 0xffff;
}

/** Run oracle and `fn` on independent clones of `entry`; report the diff. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1af5(a, makeR(a));
  fn(b, makeR(b));
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_1af5 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1af5);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, D) + pc identical (natural fall-through entry)");
});

test("TEETH (unit behavioural): routing the fall-through to the WRONG handler is CAUGHT", () => {
  // The natural entry takes the fall-through arm (input bit 1 clear -> loc_1afe). A twin
  // that instead hands off to the MOVE handler (loc_1cab) -- a "wrong branch destination"
  // bug -- runs a different routine and leaves different RAM/registers.
  //
  // WHY THIS, not a dropped D write-back: on the fall-through, loc_1afe RE-READS its
  // inputs from RAM and clobbers A and D itself (ld a,(0x6217) ; ... ; ld d,a), so
  // loc_1af5's register outputs are all DEAD -- a wrong D value would not survive. The
  // observable difference on this path is WHICH tail routine runs, so that is what the
  // teeth perturb.
  const broken_wrongTarget = (m, R) => {
    const { regs } = m;
    regs.d = regs.dec8(regs.d);
    if (regs.fZ) { m.step(0x1afe, 14); return m.call(0x1afe, R); }
    regs.bit(1, regs.a);
    if (regs.fNZ) { m.step(0x1cab, 36); return m.call(0x1cab); }
    m.step(0x1afb, 26); return m.call(0x1cab); // BUG: fall-through -> 0x1cab, not loc_1afe
  };
  const r = runBoth(NATURAL_ENTRY, broken_wrongTarget);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong tail destination -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "RAM diff at 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? "reg diff at " + r.regs.reg : "pc/sp diff"}`);
});

// -- FULL-BRANCH COVERAGE (crafted entries: all three arms) --------------------

/**
 * Fresh machine seeded with loc_1af5's register contract: D (the 2nd gate value),
 * A (player input), IX (the player-record base R indexes), and a valid SP with a
 * sentinel return address for the tail callee. The two tail callees (loc_1afe /
 * loc_1cab) are stubbed to zero-cost no-ops so each arm's cycle TOTAL is loc_1af5's
 * OWN charge alone, not the callee's.
 */
function seed(d, a) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // loc_1af5's caller frame (the tail callee's ret lands here)
  const entrySP = m.regs.sp;
  m.regs.d = d;
  m.regs.a = a;
  m.regs.ix = IX_BASE;
  m.routines.set(0x1afe, () => {}); // isolate loc_1af5's own cycles
  m.routines.set(0x1cab, () => {});
  return { m, entrySP, R: makeR(m) };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total against the oracle and against the structural constant `expectCycles`. */
function assertArm(label, d, a, expectCycles) {
  const A = seed(d, a);
  const B = seed(d, a);
  const ca0 = A.m.cycles, cb0 = B.m.cycles;
  translated_1af5(A.m, A.R);
  optimized_1af5(B.m, B.R);
  const dA = A.m.cycles - ca0, dB = B.m.cycles - cb0;

  const ram = firstStateDiff(A.m.dumpState(), B.m.dumpState(), (off) => A.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(A.m.regs, B.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(A.m.pc, B.m.pc, "pc must match");
  assert.equal(A.m.regs.sp, B.m.regs.sp, "SP must match");
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${B.m.pc.toString(16)}, D=${B.m.regs.d}, ${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): gate-off arm -- D==1, jp z taken -> loc_1afe (4+10 = 14 t)", () => {
  // SYNTHESISED: the D==1 arm is never reached naturally in attract. d=1 -> dec to 0 (Z).
  assertArm("gate-off", 1, 0x00, 14);
  const { m } = seed(1, 0x00);
  optimized_1af5(m, makeR(m));
  assert.equal(m.pc, 0x1afe, "gate-off arm transfers to the climb-collision spine 0x1AFE");
  assert.equal(m.regs.d, 0, "gate-off arm decremented D to 0");
});

test("BRANCH (unit): move arm -- D!=1 & input bit1 set -> loc_1cab (4+10+12+10 = 36 t)", () => {
  assertArm("move", 2, 0x02, 36);
  const { m } = seed(2, 0x02);
  optimized_1af5(m, makeR(m));
  assert.equal(m.pc, 0x1cab, "move arm transfers to the movement handler 0x1CAB");
  assert.equal(m.regs.d, 1, "move arm decremented D to 1");
});

test("BRANCH (unit): fall-through arm -- D!=1 & input bit1 clear -> loc_1afe (4+10+12 = 26 t, PC 0x1AFB)", () => {
  assertArm("fall-through", 2, 0x00, 26);
  const { m } = seed(2, 0x00);
  optimized_1af5(m, makeR(m));
  assert.equal(m.pc, 0x1afb, "fall-through arm rests PC at 0x1AFB (matches the oracle, no jp-nz charge)");
  assert.equal(m.regs.d, 1, "fall-through arm decremented D to 1");
});

test("BRANCH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // Fall-through arm charged 21 instead of 26 -> total no longer matches the oracle.
  const dropped = (m, R) => {
    const { regs } = m;
    regs.d = regs.dec8(regs.d);
    if (regs.fZ) { m.step(0x1afe, 14); return m.call(0x1afe, R); }
    regs.bit(1, regs.a);
    if (regs.fNZ) { m.step(0x1cab, 36); return m.call(0x1cab); }
    m.step(0x1afb, 21); return m.call(0x1afe, R); // DROPPED: 26 -> 21
  };
  const a = seed(2, 0x00);
  const b = seed(2, 0x00);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1af5(a.m, a.R);
  dropped(b.m, b.R);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
