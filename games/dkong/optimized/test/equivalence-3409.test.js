// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_3409 -- the per-object frame-timer / animation advance
 * (down-count ix+0x15; on expiry reload to 2, inc the frame ix+0x07, and every 16th
 * advance TOGGLE bit 1 via `xor 0x02`). See optimized/sub_3409.js for the full block.
 *
 * COLLAPSED, per-arm total preserved EXACTLY (ARM1 66t, ARM2 119t, ARM3 168t). The
 * routine is a leaf with no hardware-latch write, and it is ATOMIC:
 *
 * REACHABILITY / GATE (measured, not assumed -- the oracle's "not yet wired /
 * callers untranslated" docstring is STALE). Probed over 1600 attract frames:
 *   - 267 dispatches (first ~frame 938) -> the strict whole-machine gate is
 *     non-vacuous and all three arms occur naturally (ARM1 178x, ARM2 45x, ARM3 44x).
 *   - io.nmiMask == 0 at 267/267 dispatches: it runs mask-cleared inside the vblank
 *     NMI (which cannot re-enter) and calls nothing.
 *   - the NMI's pushed PC never lands in [0x3409,0x342B] (0 of 1594 NMIs).
 * ATOMIC + total-preserving collapse => byte-exact => STRICT gate (not convergent).
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth;
 * UNIT EQUAL on the natural first entry (ARM 2, ix=0x6400) and its behavioural teeth;
 * FULL-BRANCH coverage of all three arms from crafted identical-both-sides entries
 * (EQUAL over RAM + full register file + pc + SP AND each arm's exact cycle TOTAL);
 * a toggle-vs-OR behavioural twin CAUGHT; and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_3409 as translated_3409 } from "../../translated/state0.js";
import { sub_3409 as optimized_3409 } from "../sub_3409.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x3409;
const FRAMES_WHOLE = 1600; // past the ~f938 first dispatch; ~267 invocations, all 3 arms
const FRAMES_UNIT = 1000; // the unit host must run past the first dispatch (~f938) to capture it

const RET_ADDR = 0x4d17; // sentinel caller-return address for crafted entries
const IX = 0x6400; // an object record in work RAM (writes to (ix+d) land in diffed RAM)

// -- WHOLE-MACHINE (strict, byte-exact -- ATOMIC, total-preserving collapse) --

test("STRICT (whole-machine): collapsed sub_3409 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_3409]]));
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

test("STRICT-TEETH (cycles): a wrong RMW charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is per-arm total-cycle preservation. Charging ARM 1's
  // collapsed block 55 t instead of 56 shifts the frame's cycle budget -> the spin
  // count 0x6019 (PRNG entropy) and where a later NMI's pushed PC lands -> divergence.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(R(0x15));
    if (regs.a !== 0) {
      regs.decMem8(mem, R(0x15));
      m.step(0x342b, 55); // DROPPED: correct ARM 1 block total is 56 t
      m.ret();
      return;
    }
    mem.write8(R(0x15), 0x02);
    regs.incMem8(mem, R(0x07));
    regs.a = mem.read8(R(0x07)) & 0x0f;
    regs.cp(0x0f);
    m.step(0x341e, 108);
    if (regs.fNZ) { m.ret(11); return; }
    regs.a = mem.read8(R(0x07));
    regs.xor(0x02);
    mem.write8(R(0x07), regs.a);
    m.step(0x3427, 50);
    m.ret();
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- measured to be the ARM 2 expired-ret arm, ix=0x6400) --

/** Capture the pristine machine the instant sub_3409 is first entered (via m.call,
 *  deep in the NMI object cascade). The snapshot override is wired at CONSTRUCTION so
 *  it fires however the routine is reached, then delegates to the oracle. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_3409(mm);
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
  translated_3409(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic sub_3409 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_3409);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural entry, ARM 2)");
});

test("TEETH (unit behavioural): a wrong sub-timer reload on the natural entry is CAUGHT", () => {
  // The natural first entry takes ARM 2 (expired: reload ix+0x15 to 2, inc ix+0x07,
  // ret nz). A twin that reloads to 0x03 instead of 0x02 diverges in RAM at (ix+0x15).
  const broken_reload = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(R(0x15));
    if (regs.a !== 0) { regs.decMem8(mem, R(0x15)); m.step(0x342b, 56); m.ret(); return; }
    mem.write8(R(0x15), 0x03); // BUG: oracle reloads 0x02
    regs.incMem8(mem, R(0x07));
    regs.a = mem.read8(R(0x07)) & 0x0f;
    regs.cp(0x0f);
    m.step(0x341e, 108);
    if (regs.fNZ) { m.ret(11); return; }
    regs.a = mem.read8(R(0x07));
    regs.xor(0x02);
    mem.write8(R(0x07), regs.a);
    m.step(0x3427, 50);
    m.ret();
  };
  const r = runBoth(NATURAL_ENTRY, broken_reload);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong sub-timer reload -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "RAM 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? r.regs.reg : "pc/sp"} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides entries: all 3 arms) ------

/**
 * Fresh machine with a valid stack (a sentinel caller-return frame) and an object
 * record at IX (0x6400, in work RAM so writes are diffed), poked to steer sub_3409
 * down the chosen arm -- applied identically to both oracle and optimized clones:
 *   - timer!=0                     -> ARM 1 (dec ix+0x15; ret)
 *   - timer=0, (frame+1)&0xf != 0xf -> ARM 2 (reload; inc; ret nz)
 *   - timer=0, (frame+1)&0xf == 0xf -> ARM 3 (reload; inc; toggle bit 1)
 */
function seed({ timer, frame }) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // sub_3409's own caller-return frame
  const entrySP = m.regs.sp;
  m.regs.ix = IX;
  m.mem.write8((IX + 0x15) & 0xffff, timer);
  m.mem.write8((IX + 0x07) & 0xffff, frame);
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total: optimized must equal the oracle, and the oracle total must equal the
 *  structural constant `expectCycles` (a regression guard on the collapse arithmetic). */
function assertArm(label, seedArgs, expectCycles) {
  const a = seed(seedArgs);
  const b = seed(seedArgs);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_3409(a.m);
  optimized_3409(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  assert.equal(b.m.pc, RET_ADDR, `${label}: must return to the caller sentinel`);
  assert.equal(b.m.regs.sp, a.entrySP + 2, `${label}: stack must be balanced (caller frame consumed)`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
    `${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): ARM 1 -- sub-timer != 0 -> dec (ix+0x15); ret", () => {
  assertArm("timer-dec", { timer: 0x05, frame: 0x00 }, 66);
});

test("BRANCH (unit): ARM 2 -- timer==0, nibble != 0xF -> reload; inc; ret nz", () => {
  assertArm("expired-ret", { timer: 0x00, frame: 0x00 }, 119); // frame 0x00 -> inc 0x01, nibble 0x01
});

test("BRANCH (unit): ARM 3 -- timer==0, nibble == 0xF -> reload; inc; toggle bit 1", () => {
  assertArm("expired-toggle", { timer: 0x00, frame: 0x0e }, 168); // frame 0x0e -> inc 0x0f, nibble 0x0f
});

test("BRANCH-TEETH (behavioural): a `set`/OR twin instead of the `xor 0x02` TOGGLE is CAUGHT", () => {
  // ARM 3 with frame 0x0e -> inc -> 0x0f (bit 1 SET). The oracle's `xor 0x02` TOGGLES
  // bit 1 -> 0x0d. A twin that reads it as `or 0x02` (a set) leaves 0x0f -- RAM differs.
  const broken_orNotXor = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(R(0x15));
    if (regs.a !== 0) { regs.decMem8(mem, R(0x15)); m.step(0x342b, 56); m.ret(); return; }
    mem.write8(R(0x15), 0x02);
    regs.incMem8(mem, R(0x07));
    regs.a = mem.read8(R(0x07)) & 0x0f;
    regs.cp(0x0f);
    m.step(0x341e, 108);
    if (regs.fNZ) { m.ret(11); return; }
    regs.a = mem.read8(R(0x07));
    regs.or(0x02); // BUG: oracle TOGGLES with xor (0x0f -> 0x0d), or leaves 0x0f
    mem.write8(R(0x07), regs.a);
    m.step(0x3427, 50);
    m.ret();
  };
  const a = seed({ timer: 0x00, frame: 0x0e });
  const b = seed({ timer: 0x00, frame: 0x0e });
  translated_3409(a.m);
  broken_orNotXor(b.m);
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.ok(ram != null || regs != null, "gate FAILED to catch OR-instead-of-XOR -- it is worthless");
  assert.equal(a.m.mem.read8((IX + 0x07) & 0xffff), 0x0d, "oracle toggles bit 1: 0x0f -> 0x0d");
  assert.equal(b.m.mem.read8((IX + 0x07) & 0xffff), 0x0f, "broken OR twin leaves bit 1 set: 0x0f");
  console.log(`  BRANCH-TEETH/behavioural: caught -- oracle frame 0x0d vs OR-twin 0x0f`);
});

test("BRANCH-TEETH (cycles): a dropped charge on ARM 3 yields a wrong total and is CAUGHT", () => {
  const dropped = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(R(0x15));
    if (regs.a !== 0) { regs.decMem8(mem, R(0x15)); m.step(0x342b, 56); m.ret(); return; }
    mem.write8(R(0x15), 0x02);
    regs.incMem8(mem, R(0x07));
    regs.a = mem.read8(R(0x07)) & 0x0f;
    regs.cp(0x0f);
    m.step(0x341e, 108);
    if (regs.fNZ) { m.ret(11); return; }
    regs.a = mem.read8(R(0x07));
    regs.xor(0x02);
    mem.write8(R(0x07), regs.a);
    m.step(0x3427, 45); // DROPPED: correct ARM 3 tail total is 50 t
    m.ret();
  };
  const a = seed({ timer: 0x00, frame: 0x0e });
  const b = seed({ timer: 0x00, frame: 0x0e });
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_3409(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
