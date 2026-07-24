// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1c8f -- the RIGHTWARD walk-step handler (ld b,0x01 ;
 * ld a,(0x620f) ; and a ; jp nz,0x1cd2 ; ld a,(0x6202) ; ld b,a ; ld a,0x05 ;
 * call 0x3009 ; ld (0x6202),a ; and 0x03 ; or 0x80 ; jp 0x1cc2). COLLAPSED to one
 * m.step per basic block with the mid-body `call 0x3009` kept verbatim as a boundary:
 * arm A (timer running) 34 t -> 0x1CD2; arm B pre-call 58 t -> PC 0x1C9E, call 17 t,
 * post-call 37 t -> 0x1CC2. See optimized/loc_1c8f.js for the fold and the flag analysis.
 *
 * REACHABILITY + ATOMICITY (measured here, not assumed -- see the ATOMICITY test below).
 * loc_1c8f is tail-called from loc_1ae6's move arm, inside the per-frame movement cascade
 * under loc_197a (entry_1ac3 -> loc_1ae6 -> loc_1c8f). Over 900 attract frames: 209
 * entries (first ~frame 633), BOTH arms reached -- arm A 139x, arm B 70x. It is ATOMIC:
 * every entry occurs with io.nmiMask CLEARED (inside the vblank NMI, mask zeroed so it
 * cannot re-enter; 209/209 in-NMI), and the NMI's pushed PC never lands in [0x1C8F,0x1CAB)
 * (0/894 NMIs). So the STRICT byte-exact whole-machine gate is the right license, NOT the
 * convergent gate.
 *
 * Jobs: an explicit ATOMICITY measurement; WHOLE-MACHINE strict EQUAL (+ invocation proof)
 * and its cycle-total teeth; UNIT EQUAL on the natural first entry and its behavioural
 * teeth; FULL-BRANCH coverage of both arms from crafted entries (EQUAL over RAM+regs+pc+SP
 * AND each arm's exact cycle TOTAL, callees stubbed to isolate loc_1c8f's OWN cycles); and
 * a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1c8f as translated_1c8f } from "../../translated/state0.js";
import { loc_1c8f as optimized_1c8f } from "../loc_1c8f.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1c8f;
const RANGE = [0x1c8f, 0x1cab]; // [lo, hi) the routine's own ROM span, for NMI-landing checks
const FRAMES_WHOLE = 900; // past the ~f633 first dispatch, ~200 invocations, both arms
const FRAMES_UNIT = 900; // the unit host must run past the first dispatch (~f633)

const RET_ADDR = 0x4d17; // sentinel caller return address for the tail callee's ret
const MOVE_TIMER = 0x620f; // MARIO_MOVE_STEP_TIMER -- the arm fork
const WALK_ANIM = 0x6202; // MARIO_WALK_ANIM -- rewritten on arm B

// -- ATOMICITY (measured -- this is what licenses the STRICT gate) -------------

