// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1f93 -- the ACTIVE-SLOT direction dispatch of sub_1f72's
 * object-slot scan, reached from loc_1f83's Z arm. It reads (ix+1) and (ix+2) and
 * priority-decodes them to one of FIVE `exx` motion handlers by tail `jp`:
 *   ld a,(ix+1); dec a; jp z 0x20ec ; ld a,(ix+2); rra; jp c 0x1fac ; rra; jp c 0x1fe5;
 *   rra; jp c 0x1fef ; jp 0x2053.
 * Five arms, each COLLAPSED to one m.step (the routine writes NO RAM, so no
 * hardware-latch boundary; every exit is a tail jp -- no mid-body call/push16/ret):
 *   - (ix+1)==1  -> 0x20EC : 33 t
 *   - bit0 set   -> 0x1FAC :  66 t
 *   - bit1 set   -> 0x1FE5 :  80 t
 *   - bit2 set   -> 0x1FEF :  94 t
 *   - bits clear -> 0x2053 : 104 t
 * See optimized/loc_1f93.js for the fold and the flag analysis. loc_1f93 writes NO
 * RAM -- its observable output is registers (A, F) + pc + the collapsed cycle total.
 *
 * REACHABILITY (measured, not assumed -- the oracle's "not wired" docstring is STALE).
 * loc_197a is dispatched from the NMI game-state gameplay path; its cascade reaches
 * sub_1f72 -> loc_1f83 -> (active arm) loc_1f93. Probed: loc_1f93 dispatches 2605x over
 * 1400 attract frames (first entry frame 613, once the attract demo starts PLAYING 25m),
 * and ALL FIVE arms fire naturally (bit1 957, bit2 751, clear 491, bit0 229, type==1 177).
 * So a whole-machine run exercises it and the gate is NON-vacuous over EVERY arm.
 *
 * ATOMIC, so the STRICT byte-exact whole-machine gate is the right license (not the
 * convergent gate). Probed: every loc_1f93 entry occurs INSIDE the NMI handler
 * (io.nmiMask == 0 at 2605/2605; outside-NMI 0), where entry_0066 has cleared the NMI
 * mask so the interrupt cannot re-enter -- and the NMI's pushed PC never lands in
 * [0x1F93,0x1FAC) (0 landings over 1394 NMIs; all land in the 0x02BD-0x0372 main-loop
 * band + a thin 0x00xx/0x06xx tail). Its only caller is loc_1f83's active arm, itself
 * atomic on every call path, so loc_1f93 is atomic on every call path. A correct atomic
 * collapse is byte-exact here, confirmed by the strict gate passing over a 2000+-
 * invocation window. This matches SCC neighbours loc_1f83 / loc_1f8d.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry and a register-VALUE teeth twin; FULL-BRANCH coverage
 * of ALL FIVE arms from crafted identical-both-sides entries (EQUAL over RAM+regs+pc+SP
 * AND each arm's exact cycle TOTAL, tail handlers stubbed to isolate loc_1f93's own
 * charge); and a dropped-charge cycle twin CAUGHT on EACH arm.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1f93 as translated_1f93 } from "../../translated/state0.js";
import { loc_1f93 as optimized_1f93 } from "../loc_1f93.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1f93;

// The five tail targets, their required (ix+1)/(ix+2) selector, and their collapsed total.
// arm order is the ROM's priority: type==1 first, then bit0, bit1, bit2, then the fall-through.
const ARM_TYPE = { label: "type==1", tail: 0x20ec, cycles: 33, ixp1: 1, ixp2: 0 };
const ARM_BIT0 = { label: "bit0", tail: 0x1fac, cycles: 66, ixp1: 0, ixp2: 0x01 };
const ARM_BIT1 = { label: "bit1", tail: 0x1fe5, cycles: 80, ixp1: 0, ixp2: 0x02 };
const ARM_BIT2 = { label: "bit2", tail: 0x1fef, cycles: 94, ixp1: 0, ixp2: 0x04 };
const ARM_CLEAR = { label: "clear", tail: 0x2053, cycles: 104, ixp1: 0, ixp2: 0x00 };
const ARMS = [ARM_TYPE, ARM_BIT0, ARM_BIT1, ARM_BIT2, ARM_CLEAR];
const TAILS = ARMS.map((a) => a.tail);

