// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1d76 -- the TIMER-RUNNING branch of the climb-anim
 * stepper (ld a,(0x621a) ; and a ; jp z,0x1d8a ; ld (0x6219),a ; ld a,(0x621c) ;
 * sub 0x13 ; ld hl,0x6205 ; cp (hl) ; ret nc ; -> fall into entry_1d8a). COLLAPSED
 * to one m.step per basic block, both tail transfers to entry_1d8a and the NC arm's
 * `ret` kept verbatim: arm Z 27 t -> 0x1D8A; NZ line 77 t -> PC 0x1D89; arm NC
 * +11 t (ret) = 88 t -> caller; arm C +5 t = 82 t -> 0x1D8A. See optimized/loc_1d76.js
 * for the fold and the flag analysis.
 *
 * REACHABILITY + ATOMICITY (measured here, not assumed -- see the ATOMICITY test).
 * loc_1d76 is tail-called from entry_1d03's timer-running arm inside the per-frame
 * movement cascade. Over 1200 attract frames: 46 entries (first ~frame 842), and
 * EVERY one takes arm Z (gate 0x621A == 0). It is ATOMIC: every entry occurs with
 * io.nmiMask CLEARED (inside the vblank NMI, mask zeroed so it cannot re-enter;
 * 46/46 in-NMI), and the NMI's pushed PC never lands in [0x1D76,0x1D8A) (0/1994
 * NMIs). So the STRICT byte-exact whole-machine gate is the right license, NOT the
 * convergent gate. The two NZ arms (NC / C) are unreached in attract, so they get
 * crafted-entry EQUAL + exact cycle-total teeth (doc 06 full-branch coverage).
 *
 * Jobs: an explicit ATOMICITY measurement; WHOLE-MACHINE strict EQUAL (+ invocation
 * proof) and its cycle-total teeth; UNIT EQUAL on the natural first entry (arm Z,
 * through the entry_1d8a tail) and its behavioural teeth; FULL-BRANCH coverage of all
 * three arms (Z / NC / C) from crafted entries (EQUAL over RAM + full register file +
 * pc + SP AND each arm's exact cycle TOTAL, entry_1d8a stubbed to isolate loc_1d76's
 * OWN cycles); a dropped-charge cycle twin CAUGHT; and a dropped-RAM-write twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1d76 as translated_1d76 } from "../../translated/state0.js";
import { loc_1d76 as optimized_1d76 } from "../loc_1d76.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1d76;
const RANGE = [0x1d76, 0x1d8a]; // [lo, hi) the routine's own ROM span, for NMI-landing checks
const FRAMES_WHOLE = 1200; // past the ~f842 first dispatch, 46 invocations (all arm Z)
const FRAMES_UNIT = 1200; // the unit host must run past the first dispatch (~f842)

const RET_ADDR = 0x4d17; // sentinel caller return address for the tail callee / ret nc
const GATE = 0x621a; // the arm fork (stays hex -- shared byte)
const TOGGLE = 0x6219; // written on the NZ arms (stays hex -- write-only toggle)
const CLIMB_LIMIT_B = 0x621c; // MARIO_CLIMB_LIMIT_B
const MARIO_Y = 0x6205; // MARIO_Y
const TAIL = 0x1d8a; // entry_1d8a -- the shared timer-tick tail

// -- ATOMICITY (measured -- this is what licenses the STRICT gate) -------------

