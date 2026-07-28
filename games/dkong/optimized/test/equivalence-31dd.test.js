// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_31dd -- the three-part gated write at ROM 0x31DD that
 * stores 2 to SCRATCH_6439 and SCRATCH_6479 iff DIFFICULTY(0x6380) is in the
 * fall-through window AND sub_31f6's RANDOM/FRAME verdict is 1. See
 * optimized/sub_31dd.js for the full behaviour block.
 *
 * COLLAPSED (atomic): Block A `ld a,(0x6380)+cp 0x03` folds to one m.step (20 t);
 * Block W the six writing/loading ops fold to one m.step (48 t). The CALL boundary
 * (push16 + 17 t + m.call), both `cp`, and every `ret` are kept verbatim.
 *
 * GATE -- MEASURED ATOMIC, so the STRICT byte-exact whole-machine gate is the right
 * license (no convergent gate). Probed over 1400 attract frames: sub_31dd is
 * dispatched 266x (first ~f870, deep in loc_197a's NMI object cascade), io.nmiMask==0
 * at 266/266 dispatches (every call INSIDE the NMI, mask cleared -> cannot re-enter),
 * and the NMI's pushed PC lands in [0x31DD,0x31F5] 0x over 1394 NMIs (and 0x anywhere
 * in the 0x3000-0x34FF chain). Atomic + total-preserving => byte-exact.
 *
 * Jobs: STRICT whole-machine EQUAL (+ invocation proof) and its cycle-total teeth;
 * UNIT EQUAL on the natural first entry (arm1) and a behavioural teeth; FULL-BRANCH
 * coverage of all three arms from crafted identical-both-sides seeds (attract only
 * reaches arm1) -- each EQUAL over RAM+regs+pc+SP AND pinned to the oracle cycle
 * total -- plus the SIGNED `ret m` proof (DIFFICULTY=0x83, where `ret m` bails but
 * `ret c` would not) with a `ret c` twin CAUGHT, and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_31dd as translated_31dd } from "../../translated/state0.js";
import { sub_31dd as optimized_31dd } from "../sub_31dd.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x31dd;
const FRAMES_WHOLE = 1400; // ~266 dispatches, all arm1 (attract runs DIFFICULTY 0-2)
const FRAMES_UNIT = 1000; // must run past the ~f870 first dispatch to capture it
const RET_ADDR = 0x4d17; // sentinel caller-return frame for crafted entries

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC, no convergent gate) --

