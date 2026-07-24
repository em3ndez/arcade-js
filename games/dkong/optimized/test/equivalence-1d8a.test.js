// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_1d8a -- the SHARED walk/climb sub-step-timer decrement tail
 * (ld hl,0x620f ; dec (hl) ; ret). It is BRANCH-FREE, so there is a single path; its body
 * is COLLAPSED to one m.step (21 t: 10 ld hl + 11 dec (hl), at exit PC 0x1D8E) + m.ret
 * (10 t) = 31 t. See optimized/entry_1d8a.js for the fold, the flag analysis, and why HL
 * and F are reproduced (observable at the unit boundary).
 *
 * REACHABILITY / ATOMICITY (MEASURED here, not assumed). entry_1d8a is the decrement tail
 * of the player walk/climb steppers (entry_1d03 / twin loc_1cf2), reached by tail-jump via
 * loc_1d76 from the NMI-driven per-frame update cascade. Probed over an all-oracle attract
 * run: 0 dispatches through f800, then a burst of 46 by f900 (once the attract demo plays
 * 25m and Mario walks/climbs), stable 46 through f1300 -- so the whole-machine gate is
 * NON-vacuous. ATOMIC: every one of the 46 entries occurs INSIDE the NMI handler with the
 * NMI mask CLEARED (in-NMI 46/46, mask-set 0/0), and entry_1d8a is a pure LEAF (no m.call)
 * so the mask stays clear through its whole body and the NMI cannot re-enter -- the pushed
 * PC never lands in [0x1D8A,0x1D8E]. So the STRICT byte-exact whole-machine gate is the
 * right license (not the convergent gate, which is for INTERRUPTIBLE collapses).
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry and its behavioural teeth (BYTE-not-pointer, and a
 * dropped-Z FLAG twin); FULL-PATH crafted coverage over distinct timer values incl. the
 * WRAP-TO-ZERO (Z-set) case and carry-in preserved BOTH ways, EQUAL over RAM+regs+pc+SP
 * AND the exact 31 t total; and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_1d8a as translated_1d8a } from "../../translated/state0.js";
import { entry_1d8a as optimized_1d8a } from "../entry_1d8a.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { MARIO_MOVE_STEP_TIMER } from "../ram.js";
import { F_C, F_Z, F_N } from "../../../../core/cpu/z80.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1d8a;
const TIMER = MARIO_MOVE_STEP_TIMER; // 0x620F
const FRAMES_WHOLE = 1300; // past the ~f800-f900 dispatch burst (46 invocations); teeth diverge at ~f844
const FRAMES_UNIT = 950; // the unit host must run past the first dispatch (~f840) to capture it
const RET_ADDR = 0x4d17; // sentinel return address for the crafted `ret`
const TOTAL_T = 31; // oracle total: 10 (ld hl) + 11 (dec (hl)) + 10 (ret)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed entry_1d8a is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1d8a]]));
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
  // 20 t instead of 21 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG
  // entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.hl = TIMER;
    regs.decMem8(mem, regs.hl);
    m.step(0x1d8e, 20); // DROPPED: 21 -> 20
    m.ret(10);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant entry_1d8a is first entered (deep in the NMI
 *  cascade). The snapshot override is wired at CONSTRUCTION so it fires however the routine
 *  is reached, then delegates to the oracle so the host run proceeds normally. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1d8a(mm);
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
  translated_1d8a(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic entry_1d8a matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1d8a);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log(`  EQUAL/unit: RAM + all registers (incl. F, HL, SP) + pc identical (natural entry, ` +
    `timer 0x620F ${NATURAL_ENTRY.mem.read8(TIMER)}->${(NATURAL_ENTRY.mem.read8(TIMER) - 1) & 0xff})`);
});

test("TEETH (unit behavioural): decrementing the POINTER instead of the byte is CAUGHT", () => {
  // The oracle warns `dec (hl)` is the BYTE, not the pointer. This twin decrements HL
  // (0x620F -> 0x620E) and leaves the timer byte untouched -- observable in HL AND at 0x620F.
  const broken = (m) => {
    const { regs, mem } = m;
    regs.hl = TIMER;
    regs.hl = (regs.hl - 1) & 0xffff; // BUG: dec HL (the pointer), not (hl) the byte
    m.step(0x1d8e, 21);
    m.ret(10);
  };
  const r = runBoth(NATURAL_ENTRY, broken);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a byte-vs-pointer mixup -- it is worthless");
  console.log(`  TEETH/unit(byte-not-pointer): caught -- ${r.regs ? "reg diff at " + r.regs.reg : (r.ram ? "RAM diff at 0x" + (r.ram.addr).toString(16) : "pc/sp")}`);
});