test("ATOMICITY: every loc_1c8f dispatch runs mask-cleared and no NMI lands inside it", () => {
  // Snapshot override records io.nmiMask at each entry (and which arm), then delegates to
  // the oracle so the game proceeds. fireNmi is wrapped to record every pushed PC and flag
  // any that lands in the routine's own ROM span -- a mid-routine interrupt.
  const masks = [];
  const arm = { A: 0, B: 0 };
  const snap = new Map([[TARGET, (mm) => {
    masks.push(mm.io.nmiMask);
    if (mm.mem.read8(MOVE_TIMER) !== 0) arm.A++; else arm.B++;
    return translated_1c8f(mm);
  }]]);
  const m = new Machine(ROM, { overrides: snap });
  const pushedInRange = [];
  let nmis = 0;
  const origFireNmi = m.fireNmi.bind(m);
  m.fireNmi = function () {
    nmis++;
    if (this.pcKnown && this.pc >= RANGE[0] && this.pc < RANGE[1]) pushedInRange.push(this.pc);
    return origFireNmi();
  };
  m.runFrames(FRAMES_WHOLE);

  assert.ok(masks.length >= 1, "loc_1c8f was never dispatched -- widen the window");
  assert.ok(masks.every((v) => v === 0), `io.nmiMask must be 0 at every dispatch (saw ${[...new Set(masks)]})`);
  assert.equal(pushedInRange.length, 0, `an NMI pushed a PC inside [0x1c8f,0x1cab): ${pushedInRange.map((p) => "0x" + p.toString(16))}`);
  console.log(`  ATOMICITY: ${masks.length} dispatches (arm A ${arm.A}, arm B ${arm.B}), all mask-cleared; 0/${nmis} NMIs landed inside -> STRICT licensed`);
});

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed loc_1c8f is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1c8f]]));
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
  // The collapse's load-bearing invariant is total-cycle preservation. Shorting each arm by
  // 5 t shifts the frame's cycle budget -> the spin count 0x6019 (PRNG entropy) and where a
  // later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.b = 0x01;
    regs.a = mem.read8(MOVE_TIMER);
    regs.and(regs.a);
    if (regs.fNZ) { m.step(0x1cd2, 29); return m.call(0x1cd2); } // 34 -> 29
    regs.a = mem.read8(WALK_ANIM);
    regs.b = regs.a;
    regs.a = 0x05;
    m.step(0x1c9e, 53); // 58 -> 53
    m.push16(0x1ca1); m.step(0x3009, 17); m.call(0x3009);
    mem.write8(WALK_ANIM, regs.a);
    regs.and(0x03); regs.or(0x80);
    m.step(0x1cc2, 32); // 37 -> 32
    return m.call(0x1cc2);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) ------------------------------------------------

/** Capture the pristine machine the instant loc_1c8f is first entered (via m.call, deep
 *  in the NMI movement cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1c8f(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff. The tail callees
 *  (loc_1cd2 / entry_3009 / loc_1cc2) resolve to the ORACLE on both clones, so this compares
 *  the full downstream effect of the arm the natural entry took. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1c8f(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_1c8f matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1c8f);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical (natural entry, through the tail chain)");
});

test("TEETH (unit behavioural): routing the natural arm to the WRONG handler is CAUGHT", () => {
  // A twin that swaps the two tail destinations -- arm A -> loc_1cc2, arm B -> loc_1cd2 --
  // runs a different tail routine, diverging the whole downstream trace. loc_1cd2 (apply
  // move) and loc_1cc2 (sprite/sound tail) do very different things, so either mis-route is
  // observable in RAM/registers/pc/SP.
  const broken_wrongTarget = (m) => {
    const { regs, mem } = m;
    regs.b = 0x01;
    regs.a = mem.read8(MOVE_TIMER);
    regs.and(regs.a);
    if (regs.fNZ) { m.step(0x1cc2, 34); return m.call(0x1cc2); } // BUG: arm A -> loc_1cc2, not loc_1cd2
    regs.a = mem.read8(WALK_ANIM);
    regs.b = regs.a;
    regs.a = 0x05;
    m.step(0x1c9e, 58);
    m.push16(0x1ca1); m.step(0x3009, 17); m.call(0x3009);
    mem.write8(WALK_ANIM, regs.a);
    regs.and(0x03); regs.or(0x80);
    m.step(0x1cd2, 37); return m.call(0x1cd2); // BUG: arm B -> loc_1cd2, not loc_1cc2
  };
  const r = runBoth(NATURAL_ENTRY, broken_wrongTarget);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong tail destination -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "RAM diff at 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? "reg diff at " + r.regs.reg : "pc/sp diff"}`);
});

// -- FULL-BRANCH COVERAGE (crafted entries: both arms) -------------------------

/**
 * Fresh machine seeded to reach one arm deterministically. The three callees
 * (loc_1cd2 arm-A tail, entry_3009 mid-body, loc_1cc2 arm-B tail) are recording ZERO-cost
 * stubs, so each arm's cycle TOTAL is loc_1c8f's OWN charge alone and the stub captures
 * which tail was taken. entry_3009 leaves A as-is (0x05), so the arm-B post-call path is
 * deterministic and identical on both sides.
 */