test("ATOMICITY: every loc_1d76 dispatch runs mask-cleared and no NMI lands inside it", () => {
  // Snapshot override records io.nmiMask at each entry (and which arm), then delegates
  // to the oracle so the game proceeds. fireNmi is wrapped to record every pushed PC and
  // flag any that lands in the routine's own ROM span -- a mid-routine interrupt.
  const masks = [];
  const arm = { Z: 0, NC: 0, C: 0 };
  const snap = new Map([[TARGET, (mm) => {
    masks.push(mm.io.nmiMask);
    if (mm.mem.read8(GATE) === 0) arm.Z++;
    else {
      const val = (mm.mem.read8(CLIMB_LIMIT_B) - 0x13) & 0xff;
      if (val >= mm.mem.read8(MARIO_Y)) arm.NC++;
      else arm.C++;
    }
    return translated_1d76(mm);
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

  assert.ok(masks.length >= 1, "loc_1d76 was never dispatched -- widen the window");
  assert.ok(masks.every((v) => v === 0), `io.nmiMask must be 0 at every dispatch (saw ${[...new Set(masks)]})`);
  assert.equal(pushedInRange.length, 0, `an NMI pushed a PC inside [0x1d76,0x1d8a): ${pushedInRange.map((p) => "0x" + p.toString(16))}`);
  console.log(`  ATOMICITY: ${masks.length} dispatches (arm Z ${arm.Z}, NC ${arm.NC}, C ${arm.C}), all mask-cleared; 0/${nmis} NMIs landed inside -> STRICT licensed`);
});

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed loc_1d76 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1d76]]));
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
  // The collapse's load-bearing invariant is total-cycle preservation. Shorting the
  // natural (Z) arm by 5 t shifts the frame's cycle budget -> the spin count 0x6019
  // (PRNG entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(GATE);
    regs.and(regs.a);
    if (regs.fZ) { m.step(TAIL, 22); return m.call(TAIL); } // 27 -> 22
    mem.write8(TOGGLE, regs.a);
    regs.a = mem.read8(CLIMB_LIMIT_B);
    regs.sub(0x13);
    regs.hl = MARIO_Y;
    regs.cp(mem.read8(regs.hl));
    m.step(0x1d89, 77);
    if (regs.fNC) { m.ret(11); return; }
    m.step(TAIL, 5); return m.call(TAIL);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- arm Z) ---------------------------------------

/** Capture the pristine machine the instant loc_1d76 is first entered (via m.call, deep
 *  in the NMI movement cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1d76(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff. The tail
 *  callee (entry_1d8a) resolves to the ORACLE on both clones, so this compares the full
 *  downstream effect of the arm the natural entry took (arm Z -> dec 0x620F). */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1d76(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_1d76 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1d76);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical (natural arm-Z entry, through the entry_1d8a tail)");
});

test("TEETH (unit behavioural): holding instead of ticking the timer is CAUGHT", () => {
  // A twin that turns arm Z into a bare `ret` (m.ret) instead of tailing entry_1d8a
  // skips the 0x620F timer decrement AND lands on a different pc/SP -- observable.
  const broken_noTick = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(GATE);
    regs.and(regs.a);
    if (regs.fZ) { m.step(0x1d89, 27); m.ret(11); return; } // BUG: return without ticking the timer
    mem.write8(TOGGLE, regs.a);
    regs.a = mem.read8(CLIMB_LIMIT_B);
    regs.sub(0x13);
    regs.hl = MARIO_Y;
    regs.cp(mem.read8(regs.hl));
    m.step(0x1d89, 77);
    if (regs.fNC) { m.ret(11); return; }
    m.step(TAIL, 5); return m.call(TAIL);
  };
  const r = runBoth(NATURAL_ENTRY, broken_noTick);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a skipped timer tick -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "RAM diff at 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? "reg diff at " + r.regs.reg : "pc/sp diff"}`);
});

// -- FULL-BRANCH COVERAGE (crafted entries: arms Z / NC / C) -------------------

/**
 * Fresh machine seeded to reach one arm deterministically. entry_1d8a (the Z/C tail)
 * is a recording ZERO-cost stub, so each arm's cycle TOTAL is loc_1d76's OWN charge
 * alone and the stub captures whether the tail was taken. The NC arm has no callee --
 * its `ret nc` pops the caller frame pushed here.
 */
