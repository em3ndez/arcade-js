// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_2b1c -- ROM 0x2B1C: ld ix,0x6200 ; call 0x2b29 (collision
 * probe, CALLER-SKIP) ; call 0x29af ; xor a ; ld b,a ; ret. See optimized/entry_2b1c.js
 * for the caller-skip contract, the flag decision (xor a kept), and the cycle plan
 * (skip arm 31 t byte-identical; normal arm 66 t with only the register-only xor-a/ld-b-a
 * pair collapsed to 8 t).
 *
 * REACHABILITY / ATOMICITY (measured -- the oracle's "not yet wired" docstring is STALE).
 * entry_2b1c dispatches 124x over 1300 attract frames (first ~frame 587, once the attract
 * demo is airborne on 25m). ALL 124 take the SKIP arm (entry_2b29 returns false); the
 * NORMAL arm is never reached in attract, so it is proven from crafted entries below. It is
 * ATOMIC: every entry is INSIDE the NMI (io.nmiMask==0: 124/124 in-NMI, 0 out-NMI), and the
 * NMI's pushed PC never lands in [0x2B1C,0x2B28] (0 landings). So the STRICT byte-exact
 * whole-machine gate is the right license (not the convergent gate).
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural (skip) entry and its behavioural teeth; FULL-BRANCH coverage of BOTH
 * arms from crafted entries (EQUAL over RAM+regs+pc+SP AND each arm's exact cycle TOTAL,
 * with the unreached NORMAL arm synthesized); and dropped-charge + behavioural teeth CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_2b1c as translated_2b1c } from "../../translated/state0.js";
import { entry_2b1c as optimized_2b1c } from "../entry_2b1c.js";
import { MARIO_ACTIVE } from "../ram.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2b1c;
const FRAMES_WHOLE = 720; // past the ~f587 first dispatch, teeth fork shortly after
const FRAMES_UNIT = 650; // the unit host must run past the first dispatch (~f587)

const RET_ADDR = 0x4d17; // sentinel caller return address for the crafted arms
const SKIP_CYCLES = 31; // ld ix (14) + call 0x2b29 (17)
const NORMAL_CYCLES = 66; // 14 + 17 + call 0x29af (17) + xor a (4) + ld b,a (4) + ret (10)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): idiomatic entry_2b1c is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_2b1c]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic; all skip arm)`);
});

test("STRICT-TEETH (cycles): a wrong SKIP-arm total forks the trajectory and is CAUGHT", () => {
  // The skip arm is byte-identical to the oracle, so its LOAD-BEARING invariant is the
  // total. Charging ld ix 13 t instead of 14 shifts the frame's cycle budget -> the spin
  // count 0x6019 (PRNG entropy) / a later NMI's pushed PC -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs } = m;
    regs.ix = MARIO_ACTIVE;
    m.step(0x2b20, 13); // DROPPED: 14 -> 13
    m.push16(0x2b23);
    m.step(0x2b29, 17);
    if (!m.call(0x2b29)) return;
    m.push16(0x2b26);
    m.step(0x29af, 17);
    m.call(0x29af);
    regs.xor(regs.a); regs.b = regs.a;
    m.step(0x2b28, 8);
    m.ret();
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- the SKIP arm, with the REAL callees) ----------

/** Capture the pristine machine the instant entry_2b1c is first entered (via m.call, deep
 *  in the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires however
 *  the routine is reached, then delegates to the oracle so the host run proceeds normally. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_2b1c(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry` (real callees via the registry);
 *  report the diff + contract. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_2b1c(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic entry_2b1c matches translated on the natural (skip) entry", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_2b1c);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log(`  EQUAL/unit: RAM + all registers (incl. F, IX, SP) + pc identical; ` +
    `skip unwound to pc=0x${r.b.pc.toString(16)}`);
});

test("TEETH (unit behavioural): a wrong IX base leaves IX wrong at exit and is CAUGHT", () => {
  // The natural entry already has IX==0x6200, so DROPPING the load would not diverge; a
  // WRONG base does. entry_2b29 addresses absolute RAM (not IX), so control flow is
  // unchanged and only the preserved exit IX differs -> caught by the register diff.
  const broken_wrongIx = (m) => {
    const { regs } = m;
    regs.ix = 0x6300; // BUG: wrong record base
    m.step(0x2b20, 14);
    m.push16(0x2b23);
    m.step(0x2b29, 17);
    if (!m.call(0x2b29)) return;
    m.push16(0x2b26);
    m.step(0x29af, 17);
    m.call(0x29af);
    regs.xor(regs.a); regs.b = regs.a;
    m.step(0x2b28, 8);
    m.ret();
  };
  const r = runBoth(NATURAL_ENTRY, broken_wrongIx);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong IX base -- it is worthless");
  console.log(`  TEETH/unit: caught -- reg diff at ${r.regs ? r.regs.reg : "(ram/pc)"}`);
});

// -- FULL-BRANCH COVERAGE (crafted entries: SKIP + synthesized NORMAL) ----------

/**
 * Fresh machine with a sentinel return frame and the two callees replaced by ZERO-cycle
 * stubs, so each arm's measured delta is entry_2b1c's OWN cycle total (callee-free). The
 * stubs model only the callees' STACK effect (not their logic), and are installed on BOTH
 * the oracle and optimized machines, so the comparison stays exactly oracle-vs-optimized.
 *   - SKIP: entry_2b29 does `pop hl` (discard our 0x2b23) + `ret` (pop the sentinel) ->
 *     sp += 4, pc := sentinel, returns false.
 *   - NORMAL: entry_2b29's `ret z` pops our 0x2b23 (sp += 2) and returns true; sub_29af's
 *     `ret` pops our 0x2b26 (sp += 2). entry_2b1c's own `ret` then pops the sentinel.
 */
function seed(arm) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // entry_2b1c's return frame
  const entrySP = m.regs.sp;
  m.regs.a = 0xee; // non-zero so `xor a` -> 0 is a real change on the normal arm
  m.regs.b = 0x99; // non-zero so a dropped `ld b,a` is observable on the normal arm
  if (arm === "skip") {
    m.routines.set(0x2b29, (mm) => { mm.regs.sp = (mm.regs.sp + 4) & 0xffff; mm.pc = RET_ADDR; return false; });
  } else {
    m.routines.set(0x2b29, (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; return true; });
    m.routines.set(0x29af, (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; });
  }
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle total
 *  against the oracle and the structural constant `expectCycles`. */
function assertArm(label, arm, expectCycles) {
  const a = seed(arm);
  const b = seed(arm);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2b1c(a.m);
  optimized_2b1c(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, "pc must match");
  assert.equal(a.m.regs.sp, b.m.regs.sp, "SP must match");
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, A=${b.m.regs.a}, ` +
    `B=${b.m.regs.b}, IX=0x${b.m.regs.ix.toString(16)}, ${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): SKIP arm -- entry_2b29 returns false -> propagate the unwind (31 t)", () => {
  assertArm("skip", "skip", SKIP_CYCLES);
  const { m } = seed("skip");
  optimized_2b1c(m);
  assert.equal(m.pc, RET_ADDR, "skip arm ends at the caller (unwound by entry_2b29)");
  assert.equal(m.regs.ix, MARIO_ACTIVE, "skip arm still set IX before the probe");
});