function seed(timer, anim) {
  const captured = { who: null };
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // loc_1c8f's caller frame (the tail callee's ret lands here)
  const entrySP = m.regs.sp;
  m.mem.write8(MOVE_TIMER, timer); // the arm fork
  m.mem.write8(WALK_ANIM, anim); // arm-B subject
  m.regs.a = 0xa5; // arbitrary -- overwritten by the routine
  m.regs.b = 0x77; // arbitrary -- overwritten by ld b,0x01
  m.routines.set(0x1cd2, () => { captured.who = 0x1cd2; }); // arm-A tail: no-op, 0 t
  m.routines.set(0x3009, () => { captured.who = 0x3009; }); // mid-body: no-op, leaves A=0x05, 0 t
  m.routines.set(0x1cc2, () => { captured.who = 0x1cc2; }); // arm-B tail: no-op, 0 t
  return { m, entrySP, captured };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total against the oracle and against the structural constant `expectCycles`. */
function assertArm(label, timer, anim, expectCycles) {
  const A = seed(timer, anim);
  const B = seed(timer, anim);
  const ca0 = A.m.cycles, cb0 = B.m.cycles;
  translated_1c8f(A.m);
  optimized_1c8f(B.m);
  const dA = A.m.cycles - ca0, dB = B.m.cycles - cb0;

  const ram = firstStateDiff(A.m.dumpState(), B.m.dumpState(), (off) => A.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(A.m.regs, B.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(A.m.pc, B.m.pc, "pc must match");
  assert.equal(A.m.regs.sp, B.m.regs.sp, "SP must match");
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${B.m.pc.toString(16)}, tail=0x${(B.captured.who ?? 0).toString(16)}, ${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): arm A -- timer!=0, jp nz taken -> loc_1cd2 (7+13+4+10 = 34 t)", () => {
  assertArm("armA", 0x05, 0x00, 34);
  const { m, captured } = seed(0x05, 0x00);
  optimized_1c8f(m);
  assert.equal(m.pc, 0x1cd2, "arm A transfers to the apply-move handler 0x1CD2");
  assert.equal(captured.who, 0x1cd2, "arm A tails loc_1cd2");
  assert.equal(m.regs.b, 0x01, "arm A leaves B = +1 (the X delta loc_1cd2 consumes)");
});

test("BRANCH (unit): arm B -- timer==0, new step -> call 0x3009 -> loc_1cc2 (58+17+37 = 112 t)", () => {
  assertArm("armB", 0x00, 0x02, 112);
  const { m, captured } = seed(0x00, 0x02);
  optimized_1c8f(m);
  assert.equal(m.pc, 0x1cc2, "arm B transfers to the shared move tail 0x1CC2");
  assert.equal(captured.who, 0x1cc2, "arm B tails loc_1cc2");
  assert.equal(m.mem.read8(WALK_ANIM), 0x05, "arm B stores entry_3009's result (stub leaves A=0x05) to 0x6202");
  assert.equal(m.regs.a, 0x81, "arm B leaves A = (0x05 & 0x03) | 0x80 = 0x81 (facing-right bit set)");
});

test("BRANCH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // Arm B post-call block charged 32 instead of 37 -> total no longer matches the oracle.
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.b = 0x01;
    regs.a = mem.read8(MOVE_TIMER);
    regs.and(regs.a);
    if (regs.fNZ) { m.step(0x1cd2, 34); return m.call(0x1cd2); }
    regs.a = mem.read8(WALK_ANIM);
    regs.b = regs.a;
    regs.a = 0x05;
    m.step(0x1c9e, 58);
    m.push16(0x1ca1); m.step(0x3009, 17); m.call(0x3009);
    mem.write8(WALK_ANIM, regs.a);
    regs.and(0x03); regs.or(0x80);
    m.step(0x1cc2, 32); return m.call(0x1cc2); // DROPPED: 37 -> 32
  };
  const a = seed(0x00, 0x02);
  const b = seed(0x00, 0x02);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1c8f(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
