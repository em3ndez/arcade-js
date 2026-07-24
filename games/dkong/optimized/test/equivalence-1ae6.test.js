// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1ae6 -- the FIRST direction-gate of the walk/climb
 * direction pick (call 0x241f ; ld a,(0x6010) ; dec e ; jp z,0x1af5 ; bit 0,a ;
 * jp nz,0x1c8f ; fall to loc_1af5).  COLLAPSED to one m.step per branch total, with
 * the mid-body `call 0x241f` kept verbatim as a boundary: gate-off 44 t -> 0x1AF5;
 * move 66 t -> 0x1C8F; fall-through 56 t -> 0x1AF2. See optimized/loc_1ae6.js for the
 * fold, the flag analysis, the R-passthrough contract, and why the fall-through arm
 * rests PC at 0x1AF2 with no jp-nz charge (it matches the oracle, not textbook Z80).
 *
 * REACHABILITY + ATOMICITY (measured, not assumed). loc_1ae6 is dispatched from the
 * per-frame movement cascade under loc_197a (entry_1ac3 -> loc_1ae6). Probed over 1400
 * attract frames: 622 entries, first ~frame 626. It is ATOMIC: every one of the 622
 * entries occurs with io.nmiMask CLEARED -- inside the vblank NMI (622/622 in-NMI, 0
 * out) where the handler cleared the mask so it cannot re-enter -- and the NMI's pushed
 * PC never lands in [0x1AE6,0x1AF5) (0 landings over 1394 NMIs; all land in the
 * 0x02BD-0x0372 main-loop band). So despite older "the loc_197a cascade is
 * interruptible" docstrings, no NMI lands inside THIS routine: an atomic collapse pushes
 * no mistimed PC and tears no raster, and passes the BYTE-EXACT whole-machine gate
 * directly. The STRICT gate is the right license -- NOT the convergent gate.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth;
 * UNIT EQUAL on the natural first entry and its behavioural teeth; FULL-BRANCH coverage
 * of all three arms from crafted entries (EQUAL over RAM+regs+pc+SP AND each arm's exact
 * cycle TOTAL -- the gate-off arm is not reached naturally in attract, so it is
 * synthesised); an explicit R-PASSTHROUGH check (R threaded to loc_1af5 on arms A/C,
 * NOT to loc_1c8f on arm B); and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1ae6 as translated_1ae6 } from "../../translated/state0.js";
import { loc_1ae6 as optimized_1ae6 } from "../loc_1ae6.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1ae6;
const FRAMES_WHOLE = 900;  // past the ~f626 first dispatch, ~400+ invocations
const FRAMES_UNIT = 800;   // the unit host must run past the first dispatch (~f626)

const RET_ADDR = 0x4d17;   // sentinel caller return address for the tail callee
const IX_BASE = 0x6200;    // the player-record base R indexes (entry_1ac3's IX regime)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed loc_1ae6 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1ae6]]));
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
  // and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m, R) => {
    const { regs, mem } = m;
    m.push16(0x1ae9); m.step(0x241f, 17); m.call(0x241f);
    regs.a = mem.read8(0x6010);
    regs.e = regs.dec8(regs.e);
    if (regs.fZ) { m.step(0x1af5, 22); return m.call(0x1af5, R); }   // 27 -> 22
    regs.bit(0, regs.a);
    if (regs.fNZ) { m.step(0x1c8f, 44); return m.call(0x1c8f); }     // 49 -> 44
    m.step(0x1af2, 34); return m.call(0x1af5, R);                     // 39 -> 34
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) ------------------------------------------------

/** Capture the pristine machine the instant loc_1ae6 is first entered (via m.call,
 *  deep in the NMI movement cascade). The snapshot override is wired at CONSTRUCTION
 *  so it fires however the routine is reached, then delegates to the oracle. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm, R) => {
    if (entry === null) entry = mm.clone();
    return translated_1ae6(mm, R);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** The R helper the caller chain threads in (IX-relative addressing for loc_1af5). */
