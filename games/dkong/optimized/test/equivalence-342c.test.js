// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_342c -- the per-object animation-table stepper (reload the
 * saved 16-bit pointer (ix+0x1a):(ix+0x1b); 16-bit zero-test it; on the FIRST call point
 * HL at the ROM table 0x3A8C and seed (ix+0x03)=0x26; either way inc (ix+0x03) and fall
 * through into the shared loc_3445 tail). See optimized/sub_342c.js for the full block.
 *
 * COLLAPSED, per-arm body total preserved EXACTLY (ARM A 100 t, ARM B 129 t, both before
 * the tail). No hardware-latch write; the fall-through into loc_3445 is the one boundary
 * NOT folded across, kept as `m.call(0x3445)` verbatim. The routine is ATOMIC:
 *
 * REACHABILITY / GATE (measured, not assumed -- the oracle's "not yet wired / caller
 * untranslated" docstring is STALE). Probed over 1600 attract frames:
 *   - 32 dispatches (matching sub_32bd) via entry_3202 -> sub_32bd (0x32CE, BOARD==1)
 *     -> the strict whole-machine gate is non-vacuous, and BOTH arms occur naturally
 *     (ARM A x31 established pointer, ARM B x1 first/init).
 *   - io.nmiMask == 0 at 32/32 dispatches: it runs mask-cleared inside the vblank NMI
 *     (which cannot re-enter); its only callee is the leaf tail loc_3445.
 *   - the NMI's pushed PC never lands in [0x342C,0x3477] (0 of 1594 NMIs).
 *   - single call path: only sub_32bd @ 0x32CE calls it (grep-confirmed).
 * ATOMIC + total-preserving collapse => byte-exact => STRICT gate (not convergent).
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth;
 * UNIT EQUAL on the natural first entry (ARM B, ix=0x6400); FULL-BRANCH coverage of
 * BOTH arms from crafted identical-both-sides entries (EQUAL over RAM + full register
 * file + pc + SP, real loc_3445 tail; AND each arm's exact BODY cycle total via a
 * loc_3445 stub so the constant isolates sub_342c's own charges); an adcHl-vs-addHl
 * behavioural twin CAUGHT (the branch's load-bearing subtlety); and a dropped-charge
 * cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_342c as translated_342c } from "../../translated/state0.js";
import { sub_342c as optimized_342c } from "../sub_342c.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x342c;
const FRAMES_WHOLE = 1600; // 32 dispatches, both arms (ARM A x31, ARM B x1)
const FRAMES_UNIT = 1000; // the unit host must run past the first dispatch to capture it

const RET_ADDR = 0x4d17; // sentinel caller-return address for crafted entries
const IX = 0x6400; // an object record in work RAM (writes to (ix+d) land in diffed RAM)
const PTR_A = 0x3a90; // a NON-zero saved pointer -> ARM A (established); points into ROM
const ARM_A_BODY = 100; // prefix 67 + jpTaken10 + inc23
const ARM_B_BODY = 129; // prefix 67 + jpNot10 + ldhl10 + ld19 + inc23

// -- WHOLE-MACHINE (strict, byte-exact -- ATOMIC, total-preserving collapse) --

test("STRICT (whole-machine): collapsed sub_342c is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_342c]]));
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

test("STRICT-TEETH (cycles): a wrong block charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is per-arm total-cycle preservation. Charging ARM A's
  // collapsed block 32 t instead of 33 shifts the frame's cycle budget -> the spin
  // count 0x6019 (PRNG entropy) and where a later NMI's pushed PC lands -> divergence.
  // ARM A fires 31x in the run, so the drop is exercised.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.l = mem.read8(R(0x1a));
    regs.h = mem.read8(R(0x1b));
    regs.xor(regs.a);
    regs.bc = 0x0000;
    regs.adcHl(regs.bc);
    m.step(0x3438, 67);
    if (regs.fNZ) {
      regs.incMem8(mem, R(0x03));
      m.step(0x3445, 32); // DROPPED: correct ARM A block total is 33 t
    } else {
      regs.hl = 0x3a8c;
      mem.write8(R(0x03), 0x26);
      regs.incMem8(mem, R(0x03));
      m.step(0x3445, 62);
    }
    return m.call(0x3445);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- measured to be ARM B, the first/init path, ix=0x6400) --

/** Capture the pristine machine the instant sub_342c is first entered (via m.call,
 *  deep in the entry_3202 -> sub_32bd chain). The snapshot override is wired at
 *  CONSTRUCTION so it fires however the routine is reached, then delegates to the oracle. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_342c(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_342c(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic sub_342c matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_342c);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural entry, ARM B)");
});

test("TEETH (unit behavioural): a wrong (ix+0x03) seed on the natural entry is CAUGHT", () => {
  // The natural first entry takes ARM B (init: HL=0x3A8C, seed (ix+0x03)=0x26, inc->0x27).
  // A twin that seeds 0x25 instead diverges in RAM at (ix+0x03) (0x26 vs 0x27).
  const broken_seed = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.l = mem.read8(R(0x1a));
    regs.h = mem.read8(R(0x1b));
    regs.xor(regs.a);
    regs.bc = 0x0000;
    regs.adcHl(regs.bc);
    m.step(0x3438, 67);
    if (regs.fNZ) {
      regs.incMem8(mem, R(0x03));
      m.step(0x3445, 33);
    } else {
      regs.hl = 0x3a8c;
      mem.write8(R(0x03), 0x25); // BUG: oracle seeds 0x26
      regs.incMem8(mem, R(0x03));
      m.step(0x3445, 62);
    }
    return m.call(0x3445);
  };
  const r = runBoth(NATURAL_ENTRY, broken_seed);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong seed -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "RAM 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? r.regs.reg : "pc/sp"} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides entries: BOTH arms) --------

/**
 * Fresh machine with a valid stack (a sentinel caller-return frame) and an object
 * record at IX (0x6400, in work RAM so writes are diffed). The saved pointer
 * (ix+0x1a):(ix+0x1b) steers the arm; applied identically to oracle and optimized:
 *   - ptr != 0 -> ARM A (established: inc (ix+0x03); tail)
 *   - ptr == 0 -> ARM B (first call: HL=0x3A8C, seed 0x26, inc; tail)
 * `stubTail` overrides loc_3445 with a no-op so a cycle measurement isolates sub_342c's
 * OWN body total (100/129); omit it (real oracle tail) for the end-to-end EQUAL diff.
 */
function seed(ptr, { stubTail = false } = {}) {
  const overrides = stubTail ? new Map([[0x3445, () => undefined]]) : undefined;
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // sub_342c's own caller-return frame
  const entrySP = m.regs.sp;
  m.regs.ix = IX;
  m.mem.write8((IX + 0x1a) & 0xffff, ptr & 0xff);
  m.mem.write8((IX + 0x1b) & 0xffff, (ptr >> 8) & 0xff);
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) end-to-end with the REAL
 *  loc_3445 tail, AND that optimized's full total equals the oracle's. */
function assertArmEqual(label, ptr) {
  const a = seed(ptr);
  const b = seed(ptr);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_342c(a.m);
  optimized_342c(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: full cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  assert.equal(a.m.regs.sp, a.entrySP + 2, `${label}: stack balanced (caller frame consumed by loc_3445's ret)`);
  console.log(`  BRANCH/${label}: EQUAL end-to-end -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ${dB} t == oracle ${dA} t`);
}

/** Pin one arm's BODY cycle total (loc_3445 stubbed out) against the oracle AND the
 *  structural constant `expectBody` -- a regression guard on the collapse arithmetic. */
function assertArmBodyCycles(label, ptr, expectBody) {
  const a = seed(ptr, { stubTail: true });
  const b = seed(ptr, { stubTail: true });
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_342c(a.m);
  optimized_342c(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.equal(dA, expectBody, `${label}: oracle body total should be ${expectBody} t (got ${dA})`);
  assert.equal(dB, dA, `${label}: body cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  console.log(`  BRANCH-CYCLES/${label}: body ${dB} t == oracle ${dA} t == ${expectBody} t`);
}

test("BRANCH (unit): ARM A -- pointer established -> inc (ix+0x03); tail", () => {
  assertArmEqual("armA-established", PTR_A);
  assertArmBodyCycles("armA-established", PTR_A, ARM_A_BODY);
});

test("BRANCH (unit): ARM B -- first call (ptr==0) -> HL=0x3A8C, seed 0x26, inc; tail", () => {
  assertArmEqual("armB-first", 0x0000);
  assertArmBodyCycles("armB-first", 0x0000, ARM_B_BODY);
});

test("BRANCH-TEETH (behavioural): addHl-instead-of-adcHl takes the wrong arm and is CAUGHT", () => {
  // The oracle's zero test is `adc hl,bc` (SETS Z from the 16-bit result). `add hl,bc`
  // PRESERVES Z (= 1 from the preceding `xor a`), so an addHl twin reads fNZ=false and
  // takes ARM B even when the pointer is established -> it clobbers HL to 0x3A8C and
  // seeds (ix+0x03)=0x26, diverging from ARM A. Proven on a PTR_A (established) seed.
  const broken_addNotAdc = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.l = mem.read8(R(0x1a));
    regs.h = mem.read8(R(0x1b));
    regs.xor(regs.a);
    regs.bc = 0x0000;
    regs.addHl(regs.bc); // BUG: oracle uses adcHl (add preserves Z -> always ARM B)
    m.step(0x3438, 67);
    if (regs.fNZ) {
      regs.incMem8(mem, R(0x03));
      m.step(0x3445, 33);
    } else {
      regs.hl = 0x3a8c;
      mem.write8(R(0x03), 0x26);
      regs.incMem8(mem, R(0x03));
      m.step(0x3445, 62);
    }
    return m.call(0x3445);
  };
  const a = seed(PTR_A);
  const b = seed(PTR_A);
  translated_342c(a.m);
  broken_addNotAdc(b.m);
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.ok(ram != null || regs != null, "gate FAILED to catch add-instead-of-adc -- it is worthless");
  // (ix+0x03) is arm-diagnostic (loc_3445's ordinary path never touches it): ARM A
  // inc's the fresh 0 to 0x01; the wrong ARM B seeds 0x26 then inc's to 0x27.
  const ix03 = (a2) => a2.m.mem.read8((IX + 0x03) & 0xffff);
  assert.equal(ix03(a), 0x01, "oracle (ARM A) leaves (ix+0x03) = 0x01 (inc of fresh 0)");
  assert.equal(ix03(b), 0x27, "broken add twin wrongly took ARM B: (ix+0x03) seeded 0x26 -> 0x27");
  console.log(`  BRANCH-TEETH/behavioural: caught -- oracle (ix+0x03) 0x${ix03(a).toString(16)} (ARM A) vs add-twin 0x${ix03(b).toString(16)} (wrong ARM B)`);
});

test("BRANCH-TEETH (cycles): a dropped charge on ARM B body yields a wrong total and is CAUGHT", () => {
  const dropped = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.l = mem.read8(R(0x1a));
    regs.h = mem.read8(R(0x1b));
    regs.xor(regs.a);
    regs.bc = 0x0000;
    regs.adcHl(regs.bc);
    m.step(0x3438, 67);
    if (regs.fNZ) {
      regs.incMem8(mem, R(0x03));
      m.step(0x3445, 33);
    } else {
      regs.hl = 0x3a8c;
      mem.write8(R(0x03), 0x26);
      regs.incMem8(mem, R(0x03));
      m.step(0x3445, 57); // DROPPED: correct ARM B block total is 62 t
    }
    return m.call(0x3445);
  };
  const a = seed(0x0000, { stubTail: true });
  const b = seed(0x0000, { stubTail: true });
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_342c(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