test("STRICT (whole-machine): sub_31dd is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_31dd]]));
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

test("STRICT-TEETH (cycles): a dropped Block-A charge forks the trajectory and is CAUGHT", () => {
  // Block A's total (20 t) is load-bearing: it feeds every one of the 266 dispatches.
  // Charging 19 t shifts the frame's cycle budget -> the spin count 0x6019 (PRNG
  // entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x6380);
    regs.cp(0x03);
    m.step(0x31e2, 19); // DROPPED: the correct Block-A total is 20 t
    if (regs.fM) { m.ret(11); return; }
    m.step(0x31e3, 5);
    m.push16(0x31e6);
    m.step(0x31f6, 17);
    m.call(0x31f6);
    regs.cp(0x01);
    m.step(0x31e8, 7);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x31e9, 5);
    mem.write8(0x6439, 0x02); mem.write8(0x6479, 0x02);
    regs.hl = 0x6479; regs.a = 0x02;
    m.step(0x31f5, 48);
    m.ret();
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- arm1, ret m) --------------------------------

/** Capture the pristine machine the instant sub_31dd is first entered (via m.call,
 *  deep in the NMI cascade). The snapshot override is wired at CONSTRUCTION so it
 *  fires however the routine is reached, then delegates to the oracle to proceed. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_31dd(mm);
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
  translated_31dd(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic sub_31dd matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_31dd);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural arm1 entry)");
});

test("TEETH (unit behavioural): a twin that forgets to bail on `ret m` is CAUGHT", () => {
  // The natural first entry takes arm1 (DIFFICULTY 0-2 -> `ret m` bails). A twin that
  // drops that bail keeps running -- calls sub_31f6, re-flags, maybe writes -- so its
  // regs/pc/SP diverge from the oracle's early return.
  const broken_noBail = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x6380);
    regs.cp(0x03);
    m.step(0x31e2, 20);
    // BUG: no `if (regs.fM) { m.ret(11); return; }` -- always falls through.
    m.step(0x31e3, 5);
    m.push16(0x31e6);
    m.step(0x31f6, 17);
    m.call(0x31f6);
    regs.cp(0x01);
    m.step(0x31e8, 7);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x31e9, 5);
    mem.write8(0x6439, 0x02); mem.write8(0x6479, 0x02);
    regs.hl = 0x6479; regs.a = 0x02;
    m.step(0x31f5, 48);
    m.ret();
  };
  const r = runBoth(NATURAL_ENTRY, broken_noBail);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a dropped `ret m` bail -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${!r.pcEqual ? "pc" : !r.spEqual ? "SP" : r.regs ? r.regs.reg : "ram"} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides seeds: all 3 arms) ------

/**
 * Fresh machine with a valid stack (a sentinel caller-return frame) and RAM poked so
 * the routine's OWN gate + the real sub_31f6 drive it down the chosen arm (the decompiler-pipeline doc
 * pattern 3), applied to both oracle and optimized clones through the same seed:
 *   - DIFFICULTY<3 or >=0x83                  -> arm1 `ret m` bail
 *   - DIFFICULTY in [3,0x82], RANDOM&3 != 1   -> arm2 `ret nz` (verdict 0/2/3)
 *   - DIFFICULTY in [3,0x82], RANDOM&3==1 & FRAME==1 -> arm3 write (verdict 1)
 */
function seed(pokes) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // sub_31dd's own caller-return frame
  const entrySP = m.regs.sp;
  for (const [a, v] of pokes) m.mem.write8(a, v);
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total: optimized must equal the oracle, and (as a regression guard) the oracle
 *  total must equal the structural constant `expectCycles`. */
function assertArm(label, pokes, expectCycles, checkWrites = false) {
  const a = seed(pokes);
  const b = seed(pokes);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_31dd(a.m);
  optimized_31dd(b.m);
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
  assert.equal(b.m.regs.sp, a.entrySP + 2, `${label}: stack balanced (caller frame consumed)`);
  if (checkWrites) {
    assert.equal(b.m.mem.read8(0x6439), 0x02, `${label}: SCRATCH_6439 must be 2`);
    assert.equal(b.m.mem.read8(0x6479), 0x02, `${label}: SCRATCH_6479 must be 2`);
  }
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
    `${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): arm1 `ret m` -- DIFFICULTY=0 (bail, no write)", () => {
  assertArm("arm1-retm(D=0)", [[0x6380, 0x00]], 31);
});

test("BRANCH (unit): arm1 SIGNED `ret m` -- DIFFICULTY=0x83 (bail where `ret c` would NOT)", () => {
  assertArm("arm1-retm(D=0x83)", [[0x6380, 0x83]], 31);
});

test("BRANCH (unit): arm2 `ret nz` -- DIFFICULTY=4, RANDOM&3=0 (verdict != 1, no write)", () => {
  assertArm("arm2-retnz", [[0x6380, 0x04], [0x6018, 0x00]], 98);
});

test("BRANCH (unit): arm3 write -- DIFFICULTY=4, RANDOM&3=1 & FRAME=1 (verdict 1)", () => {
  assertArm("arm3-write", [[0x6380, 0x04], [0x6018, 0x01], [0x601a, 0x01]], 167, true);
});

test("BRANCH-TEETH (signed): a `ret c` twin does NOT bail at DIFFICULTY=0x83 and is CAUGHT", () => {
  // The load-bearing signed distinction: at DIFFICULTY=0x83, (A-3)=0x80 -> SIGN set
  // (ret m bails) but CARRY CLEAR (ret c would fall through into the call). Seed the
  // fall-through to reach the WRITE arm (RANDOM&3=1 & FRAME=1), so the twin STORES to
  // SCRATCH_6439/6479 where the oracle bails untouched -- a RAM divergence the gate
  // must catch. (Both still return to RET_ADDR; the tell is the writes + registers.)
  const retc_twin = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x6380);
    regs.cp(0x03);
    m.step(0x31e2, 20);
    if (regs.fC) { m.ret(11); return; } // BUG: carry instead of sign
    m.step(0x31e3, 5);
    m.push16(0x31e6);
    m.step(0x31f6, 17);
    m.call(0x31f6);
    regs.cp(0x01);
    m.step(0x31e8, 7);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x31e9, 5);
    mem.write8(0x6439, 0x02); mem.write8(0x6479, 0x02);
    regs.hl = 0x6479; regs.a = 0x02;
    m.step(0x31f5, 48);
    m.ret();
  };
  const pokes = [[0x6380, 0x83], [0x6018, 0x01], [0x601a, 0x01]];
  const a = seed(pokes);
  const b = seed(pokes);
  translated_31dd(a.m);
  retc_twin(b.m);
  const differs =
    a.m.pc !== b.m.pc ||
    a.m.regs.sp !== b.m.regs.sp ||
    firstRegDiff(a.m.regs, b.m.regs) != null ||
    firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off)) != null;
  assert.ok(differs, "gate FAILED to catch `ret c` masquerading as `ret m` -- the signed test is toothless");
  assert.equal(a.m.regs.a, 0x83, "oracle bails at 0x83 via `ret m` (A untouched)");
  assert.equal(a.m.mem.read8(0x6439), 0x00, "oracle wrote nothing (it bailed)");
  assert.equal(b.m.mem.read8(0x6439), 0x02, "the `ret c` twin fell through and wrongly wrote SCRATCH_6439");
  console.log(`  BRANCH-TEETH/signed: caught -- oracle A=0x${a.m.regs.a.toString(16)} no-write vs ret-c twin wrote 2`);
});

test("BRANCH-TEETH (cycles): a dropped Block-W charge yields a wrong total and is CAUGHT", () => {
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x6380);
    regs.cp(0x03);
    m.step(0x31e2, 20);
    if (regs.fM) { m.ret(11); return; }
    m.step(0x31e3, 5);
    m.push16(0x31e6);
    m.step(0x31f6, 17);
    m.call(0x31f6);
    regs.cp(0x01);
    m.step(0x31e8, 7);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x31e9, 5);
    mem.write8(0x6439, 0x02); mem.write8(0x6479, 0x02);
    regs.hl = 0x6479; regs.a = 0x02;
    m.step(0x31f5, 43); // DROPPED: the correct Block-W total is 48 t
    m.ret();
  };
  const a = seed([[0x6380, 0x04], [0x6018, 0x01], [0x601a, 0x01]]);
  const b = seed([[0x6380, 0x04], [0x6018, 0x01], [0x601a, 0x01]]);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_31dd(a.m);
  cyclebroken(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