function makeR(m) {
  return (off) => (m.regs.ix + off) & 0xffff;
}

/** Run oracle and `fn` on independent clones of `entry`; report the diff. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1ae6(a, makeR(a));
  fn(b, makeR(b));
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_1ae6 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1ae6);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, E) + pc identical (natural entry, through call 0x241f)");
});

test("TEETH (unit behavioural): routing the natural arm to the WRONG handler is CAUGHT", () => {
  // A twin that hands the move/fall arm off to the OTHER destination -- a "wrong branch
  // destination" bug -- runs a different tail routine, diverging the whole downstream
  // trace (RAM/registers/pc/SP). loc_1c8f (+dir) and loc_1af5 (2nd-dir gate) do very
  // different things, so mis-routing either arm is observable.
  const broken_wrongTarget = (m, R) => {
    const { regs, mem } = m;
    m.push16(0x1ae9); m.step(0x241f, 17); m.call(0x241f);
    regs.a = mem.read8(0x6010);
    regs.e = regs.dec8(regs.e);
    if (regs.fZ) { m.step(0x1af5, 27); return m.call(0x1af5, R); }
    regs.bit(0, regs.a);
    if (regs.fNZ) { m.step(0x1c8f, 49); return m.call(0x1af5, R); } // BUG: move -> loc_1af5, not loc_1c8f
    m.step(0x1af2, 39); return m.call(0x1c8f);                       // BUG: fall -> loc_1c8f, not loc_1af5
  };
  const r = runBoth(NATURAL_ENTRY, broken_wrongTarget);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong tail destination -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "RAM diff at 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? "reg diff at " + r.regs.reg : "pc/sp diff"}`);
});

// -- FULL-BRANCH COVERAGE (crafted entries: all three arms) --------------------

/**
 * Fresh machine seeded with loc_1ae6's contract: the E-gate reaches the routine via
 * sub_241f's return, so 0x241f is STUBBED to a zero-cost no-op that leaves the seeded
 * (D,E) in place -- isolating loc_1ae6's OWN cycles from sub_241f's. A is loaded by the
 * routine from 0x6010, so the input is poked into RAM there, not into regs.a. The two
 * tail callees (loc_1af5 / loc_1c8f) are recording zero-cost stubs, so each arm's cycle
 * TOTAL is loc_1ae6's OWN charge alone, and the stub captures the forwarded R.
 */
