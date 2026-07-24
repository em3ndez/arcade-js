// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1cc2 -- the SHARED WALK TAIL (ld hl,0x6207 ; ld (hl),a ;
 * rra ; call c,0x1d8f ; ld a,0x02 ; ld (0x620f),a ; jp 0x1da6) that loc_1c8f/loc_1cab
 * tail-jump into on their "begin a new step" arm. COLLAPSED to one m.step per basic
 * block with the conditional `call c,0x1d8f` kept verbatim as a boundary:
 *   BB0 21 t -> PC 0x1CC7; call c TAKEN 17 t (push 0x1CCA) / NOT taken 10 t; BB2 30 t
 *   -> PC 0x1DA6. Own per-arm totals: carry SET (footstep) 68 t, carry CLEAR 61 t.
 * See optimized/loc_1cc2.js for the fold and the flag analysis.
 *
 * REACHABILITY + ATOMICITY (measured here, not assumed -- see the ATOMICITY test below).
 * loc_1cc2 is reached from loc_1c8f/loc_1cab's new-step arm, inside the per-frame movement
 * cascade under loc_197a (entry_1ac3 -> loc_1ae6 -> loc_1c8f/loc_1cab -> loc_1cc2). Over
 * 900 attract frames: 70 entries (first ~frame 634), BOTH arms reached -- carry set 17x,
 * carry clear 53x. It is ATOMIC: every entry occurs with io.nmiMask CLEARED (inside the
 * vblank NMI, mask zeroed so it cannot re-enter; 70/70 in-NMI), and the NMI's pushed PC
 * never lands in [0x1CC2,0x1CD2) (0/894 NMIs). So the STRICT byte-exact whole-machine
 * gate is the right license, NOT the convergent gate.
 *
 * Jobs: an explicit ATOMICITY measurement; WHOLE-MACHINE strict EQUAL (+ invocation proof)
 * and its cycle-total teeth; UNIT EQUAL on the natural first entry and its behavioural
 * teeth; FULL-BRANCH coverage of both arms from crafted entries (EQUAL over RAM+regs+pc+SP
 * AND each arm's exact cycle TOTAL, callees stubbed to isolate loc_1cc2's OWN cycles and to
 * capture the footstep-routing); and per-arm teeth catching BOTH a dropped cycle charge AND
 * a wrong RAM value (and a mis-routed footstep).
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1cc2 as translated_1cc2 } from "../../translated/state0.js";
import { loc_1cc2 as optimized_1cc2 } from "../loc_1cc2.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1cc2;
const RANGE = [0x1cc2, 0x1cd2]; // [lo, hi) the routine's own ROM span, for NMI-landing checks
const FRAMES_WHOLE = 900; // past the ~f634 first dispatch, 70 invocations, both arms
const FRAMES_UNIT = 900; // the unit host must run past the first dispatch (~f634)

const RET_ADDR = 0x4d17; // sentinel caller return address for the tail callee's ret
const SPRITE_CODE = 0x6207; // MARIO_SPRITE_CODE -- stored from A
const MOVE_TIMER = 0x620f; // MARIO_MOVE_STEP_TIMER -- reloaded to 2
const SND = 0x6080; // SND_TRIGGER -- written to 3 INSIDE sub_1d8f on the odd (carry-set) phase

// -- ATOMICITY (measured -- this is what licenses the STRICT gate) -------------

test("ATOMICITY: every loc_1cc2 dispatch runs mask-cleared and no NMI lands inside it", () => {
  // Snapshot override records io.nmiMask at each entry (and which arm the carry takes),
  // then delegates to the oracle so the game proceeds. fireNmi is wrapped to record every
  // pushed PC and flag any that lands in the routine's own ROM span -- a mid-routine interrupt.
  const masks = [];
  const arm = { set: 0, clr: 0 };
  const snap = new Map([[TARGET, (mm) => {
    masks.push(mm.io.nmiMask);
    if (mm.regs.a & 1) arm.set++; else arm.clr++; // carry after rra = A bit0 on entry
    return translated_1cc2(mm);
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

  assert.ok(masks.length >= 1, "loc_1cc2 was never dispatched -- widen the window");
  assert.ok(masks.every((v) => v === 0), `io.nmiMask must be 0 at every dispatch (saw ${[...new Set(masks)]})`);
  assert.equal(pushedInRange.length, 0, `an NMI pushed a PC inside [0x1cc2,0x1cd2): ${pushedInRange.map((p) => "0x" + p.toString(16))}`);
  console.log(`  ATOMICITY: ${masks.length} dispatches (carry-set ${arm.set}, carry-clear ${arm.clr}), all mask-cleared; 0/${nmis} NMIs landed inside -> STRICT licensed`);
});

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed loc_1cc2 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1cc2]]));
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
  // The collapse's load-bearing invariant is total-cycle preservation. Shorting BB2 by 5 t
  // (30 -> 25) on every invocation shifts the frame's cycle budget -> the spin count 0x6019
  // (PRNG entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.hl = SPRITE_CODE;
    mem.write8(regs.hl, regs.a);
    regs.rra();
    m.step(0x1cc7, 21);
    if (regs.fC) { m.push16(0x1cca); m.step(0x1d8f, 17); m.call(0x1d8f); }
    else { m.step(0x1cca, 10); }
    regs.a = 0x02;
    mem.write8(MOVE_TIMER, regs.a);
    m.step(0x1da6, 25); // BUG: 30 -> 25
    return m.call(0x1da6);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) ------------------------------------------------