function seed(gate, limitB, marioY) {
  const captured = { who: null };
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // loc_1d76's caller frame (entry_1d8a's ret / the ret nc land here)
  const entrySP = m.regs.sp;
  m.mem.write8(GATE, gate); // the arm fork
  m.mem.write8(CLIMB_LIMIT_B, limitB); // NZ-arm extent limit
  m.mem.write8(MARIO_Y, marioY); // NZ-arm compare target
  m.mem.write8(TOGGLE, 0xa5); // pre-seed 0x6219 so the NZ-arm write is observable as a change
  m.regs.a = 0x5c; // arbitrary -- overwritten by ld a,(0x621a)
  m.routines.set(TAIL, () => { captured.who = TAIL; }); // entry_1d8a: no-op, 0 t
  return { m, entrySP, captured };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total against the oracle and against the structural constant `expectCycles`. */
function assertArm(label, gate, limitB, marioY, expectCycles) {
  const A = seed(gate, limitB, marioY);
  const B = seed(gate, limitB, marioY);
  const ca0 = A.m.cycles, cb0 = B.m.cycles;
  translated_1d76(A.m);
  optimized_1d76(B.m);
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

test("BRANCH (unit): arm Z -- gate==0, jp z taken -> entry_1d8a (13+4+10 = 27 t)", () => {
  assertArm("armZ", 0x00, 0x60, 0x20, 27);
  const { m, captured } = seed(0x00, 0x60, 0x20);
  optimized_1d76(m);
  assert.equal(m.pc, TAIL, "arm Z transfers to the timer-tick tail 0x1D8A");
  assert.equal(captured.who, TAIL, "arm Z tails entry_1d8a");
  assert.equal(m.mem.read8(TOGGLE), 0xa5, "arm Z writes NO memory of its own (0x6219 unchanged)");
});

test("BRANCH (unit): arm NC -- gate!=0, limit-0x13 >= MARIO_Y -> ret (77+11 = 88 t)", () => {
  // gate=1; limit 0x60 -> 0x4d; MARIO_Y 0x20; 0x4d >= 0x20 -> carry clear -> ret nc.
  assertArm("armNC", 0x01, 0x60, 0x20, 88);
  const { m, captured } = seed(0x01, 0x60, 0x20);
  optimized_1d76(m);
  assert.equal(m.pc, RET_ADDR, "arm NC returns to the caller");
  assert.equal(captured.who, null, "arm NC does NOT tail entry_1d8a");
  assert.equal(m.mem.read8(TOGGLE), 0x01, "arm NC stashed the gate value into 0x6219");
  assert.equal(m.regs.a, 0x4d, "arm NC leaves A = limit(0x60) - 0x13 = 0x4d");
});

test("BRANCH (unit): arm C -- gate!=0, limit-0x13 < MARIO_Y -> entry_1d8a (77+5 = 82 t)", () => {
  // gate=1; limit 0x20 -> 0x0d; MARIO_Y 0x60; 0x0d < 0x60 -> carry set -> fall into tail.
  assertArm("armC", 0x01, 0x20, 0x60, 82);
  const { m, captured } = seed(0x01, 0x20, 0x60);
  optimized_1d76(m);
  assert.equal(m.pc, TAIL, "arm C falls into the timer-tick tail 0x1D8A");
  assert.equal(captured.who, TAIL, "arm C tails entry_1d8a");
  assert.equal(m.mem.read8(TOGGLE), 0x01, "arm C stashed the gate value into 0x6219");
});

test("BRANCH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // NZ straight-line block charged 72 instead of 77 -> arm-NC total no longer matches.
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(GATE);
    regs.and(regs.a);
    if (regs.fZ) { m.step(TAIL, 27); return m.call(TAIL); }
    mem.write8(TOGGLE, regs.a);
    regs.a = mem.read8(CLIMB_LIMIT_B);
    regs.sub(0x13);
    regs.hl = MARIO_Y;
    regs.cp(mem.read8(regs.hl));
    m.step(0x1d89, 72); // DROPPED: 77 -> 72
    if (regs.fNC) { m.ret(11); return; }
    m.step(TAIL, 5); return m.call(TAIL);
  };
  const a = seed(0x01, 0x60, 0x20);
  const b = seed(0x01, 0x60, 0x20);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1d76(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH(cycles): oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});

test("BRANCH-TEETH (state): dropping the 0x6219 write on the NZ arms is CAUGHT", () => {
  // A twin that skips `ld (0x6219),a` leaves 0x6219 at its pre-seed value -> RAM diff.
  const noStash = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(GATE);
    regs.and(regs.a);
    if (regs.fZ) { m.step(TAIL, 27); return m.call(TAIL); }
    // BUG: 0x6219 write skipped
    regs.a = mem.read8(CLIMB_LIMIT_B);
    regs.sub(0x13);
    regs.hl = MARIO_Y;
    regs.cp(mem.read8(regs.hl));
    m.step(0x1d89, 77);
    if (regs.fNC) { m.ret(11); return; }
    m.step(TAIL, 5); return m.call(TAIL);
  };
  const a = seed(0x01, 0x60, 0x20); // arm NC
  const b = seed(0x01, 0x60, 0x20);
  translated_1d76(a.m);
  noStash(b.m);
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.notEqual(ram, null, "state gate has no teeth -- the dropped 0x6219 write went unnoticed");
  assert.equal(ram.addr, TOGGLE, `expected the diff at 0x6219, got 0x${(ram.addr ?? 0).toString(16)}`);
  console.log(`  BRANCH-TEETH(state): dropped 0x6219 write caught -- oracle ${a.m.mem.read8(TOGGLE)} vs twin ${b.m.mem.read8(TOGGLE)}`);
});