test("BRANCH (unit): NORMAL arm -- entry_2b29 ret z -> call 0x29af, A=0, B=0, ret (66 t)", () => {
  assertArm("normal", "normal", NORMAL_CYCLES);
  const { m, entrySP } = seed("normal");
  optimized_2b1c(m);
  assert.equal(m.pc, RET_ADDR, "normal arm returns to the sentinel");
  assert.equal(m.regs.sp, entrySP + 2, "normal arm pops exactly one frame");
  assert.equal(m.regs.a, 0, "normal arm returns A=0");
  assert.equal(m.regs.b, 0, "normal arm returns B=0");
  assert.equal(m.regs.f, 0x44, "normal arm exit F is xor-a's result (Z=1,PV=1)");
});

test("BRANCH-TEETH (behavioural): dropping `ld b,a` leaves B wrong on the normal arm and is CAUGHT", () => {
  const broken_noLdB = (m) => {
    const { regs } = m;
    regs.ix = MARIO_ACTIVE;
    m.step(0x2b20, 14);
    m.push16(0x2b23);
    m.step(0x2b29, 17);
    if (!m.call(0x2b29)) return;
    m.push16(0x2b26);
    m.step(0x29af, 17);
    m.call(0x29af);
    regs.xor(regs.a);
    // BUG: regs.b = regs.a dropped -- B keeps its seed value 0x99
    m.step(0x2b28, 8);
    m.ret();
  };
  const a = seed("normal");
  const b = seed("normal");
  translated_2b1c(a.m);
  broken_noLdB(b.m);
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.ok(regs != null, "unit gate FAILED to catch a dropped ld b,a -- it is worthless");
  console.log(`  BRANCH-TEETH/behavioural: caught -- reg diff at ${regs.reg}`);
});

test("BRANCH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // Normal arm charged 4 for the xor-a/ld-b-a block instead of 8 -> total 62 != oracle 66.
  const dropped = (m) => {
    const { regs } = m;
    regs.ix = MARIO_ACTIVE;
    m.step(0x2b20, 14);
    m.push16(0x2b23);
    m.step(0x2b29, 17);
    if (!m.call(0x2b29)) return;
    m.push16(0x2b26);
    m.step(0x29af, 17);
    m.call(0x29af);
    regs.xor(regs.a); regs.b = regs.a;
    m.step(0x2b28, 4); // DROPPED: 8 -> 4
    m.ret();
  };
  const a = seed("normal");
  const b = seed("normal");
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2b1c(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
