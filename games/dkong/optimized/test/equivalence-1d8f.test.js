// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_1d8f -- a one-line SOUND TRIGGER
 * (ld a,0x03 ; ld (0x6080),a ; ret). It stores 3 into SND_TRIGGER[0] (0x6080),
 * the ls259.6h sound counter the per-NMI driver sub_00e0 counts down onto latch
 * 0x7D00 -- a 3-frame sound assert. It is BRANCH-FREE, so there is a single path;
 * its body is FULLY COLLAPSED to one m.step (20 t at 0x1D94) + m.ret (10 t) = 30 t.
 * See optimized/sub_1d8f.js for the fold accounting and why F is left untouched
 * (both loads are flag-neutral, so exit F == entry F, observable at the unit boundary).
 *
 * REACHABILITY / ATOMICITY (MEASURED here, not assumed -- the oracle's "not yet wired
 * into the live dispatcher" note is STALE). Probed at 0x1D8F over an all-oracle run:
 * 49 dispatches in 1600 attract frames (first ~f640, once the attract demo PLAYS 25m and
 * Mario walks) and 21 in 1600 driven-gameplay frames -- so a whole-machine attract run
 * exercises it and the gate is NON-vacuous. It is ATOMIC on every measured path: EVERY
 * dispatch occurs INSIDE the NMI with the mask CLEARED (in-NMI 49/49 attract, 21/21 driven;
 * mask-set 0/0), and sub_1d8f is a pure LEAF (no m.call) so the mask stays clear through
 * its body and the NMI cannot re-enter -- the NMI's pushed PC never lands in
 * [0x1D8F,0x1D94) (0 of 1594 accepted NMIs). A correct atomic collapse is therefore
 * byte-exact, so the STRICT whole-machine gate is the right license (not the convergent
 * gate, which is for INTERRUPTIBLE collapses whose mistimed-NMI tear / dead-stack PC
 * false-fail strict).
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) with cycle-total teeth AND a
 * wrong-value twin (the 0x6080 countdown persists via sub_00e0, so a wrong assert value
 * diverges downstream); UNIT EQUAL on the natural first entry with a wrong-value twin
 * caught directly; and FULL-PATH crafted coverage (EQUAL over RAM+regs+pc+SP, exact 30 t
 * total, F left untouched proven with carry-in BOTH ways) with a dropped-charge twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_1d8f as translated_1d8f } from "../../translated/state0.js";
import { sub_1d8f as optimized_1d8f } from "../sub_1d8f.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { SND_TRIGGER } from "../ram.js"; // 0x6080

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1d8f;
const FRAMES_WHOLE = 800; // past the ~f640 first dispatch, ~13 invocations, teeth diverge after
const FRAMES_UNIT = 700; // the unit host must run past the first dispatch (~f640) to capture it

const RET_ADDR = 0x4d17; // sentinel return address for the crafted `ret`
const F_C = 0x01; // Z80 carry bit, for the carry-in-preserved (F untouched) coverage
const ASSERT_VALUE = 0x03; // the 3-frame sound assert this routine stores
const TOTAL_T = 30; // 7 (ld a) + 13 (ld (nn),a) + 10 (ret)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed sub_1d8f is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1d8f]]));
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

