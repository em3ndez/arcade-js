// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1f8d -- the loop tail of sub_1f72's object-slot scan
 * (inc l ; add ix,de ; djnz 0x1f83 ; ret). COLLAPSED to one m.step per DJNZ arm
 * (loop arm 32 t at 0x1F83; final arm 27 t at 0x1F92 + the ret's 10 t). See
 * optimized/loc_1f8d.js for the fold and the flag analysis.
 *
 * REACHABILITY (measured, not assumed -- the oracle's "not wired" docstring is STALE).
 * loc_197a is dispatched from the NMI game-state-3 gameplay path, and its cascade
 * reaches sub_1f72 -> loc_1f83 -> loc_1f8d. Probed: loc_1f8d dispatches 6160x over 1200
 * attract frames (first entry ~frame 586, once the attract demo starts PLAYING 25m) and
 * 4390x over 1600 driven-gameplay frames. So a whole-machine run exercises it and the
 * gate is NON-vacuous.
 *
 * ATOMIC, so the STRICT byte-exact whole-machine gate is the right license (not the
 * convergent gate, which is for INTERRUPTIBLE collapses whose mistimed-NMI raster tear /
 * dead-stack PC false-fail the strict gate). Probed: every loc_1f8d entry occurs INSIDE
 * the NMI handler (in-NMI 6160/6160 attract, 4390/4390 gameplay; outside-NMI 0), where
 * entry_0066 has cleared the NMI mask so the interrupt cannot re-enter -- and the NMI's
 * pushed PC never lands in [0x1F8D,0x1F92] (0 landings; all land in the 0x02BD-0x0372
 * main-loop band). A correct atomic collapse is therefore byte-exact here, confirmed
 * below by the strict gate passing over a 1000+-invocation window.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry and its behavioural teeth; FULL-BRANCH coverage of
 * both DJNZ arms from crafted entries (EQUAL over RAM+regs+pc+SP AND each arm's exact
 * cycle TOTAL); and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1f8d as translated_1f8d } from "../../translated/state0.js";
import { loc_1f8d as optimized_1f8d } from "../loc_1f8d.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1f8d;
const FRAMES_WHOLE = 720; // past the ~f586 first dispatch, ~1000+ invocations, teeth diverge ~f588
const FRAMES_UNIT = 650; // the unit host must run past the first dispatch (~f586) to capture it

const RET_ADDR = 0x4d17; // sentinel return address for the crafted `ret` arm
const SLOT_BASE = 0x6700; // sub_1f72's object table base (IX); ram.js SCRATCH_6700 -- kept hex
const SLOT_STRIDE = 0x0020; // DE: object record stride
const CURSOR = 0x6980; // sub_1f72's parallel 4-byte-per-slot buffer cursor (HL)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed loc_1f8d is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1f8d]]));
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
  // The collapse's load-bearing invariant is total-cycle preservation. Charging the loop
  // arm 31 t instead of 32 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG
  // entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs } = m;
    regs.l = regs.inc8(regs.l);
    regs.addIx(regs.de);
    if (regs.djnz() !== 0) { m.step(0x1f83, 31); return m.call(0x1f83); } // DROPPED: 32 -> 31
    m.step(0x1f92, 27);
    m.ret(10);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant loc_1f8d is first entered (via m.call, deep in
 *  the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires however the
 *  routine is reached, then delegates to the oracle so the host run proceeds normally. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1f8d(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff + contract. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1f8d(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_1f8d matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1f8d);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, B, HL, IX, SP) + pc identical (natural entry)");
});