test("TEETH (unit flags): decrementing the value but DROPPING the flags is CAUGHT", () => {
  // A twin that computes the right VALUE via a raw write but never runs dec8, so it leaves F
  // stale. The register-file diff (F) catches it -- proving the exit F is truly compared.
  const flagless = (m) => {
    const { regs, mem } = m;
    regs.hl = TIMER;
    mem.write8(regs.hl, (mem.read8(regs.hl) - 1) & 0xff); // right value, NO flags set
    m.step(0x1d8e, 21);
    m.ret(10);
  };
  // Force the entry so the oracle's dec sets a DIFFERENT F than the stale one (wrap to 0 ->
  // Z set), guaranteeing the flag drop is observable rather than coincidentally equal.
  const entry = NATURAL_ENTRY.clone();
  entry.mem.write8(TIMER, 0x01);       // -> 0x00 : oracle sets Z (and N), clears S/H/PV
  entry.regs.f = 0x00;                 // stale F has Z clear, so a dropped dec8 leaves Z clear
  const r = runBoth(entry, flagless);
  assert.ok(r.regs != null, "unit gate FAILED to catch dropped flags (F not compared?) -- worthless");
  console.log(`  TEETH/unit(flags): caught -- reg diff at ${r.regs.reg}`);
});

// -- FULL-PATH COVERAGE (crafted: distinct timer values, wrap-to-0, carry-in both ways) ---

/** Fresh machine with a `ret` frame and a chosen timer value, so the decrement result and
 *  its flags are exact and visible. `carryIn` seeds the F carry bit to prove `dec (hl)`
 *  preserves it into the exit F. HL/A are junk-seeded to prove HL := 0x620F is unconditional
 *  and A is untouched. */
function seed(timerVal, carryIn) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // entry_1d8a's return frame
  m.mem.write8(TIMER, timerVal & 0xff);
  m.regs.hl = 0xdead;
  m.regs.a = 0x99;
  if (carryIn) m.regs.f |= F_C; else m.regs.f &= ~F_C;
  return m;
}

/** Prove the single path EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total against the oracle and against the structural constant 31 t, for a given timer value. */
function assertPath(timerVal, carryIn) {
  const label = `timer=0x${(timerVal & 0xff).toString(16)},carry-${carryIn ? "set" : "clear"}`;
  const a = seed(timerVal, carryIn);
  const b = seed(timerVal, carryIn);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_1d8a(a);
  optimized_1d8a(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.pc, b.pc, `${label}: pc must match`);
  assert.equal(a.regs.sp, b.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, TOTAL_T, `${label}: oracle total should be ${TOTAL_T} t (got ${dA})`);
  return b;
}

test("PATH (unit): representative timer values EQUAL + exact 31 t total (carry-in clear)", () => {
  // Distinct decrement outcomes, each exercising a different flag pattern:
  //   0x01->0x00 (Z set), 0x00->0xFF (S+H, wrap), 0x80->0x7F (PV set), 0x10->0x0F (H set).
  for (const v of [0x01, 0x00, 0x80, 0x10, 0x05]) {
    const b = assertPath(v, false);
    assert.equal(b.pc, RET_ADDR, `timer 0x${v.toString(16)}: returns to the sentinel`);
    assert.equal(b.regs.sp, 0x6c00, `timer 0x${v.toString(16)}: pops exactly one frame`);
    assert.equal(b.regs.hl, TIMER, `timer 0x${v.toString(16)}: HL ends at 0x620F (the byte, not the pointer)`);
    assert.equal(b.mem.read8(TIMER), (v - 1) & 0xff, `timer 0x${v.toString(16)}: 0x620F decremented`);
    assert.equal(b.regs.a, 0x99, `timer 0x${v.toString(16)}: A untouched`);
  }
  console.log("  PATH/carry-clear: 5 timer values EQUAL -- value, HL=0x620F, 31 t each");
});

test("PATH (unit): WRAP-TO-ZERO sets Z, and carry-in is PRESERVED into the exit F", () => {
  // THE load-bearing flag case: a caller branches on the timer reaching 0. 0x01 -> 0x00
  // must set Z; assertPath already diffs the whole F byte vs oracle, this pins the meaning.
  const zero = assertPath(0x01, false);
  assert.equal(zero.mem.read8(TIMER), 0x00, "0x01 -> 0x00");
  assert.equal(zero.regs.f & F_Z, F_Z, "Z set when the timer wraps to 0 (caller branches on this)");
  assert.equal(zero.regs.f & F_N, F_N, "N set (dec is a subtract)");

  // A non-zero result must clear Z, and `dec` never touches carry -> entry carry survives.
  const nonzero = assertPath(0x05, true); // -> 0x04, Z clear
  assert.equal(nonzero.regs.f & F_Z, 0, "Z clear when result is nonzero");
  assert.equal(nonzero.regs.f & F_C, F_C, "carry-in preserved through dec into exit F");
  console.log("  PATH/flags: Z-on-zero set, Z-on-nonzero clear, carry-in preserved");
});

test("PATH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // Body charged 20 instead of 21 -> total no longer matches the oracle.
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.hl = TIMER;
    regs.decMem8(mem, regs.hl);
    m.step(0x1d8e, 20); // DROPPED: 21 -> 20
    m.ret(10);
  };
  const a = seed(0x05, false);
  const b = seed(0x05, false);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_1d8a(a);
  dropped(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  PATH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