test("STRICT-TEETH (cycles): a wrong body total forks the trajectory and is CAUGHT", () => {
  // The collapse's load-bearing invariant is total-cycle preservation. Charging the body
  // 19 t instead of 20 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG
  // entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = ASSERT_VALUE;
    mem.write8(SND_TRIGGER, regs.a);
    m.step(0x1d94, 19); // DROPPED: 20 -> 19
    m.ret(10);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH (cycles): caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

test("STRICT-TEETH (value): a wrong assert value (2 not 3) persists via the countdown and is CAUGHT", () => {
  // sub_00e0 counts SND_TRIGGER[0] down frame by frame (3->2->1->0), so a wrong initial
  // value shortens the assert by a frame: 0x6080 (and the driven latch 0x7D00) differ on a
  // later frame. The store persists in the diffed dump, so the strict gate catches it.
  const valuebroken = (m) => {
    const { regs, mem } = m;
    regs.a = 0x02; // BUG: 3 -> 2
    mem.write8(SND_TRIGGER, regs.a);
    m.step(0x1d94, 20);
    m.ret(10);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, valuebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong sound-trigger value -- it is worthless");
  console.log(`  STRICT-TEETH (value): caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant sub_1d8f is first entered (via m.call, deep
 *  in the NMI sound-trigger path). The snapshot override is wired at CONSTRUCTION so it
 *  fires however the routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1d8f(mm);
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
  translated_1d8f(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic sub_1d8f matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1d8f);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, SP) + pc identical (natural entry)");
});

test("TEETH (unit behavioural): a wrong assert value mis-latches 0x6080 and is CAUGHT", () => {
  // A twin that stores 2 instead of 3: SND_TRIGGER[0] (0x6080) and A both differ -- both
  // observable at the unit boundary (this targets the routine's OWN store directly).
  const broken = (m) => {
    const { regs, mem } = m;
    regs.a = 0x02; // BUG: 3 -> 2
    mem.write8(SND_TRIGGER, regs.a);
    m.step(0x1d94, 20);
    m.ret(10);
  };
  const r = runBoth(NATURAL_ENTRY, broken);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a mis-latched sound value -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.regs ? "reg diff at " + r.regs.reg : (r.ram ? "RAM diff at 0x" + (r.ram.addr).toString(16) : "pc/sp")}`);
});

// -- FULL-PATH COVERAGE (crafted entry: exact total, F untouched both ways) ----

/** Fresh machine with a `ret` frame. `carryIn` seeds the F carry bit to prove the two
 *  flag-neutral loads leave the entry F untouched at the exit (observable). A/0x6080 are
 *  seeded with junk to prove they are set deterministically (A := 3, 0x6080 := 3). */
function seed(carryIn) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // sub_1d8f's return frame
  m.mem.write8(SND_TRIGGER, 0x77); // junk -> must become 3
  m.regs.a = 0x99; // junk -> must become 3
  if (carryIn) m.regs.f |= F_C; else m.regs.f &= ~F_C;
  return m;
}

/** Prove the single path EQUAL (RAM + full register file + pc + SP) AND pin its exact
 *  cycle total against the oracle and against the structural constant 30 t. */
function assertPath(carryIn) {
  const label = `carry-${carryIn ? "set" : "clear"}`;
  const a = seed(carryIn);
  const b = seed(carryIn);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_1d8f(a);
  optimized_1d8f(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.pc, b.pc, `${label}: pc must match`);
  assert.equal(a.regs.sp, b.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, TOTAL_T, `${label}: oracle total should be ${TOTAL_T} t (got ${dA})`);
  console.log(`  PATH/${label}: EQUAL -- pc=0x${b.pc.toString(16)}, A=0x${b.regs.a.toString(16)}, ` +
    `F=0x${b.regs.f.toString(16)}, 0x6080=0x${b.mem.read8(SND_TRIGGER).toString(16)}, ${dB} t == oracle ${dA} t`);
}

test("PATH (unit): single branch-free path EQUAL + exact 30 t total (carry-in clear)", () => {
  assertPath(false);
  const m = seed(false);
  optimized_1d8f(m);
  assert.equal(m.pc, RET_ADDR, "returns to the sentinel");
  assert.equal(m.regs.sp, 0x6c00, "pops exactly one frame");
  assert.equal(m.regs.a, ASSERT_VALUE, "A ends holding the literal 3");
  assert.equal(m.mem.read8(SND_TRIGGER), ASSERT_VALUE, "SND_TRIGGER[0] (0x6080) := 3");
});

test("PATH (unit): F is UNTOUCHED -- carry-in survives to exit F (carry-in set)", () => {
  // Both loads are flag-neutral and `ret` sets no flags, so entry carry must survive to
  // exit F -- observable, and the only way the two carry-in cases differ. assertPath diffs
  // the whole F byte; here we also pin the carry bit explicitly.
  assertPath(true);
  const m = seed(true);
  optimized_1d8f(m);
  assert.equal(m.regs.f & F_C, F_C, "carry preserved into exit F (F untouched)");
});

test("PATH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // Body charged 18 instead of 20 -> total no longer matches the oracle.
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.a = ASSERT_VALUE;
    mem.write8(SND_TRIGGER, regs.a);
    m.step(0x1d94, 18); // DROPPED: 20 -> 18
    m.ret(10);
  };
  const a = seed(false);
  const b = seed(false);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_1d8f(a);
  dropped(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  PATH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