test("TEETH (unit behavioural): dropping `add ix,de` leaves IX/F wrong and is CAUGHT", () => {
  // A twin that skips the IX advance: IX (and add's H/C/N/F3/F5 flags) diverge.
  const broken_noAddIx = (m) => {
    const { regs } = m;
    regs.l = regs.inc8(regs.l);
    // BUG: regs.addIx(regs.de) dropped
    if (regs.djnz() !== 0) { m.step(0x1f83, 32); return m.call(0x1f83); }
    m.step(0x1f92, 27);
    m.ret(10);
  };
  const r = runBoth(NATURAL_ENTRY, broken_noAddIx);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a dropped add ix,de -- it is worthless");
  console.log(`  TEETH/unit: caught -- reg diff at ${r.regs ? r.regs.reg : "(ram/pc)"}`);
});

// -- FULL-BRANCH COVERAGE (crafted entries: both DJNZ arms) --------------------

/**
 * Fresh machine seeded with sub_1f72's loop register contract. `slots` = B. A valid
 * SP with a sentinel return address models `ret`. Fresh work RAM reads 0 at SLOT_BASE,
 * so on the LOOP arm the recursion into oracle loc_1f83 sees an inactive slot (+0 == 0),
 * skips, and re-enters loc_1f8d -- a deterministic, bounded descent. For a CLEAN per-arm
 * OWN cycle total, `stubCallee` registers a zero-cost no-op at 0x1F83 so the loop arm's
 * total is loc_1f8d's own charge alone (32 t), not the callee's.
 */
function seed(slots, { stubCallee = false } = {}) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // loc_1f8d's return frame
  const entrySP = m.regs.sp;
  m.regs.hl = CURSOR;
  m.regs.de = SLOT_STRIDE;
  m.regs.ix = SLOT_BASE;
  m.regs.b = slots;
  if (stubCallee) m.routines.set(0x1f83, () => {}); // isolate loc_1f8d's own cycles
  return { m, entrySP };
}

/** Prove one DJNZ arm EQUAL (RAM + full register file + pc + SP) AND pin its exact
 *  cycle total against the oracle and against the structural constant `expectCycles`. */
function assertArm(label, slots, opts, expectCycles) {
  const a = seed(slots, opts);
  const b = seed(slots, opts);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1f8d(a.m);
  optimized_1f8d(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, "pc must match");
  assert.equal(a.m.regs.sp, b.m.regs.sp, "SP must match");
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, B=${b.m.regs.b}, ` +
    `IX=0x${b.m.regs.ix.toString(16)}, ${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): final arm -- B==0, djnz not taken -> ret (4+15+8+10 = 37 t)", () => {
  // slots=1: djnz decrements B to 0, falls through, ret pops RET_ADDR.
  assertArm("final-ret", 1, {}, 37);
  const { m, entrySP } = seed(1);
  optimized_1f8d(m);
  assert.equal(m.pc, RET_ADDR, "final arm returns to the sentinel");
  assert.equal(m.regs.sp, entrySP + 2, "final arm pops exactly one frame");
});

test("BRANCH (unit): loop arm -- B!=0, djnz taken -> call 0x1f83 (4+15+13 = 32 t own)", () => {
  // slots=2 with a stubbed callee isolates loc_1f8d's OWN loop-arm total (32 t).
  assertArm("loop-call", 2, { stubCallee: true }, 32);
  const { m } = seed(2, { stubCallee: true });
  optimized_1f8d(m);
  assert.equal(m.pc, 0x1f83, "loop arm transfers to the branch target 0x1F83");
  assert.equal(m.regs.b, 1, "loop arm decremented B to 1");
  assert.equal(m.regs.ix, (SLOT_BASE + SLOT_STRIDE) & 0xffff, "loop arm advanced IX by the stride");
});

test("BRANCH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // Loop arm charged 27 instead of 32 -> total no longer matches the oracle.
  const dropped = (m) => {
    const { regs } = m;
    regs.l = regs.inc8(regs.l);
    regs.addIx(regs.de);
    if (regs.djnz() !== 0) { m.step(0x1f83, 27); return m.call(0x1f83); } // DROPPED: 32 -> 27
    m.step(0x1f92, 27);
    m.ret(10);
  };
  const a = seed(2, { stubCallee: true });
  const b = seed(2, { stubCallee: true });
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1f8d(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