function seed(e, input) {
  const captured = { who: null, r: "unset" };
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // loc_1ae6's caller frame (the tail callee's ret lands here)
  const entrySP = m.regs.sp;
  m.regs.e = e;
  m.regs.d = 0x42;    // arbitrary sentinel -- loc_1ae6 never reads D, only passes it on
  m.regs.a = 0xa5;    // arbitrary -- overwritten by ld a,(0x6010)
  m.regs.ix = IX_BASE;
  m.mem.write8(0x6010, input); // loc_1ae6 loads A from here (P1_INPUT)
  m.routines.set(0x241f, () => {});                       // position gate: no-op, (D,E) stay seeded
  m.routines.set(0x1af5, (mm, r) => { captured.who = 0x1af5; captured.r = r; });
  m.routines.set(0x1c8f, (mm, r) => { captured.who = 0x1c8f; captured.r = r; });
  return { m, entrySP, R: makeR(m), captured };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total against the oracle and against the structural constant `expectCycles`. */
function assertArm(label, e, input, expectCycles) {
  const A = seed(e, input);
  const B = seed(e, input);
  const ca0 = A.m.cycles, cb0 = B.m.cycles;
  translated_1ae6(A.m, A.R);
  optimized_1ae6(B.m, B.R);
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

test("BRANCH (unit): gate-off arm -- E==1, jp z taken -> loc_1af5 (17+13+4+10 = 44 t)", () => {
  // SYNTHESISED: the E==1 arm (sub_241f's far-right-edge (0,1)) is never reached in attract.
  assertArm("gate-off", 1, 0x00, 44);
  const { m, R } = seed(1, 0x00);
  optimized_1ae6(m, R);
  assert.equal(m.pc, 0x1af5, "gate-off arm transfers to the second-direction gate 0x1AF5");
  assert.equal(m.regs.e, 0, "gate-off arm decremented E to 0");
});

test("BRANCH (unit): move arm -- E!=1 & input bit0 set -> loc_1c8f (17+13+4+10+12+10 = 66 t)", () => {
  assertArm("move", 2, 0x01, 66);
  const { m, R } = seed(2, 0x01);
  optimized_1ae6(m, R);
  assert.equal(m.pc, 0x1c8f, "move arm transfers to the movement handler 0x1C8F");
  assert.equal(m.regs.e, 1, "move arm decremented E to 1");
});

test("BRANCH (unit): fall-through arm -- E!=1 & input bit0 clear -> loc_1af5 (17+13+4+10+12 = 56 t, PC 0x1AF2)", () => {
  assertArm("fall-through", 2, 0x00, 56);
  const { m, R } = seed(2, 0x00);
  optimized_1ae6(m, R);
  assert.equal(m.pc, 0x1af2, "fall-through arm rests PC at 0x1AF2 (matches the oracle, no jp-nz charge)");
  assert.equal(m.regs.e, 1, "fall-through arm decremented E to 1");
});

test("R-PASSTHROUGH: R is threaded to loc_1af5 (arms A,C) and NOT to loc_1c8f (arm B)", () => {
  // The one non-obvious correctness point: R must reach loc_1af5 unchanged on the two
  // arms that continue into it, and must NOT be forwarded to loc_1c8f. The recording
  // stubs capture exactly what each tail callee received; assert both, for BOTH the
  // oracle and the optimized routine, so a divergence in threading is caught either way.
  for (const [name, fn] of [["oracle", translated_1ae6], ["optimized", optimized_1ae6]]) {
    const gate = seed(1, 0x00);   // arm A -> loc_1af5
    fn(gate.m, gate.R);
    assert.equal(gate.captured.who, 0x1af5, `${name}: gate-off must tail loc_1af5`);
    assert.equal(gate.captured.r, gate.R, `${name}: gate-off must forward the SAME R to loc_1af5`);

    const fall = seed(2, 0x00);   // arm C -> loc_1af5
    fn(fall.m, fall.R);
    assert.equal(fall.captured.who, 0x1af5, `${name}: fall-through must tail loc_1af5`);
    assert.equal(fall.captured.r, fall.R, `${name}: fall-through must forward the SAME R to loc_1af5`);

    const move = seed(2, 0x01);   // arm B -> loc_1c8f, no R
    fn(move.m, move.R);
    assert.equal(move.captured.who, 0x1c8f, `${name}: move must tail loc_1c8f`);
    assert.equal(move.captured.r, undefined, `${name}: move must NOT forward R to loc_1c8f`);
  }
  console.log("  R-PASSTHROUGH: R -> loc_1af5 on arms A/C, absent on arm B -- oracle and optimized agree");
});

test("BRANCH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // Fall-through arm charged 34 instead of 39 -> total no longer matches the oracle.
  const dropped = (m, R) => {
    const { regs, mem } = m;
    m.push16(0x1ae9); m.step(0x241f, 17); m.call(0x241f);
    regs.a = mem.read8(0x6010);
    regs.e = regs.dec8(regs.e);
    if (regs.fZ) { m.step(0x1af5, 27); return m.call(0x1af5, R); }
    regs.bit(0, regs.a);
    if (regs.fNZ) { m.step(0x1c8f, 49); return m.call(0x1c8f); }
    m.step(0x1af2, 34); return m.call(0x1af5, R); // DROPPED: 39 -> 34
  };
  const a = seed(2, 0x00);
  const b = seed(2, 0x00);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1ae6(a.m, a.R);
  dropped(b.m, b.R);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