const FRAMES_WHOLE = 720; // past the frame-613 first dispatch, ~120 invocations; teeth fork early
const FRAMES_UNIT = 700; // the unit host must run past the first dispatch (frame 613) to capture it

const SLOT_BASE = 0x6700; // sub_1f72's object table base (IX); ram.js SCRATCH_6700 -- kept hex

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed loc_1f93 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1f93]]));
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
  // The collapse's load-bearing invariant is total-cycle preservation. Charging the
  // (ix+1)==1 arm 32 t instead of 33 (that arm fires FIRST, ~frame 613) shifts the frame's
  // cycle budget -> the spin count 0x6019 (PRNG entropy) and where a later NMI's pushed PC
  // lands -> the trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    regs.a = regs.dec8(mem.read8((ix + 1) & 0xffff));
    if (regs.fZ) { m.step(0x20ec, 33 - 1); return m.call(0x20ec); } // DROPPED: 33 -> 32
    regs.a = mem.read8((ix + 2) & 0xffff);
    regs.rra(); if (regs.fC) { m.step(0x1fac, 66); return m.call(0x1fac); }
    regs.rra(); if (regs.fC) { m.step(0x1fe5, 80); return m.call(0x1fe5); }
    regs.rra(); if (regs.fC) { m.step(0x1fef, 94); return m.call(0x1fef); }
    m.step(0x2053, 104); return m.call(0x2053);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant loc_1f93 is first entered (via m.call, deep in
 *  the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires however the
 *  routine is reached, then delegates to the oracle so the host run proceeds normally. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1f93(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff + contract.
 *  Both run the full SCC descent as ORACLE downstream (only loc_1f93 differs), so any
 *  divergence localizes to loc_1f93's own body. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1f93(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_1f93 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1f93);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. A, F) + pc identical (natural entry, arm type==1)");
});