/** Capture the pristine machine the instant loc_1cc2 is first entered (via m.call, deep
 *  in the NMI movement cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1cc2(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff. The callees
 *  (sub_1d8f footstep / entry_1da6 sprite copy) resolve to the ORACLE on both clones, so
 *  this compares the full downstream effect of the arm the natural entry took. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1cc2(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_1cc2 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1cc2);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical (natural entry, through the footstep+sprite tail)");
});

test("TEETH (unit behavioural): inverting the footstep-carry condition is CAUGHT", () => {
  // The one carry-dependent behaviour is `call c,0x1d8f`. A twin that inverts the test rings
  // the footstep on the wrong phase: on a carry-clear entry it now pushes + calls sub_1d8f
  // (SND_TRIGGER 0x6080 := 3, SP one deeper); on a carry-set entry it skips it. Either way the
  // downstream RAM (0x6080) and/or SP diverge from the oracle.
  const broken_invertCarry = (m) => {
    const { regs, mem } = m;
    regs.hl = SPRITE_CODE;
    mem.write8(regs.hl, regs.a);
    regs.rra();
    m.step(0x1cc7, 21);
    if (!regs.fC) { m.push16(0x1cca); m.step(0x1d8f, 17); m.call(0x1d8f); } // BUG: inverted
    else { m.step(0x1cca, 10); }
    regs.a = 0x02;
    mem.write8(MOVE_TIMER, regs.a);
    m.step(0x1da6, 30);
    return m.call(0x1da6);
  };
  const r = runBoth(NATURAL_ENTRY, broken_invertCarry);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch an inverted footstep-carry -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "RAM diff at 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? "reg diff at " + r.regs.reg : "pc/sp diff"}`);
});

// -- FULL-BRANCH COVERAGE (crafted entries: both arms) -------------------------

/**
 * Fresh machine seeded with A = the sprite-code byte the walk arm hands over. The two callees
 * (sub_1d8f footstep, entry_1da6 sprite-copy tail) are recording ZERO-cost stubs (no `ret`),
 * so each arm's cycle TOTAL is loc_1cc2's OWN charge alone and the stub captures the footstep
 * routing. Because the stub does not pop, the carry-set arm's SP stays one push deep (0x1CCA
 * still on the stack) -- identical on the oracle and optimized runs, and distinct from the
 * carry-clear arm, which is itself proof of the routing.
 */