test("TEETH (unit, dispatch): the record-offset trap (read (ix+2) not (ix+1)) flips the arm and is CAUGHT", () => {
  // loc_1f93's primary observable is WHICH handler it dispatches to, and a bare register
  // (A) teeth is masked -- the chosen handler overwrites A downstream, so an A-only diff
  // washes out (docs/decompiler-pipeline's "re-poked output masked" wrinkle). The load-bearing teeth is the
  // record-offset trap the routine warns about: reading (ix+2) instead of (ix+1) for the
  // type test. On the natural type==1 entry ((ix+1)==1, (ix+2)==0) that dec's 0 -> NZ, so
  // the twin falls to the all-bits-clear arm (0x2053) instead of the type arm (0x20ec) --
  // a DIFFERENT handler, so pc and downstream RAM diverge PERSISTENTLY and are CAUGHT.
  const broken_wrongOffset = (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    regs.a = regs.dec8(mem.read8((ix + 2) & 0xffff)); // BUG: (ix+2) not (ix+1) for the type test
    if (regs.fZ) { m.step(0x20ec, 33); return m.call(0x20ec); }
    regs.a = mem.read8((ix + 2) & 0xffff);
    regs.rra(); if (regs.fC) { m.step(0x1fac, 66); return m.call(0x1fac); }
    regs.rra(); if (regs.fC) { m.step(0x1fe5, 80); return m.call(0x1fe5); }
    regs.rra(); if (regs.fC) { m.step(0x1fef, 94); return m.call(0x1fef); }
    m.step(0x2053, 104); return m.call(0x2053);
  };
  const r = runBoth(NATURAL_ENTRY, broken_wrongOffset);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a flipped dispatch arm -- it is worthless");
  console.log(`  TEETH/unit: caught -- diff at ${r.regs ? r.regs.reg : (r.ram ? "ram" : "pc/sp")}`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides entries: all five arms) --

/**
 * Fresh machine pointed at one object record at 0x6700, with (ix+1)/(ix+2) poked to
 * select the requested arm. To measure loc_1f93's OWN cycle total, all five tail targets
 * are registered as zero-cost no-ops so the collapsed charge is loc_1f93's alone. loc_1f93
 * never pushes/rets, so SP is untouched; a valid SP is set only for realism.
 */
function seed(arm) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.regs.ix = SLOT_BASE;
  if (arm.ixp1) m.mem.write8((SLOT_BASE + 1) & 0xffff, arm.ixp1);
  if (arm.ixp2) m.mem.write8((SLOT_BASE + 2) & 0xffff, arm.ixp2);
  for (const t of TAILS) m.routines.set(t, () => {}); // isolate loc_1f93's own cycles
  return m;
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total against the oracle and against the structural constant `arm.cycles`. */
function assertArm(arm) {
  const a = seed(arm);
  const b = seed(arm);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_1f93(a);
  optimized_1f93(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${arm.label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(regs, null, regs ? `${arm.label}: reg diff at ${regs.reg} (t ${regs.a} vs o ${regs.b})` : "");
  assert.equal(a.pc, b.pc, `${arm.label}: pc must match`);
  assert.equal(a.regs.sp, b.regs.sp, `${arm.label}: SP must match`);
  assert.equal(b.pc, arm.tail, `${arm.label}: must tail-transfer to 0x${arm.tail.toString(16)}`);
  assert.equal(dB, dA, `${arm.label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, arm.cycles, `${arm.label}: oracle total should be ${arm.cycles} t (got ${dA})`);
  console.log(`  BRANCH/${arm.label}: EQUAL -- pc=0x${b.pc.toString(16)}, A=0x${b.regs.a.toString(16)}, ` +
    `${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): ALL FIVE arms EQUAL (RAM+regs+pc+SP) and each hits its exact cycle total", () => {
  for (const arm of ARMS) assertArm(arm);
});

test("BRANCH (unit): the (ix+1)==1 arm leaves A==0 / Z set (dec of 1)", () => {
  const m = seed(ARM_TYPE);
  optimized_1f93(m);
  assert.equal(m.regs.a, 0, "type==1 arm: dec of 1 leaves A == 0");
  assert.ok(m.regs.fZ, "type==1 arm: Z is set");
  assert.equal(m.pc, ARM_TYPE.tail, "type==1 arm: tail to 0x20ec");
});

test("BRANCH-TEETH (cycles): a dropped charge on EACH of the five arms is CAUGHT", () => {
  // For every arm, a twin that charges (total-1) must differ from the oracle by exactly 1.
  const twinFor = (targetArm) => (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    const chg = (arm) => (arm === targetArm ? arm.cycles - 1 : arm.cycles);
    regs.a = regs.dec8(mem.read8((ix + 1) & 0xffff));
    if (regs.fZ) { m.step(0x20ec, chg(ARM_TYPE)); return m.call(0x20ec); }
    regs.a = mem.read8((ix + 2) & 0xffff);
    regs.rra(); if (regs.fC) { m.step(0x1fac, chg(ARM_BIT0)); return m.call(0x1fac); }
    regs.rra(); if (regs.fC) { m.step(0x1fe5, chg(ARM_BIT1)); return m.call(0x1fe5); }
    regs.rra(); if (regs.fC) { m.step(0x1fef, chg(ARM_BIT2)); return m.call(0x1fef); }
    m.step(0x2053, chg(ARM_CLEAR)); return m.call(0x2053);
  };
  for (const arm of ARMS) {
    const a = seed(arm);
    const b = seed(arm);
    const ca0 = a.cycles, cb0 = b.cycles;
    translated_1f93(a);
    twinFor(arm)(b);
    const dA = a.cycles - ca0, dB = b.cycles - cb0;
    assert.equal(dA, arm.cycles, `${arm.label}: oracle total should be ${arm.cycles} t`);
    assert.notEqual(dB, dA, `${arm.label}: cycle-total assertion has no teeth`);
    assert.equal(dA - dB, 1, `${arm.label}: the twin must drop exactly 1 t`);
    console.log(`  BRANCH-TEETH/${arm.label}: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
  }
});