function seed(aval) {
  const captured = { sound: false, tail: false };
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // loc_1cc2's caller frame (the tail callee's ret would land here)
  const entrySP = m.regs.sp;
  m.regs.a = aval; // the sprite-code byte
  m.routines.set(0x1d8f, () => { captured.sound = true; }); // footstep: record, 0 t, no ret
  m.routines.set(0x1da6, () => { captured.tail = true; }); // sprite tail: record, 0 t, no ret
  return { m, entrySP, captured };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle total
 *  against the oracle and against the structural constant `expectCycles`, plus the footstep
 *  routing (sound called iff carry set). */
function assertArm(label, aval, expectCycles, expectSound) {
  const A = seed(aval);
  const B = seed(aval);
  const ca0 = A.m.cycles, cb0 = B.m.cycles;
  translated_1cc2(A.m);
  optimized_1cc2(B.m);
  const dA = A.m.cycles - ca0, dB = B.m.cycles - cb0;

  const ram = firstStateDiff(A.m.dumpState(), B.m.dumpState(), (off) => A.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(A.m.regs, B.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(A.m.pc, B.m.pc, "pc must match");
  assert.equal(A.m.regs.sp, B.m.regs.sp, "SP must match");
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  assert.equal(A.captured.sound, expectSound, `${label}: oracle footstep routing`);
  assert.equal(B.captured.sound, expectSound, `${label}: collapsed footstep routing must match`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${B.m.pc.toString(16)}, sp=0x${B.m.regs.sp.toString(16)}, footstep=${B.captured.sound}, ${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): carry SET (A bit0=1) -- footstep call c taken -> loc_1cc2 own 21+17+30 = 68 t", () => {
  assertArm("carrySet", 0x81, 68, true); // 0x81 = (anim&3=1) | facing-right bit7, as loc_1c8f builds
  const { m, captured } = seed(0x81);
  optimized_1cc2(m);
  assert.equal(m.pc, 0x1da6, "tail transfers to the sprite-copy 0x1DA6");
  assert.equal(captured.tail, true, "tails entry_1da6");
  assert.equal(captured.sound, true, "odd phase rings the footstep sub_1d8f");
  assert.equal(m.mem.read8(SPRITE_CODE), 0x81, "stores the sprite-code byte to 0x6207");
  assert.equal(m.mem.read8(MOVE_TIMER), 2, "reloads MARIO_MOVE_STEP_TIMER (0x620F) = 2");
  assert.equal(m.regs.sp, 0x6bfc, "one push deep (0x1CCA on the stack; stub does not pop)");
});

test("BRANCH (unit): carry CLEAR (A bit0=0) -- no footstep, call c NOT taken -> own 21+10+30 = 61 t", () => {
  assertArm("carryClear", 0x80, 61, false); // 0x80 = (anim&3=0) | facing-right bit7
  const { m, captured } = seed(0x80);
  optimized_1cc2(m);
  assert.equal(m.pc, 0x1da6, "tail transfers to the sprite-copy 0x1DA6");
  assert.equal(captured.tail, true, "tails entry_1da6");
  assert.equal(captured.sound, false, "even phase does NOT ring the footstep");
  assert.equal(m.mem.read8(SPRITE_CODE), 0x80, "stores the sprite-code byte to 0x6207");
  assert.equal(m.mem.read8(MOVE_TIMER), 2, "reloads MARIO_MOVE_STEP_TIMER (0x620F) = 2");
  assert.equal(m.regs.sp, 0x6bfe, "no extra push (footstep not called)");
});

// -- PER-ARM TEETH: dropped cycle charge AND wrong RAM value, both arms --------

/** Run oracle vs `fn` on one crafted arm; return whether they diverge in RAM/regs/pc/SP or
 *  in cycle total. */
function craftedDiverges(aval, fn) {
  const A = seed(aval);
  const B = seed(aval);
  const ca0 = A.m.cycles, cb0 = B.m.cycles;
  translated_1cc2(A.m);
  fn(B.m);
  const ram = firstStateDiff(A.m.dumpState(), B.m.dumpState(), (off) => A.m.stateOffsetToAddr(off));
  const regs = firstRegDiff(A.m.regs, B.m.regs);
  const cyc = (A.m.cycles - ca0) !== (B.m.cycles - cb0);
  return {
    stateDiff: ram != null || regs != null || A.m.pc !== B.m.pc || A.m.regs.sp !== B.m.regs.sp,
    cycDiff: cyc,
  };
}

test("BRANCH-TEETH (cycles): a dropped BB2 charge yields a wrong total on EVERY arm and is CAUGHT", () => {
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.hl = SPRITE_CODE; mem.write8(regs.hl, regs.a); regs.rra();
    m.step(0x1cc7, 21);
    if (regs.fC) { m.push16(0x1cca); m.step(0x1d8f, 17); m.call(0x1d8f); }
    else { m.step(0x1cca, 10); }
    regs.a = 0x02; mem.write8(MOVE_TIMER, regs.a);
    m.step(0x1da6, 25); return m.call(0x1da6); // DROPPED: 30 -> 25
  };
  for (const [label, aval] of [["carrySet", 0x81], ["carryClear", 0x80]]) {
    const d = craftedDiverges(aval, dropped);
    assert.ok(d.cycDiff, `${label}: cycle-total assertion has no teeth`);
  }
  console.log("  BRANCH-TEETH/cycles: dropped charge caught on both arms");
});

test("BRANCH-TEETH (value): dropping the 0x620F timer reload leaves wrong RAM on EVERY arm and is CAUGHT", () => {
  const noReload = (m) => {
    const { regs, mem } = m;
    regs.hl = SPRITE_CODE; mem.write8(regs.hl, regs.a); regs.rra();
    m.step(0x1cc7, 21);
    if (regs.fC) { m.push16(0x1cca); m.step(0x1d8f, 17); m.call(0x1d8f); }
    else { m.step(0x1cca, 10); }
    regs.a = 0x02; // BUG: never writes 0x620F
    m.step(0x1da6, 30); return m.call(0x1da6);
  };
  for (const [label, aval] of [["carrySet", 0x81], ["carryClear", 0x80]]) {
    const d = craftedDiverges(aval, noReload);
    assert.ok(d.stateDiff, `${label}: wrong-RAM assertion has no teeth`);
  }
  console.log("  BRANCH-TEETH/value: dropped 0x620F reload caught on both arms");
});

test("BRANCH-TEETH (routing): a mis-routed footstep changes SP on EVERY arm and is CAUGHT", () => {
  const misroute = (m) => {
    const { regs, mem } = m;
    regs.hl = SPRITE_CODE; mem.write8(regs.hl, regs.a); regs.rra();
    m.step(0x1cc7, 21);
    if (!regs.fC) { m.push16(0x1cca); m.step(0x1d8f, 17); m.call(0x1d8f); } // BUG: inverted carry
    else { m.step(0x1cca, 10); }
    regs.a = 0x02; mem.write8(MOVE_TIMER, regs.a);
    m.step(0x1da6, 30); return m.call(0x1da6);
  };
  for (const [label, aval] of [["carrySet", 0x81], ["carryClear", 0x80]]) {
    const d = craftedDiverges(aval, misroute);
    assert.ok(d.stateDiff, `${label}: footstep-routing assertion has no teeth`);
  }
  console.log("  BRANCH-TEETH/routing: mis-routed footstep caught on both arms (SP diverges)");
});
