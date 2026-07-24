// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1fce -- the ANIMATION-DELAY TAIL of sub_1f72's object-slot
 * animator. It ticks an object's frame-delay counter (ix+0f); on expiry it flips the
 * animation-frame bit (ix+7) and reloads the counter to 4, then tail-jumps into the
 * shared object-sprite tail loc_21ba (`jp 0x21ba`, no push). See optimized/loc_1fce.js
 * for the full behaviour block.
 *
 * COLLAPSED: each arm folds its per-instruction m.steps into ONE charge placed at the
 * tail jump -- STEP 62 t, EXPIRY 114 t (the oracle's exact per-arm sums). The routine
 * writes only work RAM ((ix+0f)/(ix+7) are 0x67xx object-record bytes, NOT a hardware
 * latch) and its only control transfer is the terminal tail `jp` -- so the collapse is
 * licensed, and (being ATOMIC) it is proven byte-exact by the STRICT whole-machine gate.
 *
 * REACHABILITY / ATOMICITY (MEASURED -- probe over 1400 attract frames):
 *   - loc_1fce dispatches 393x (first entry frame 613, once the demo starts PLAYING 25m).
 *   - BOTH arms fire naturally: STEP (dec != 0) 295x, EXPIRY (dec == 0) 98x -> the strict
 *     gate is NON-vacuous over every arm.
 *   - ATOMIC: io.nmiMask == 0 at 393/393 dispatches (inside the NMI, mask cleared by
 *     entry_0066; outside-NMI 0). The NMI's pushed PC never lands in the body
 *     [0x1FCE,0x1FE2] -- 0 landings over 1394 NMIs, nor anywhere in the 0x1F72-0x21D0
 *     cascade; all land in the 0x02BD-0x0372 main-loop band + the thin 0x00xx/0x06xx tail.
 * So an atomic byte-exact collapse passes the STRICT whole-machine gate directly.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry (real loc_21ba tail) and its behavioural teeth;
 * FULL-BRANCH coverage of BOTH arms from crafted identical-both-sides pokes (EQUAL over
 * RAM + full register file + pc + SP AND each arm's exact cycle TOTAL, with the tail
 * loc_21ba stubbed identically on both sides to isolate loc_1fce's own contribution);
 * and cycle + behavioural teeth the gates CATCH.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1fce as translated_1fce } from "../../translated/state0.js";
import { loc_1fce as optimized_1fce } from "../loc_1fce.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1fce;
const TAIL = 0x21ba; // the shared object-sprite tail loc_1fce jp's into
const FRAMES_WHOLE = 1400; // past the ~f613 first dispatch; ~393 invocations across both arms
const FRAMES_UNIT = 650; // the unit host must run past the first dispatch (~f613) to capture it

const OBJ_BASE = 0x6700; // an object-record base in work RAM (sub_1f72's table base)
const RET_ADDR = 0x4d17; // sentinel caller-return frame for crafted entries

const STEP_TOTAL = 62; // ld(19)+dec(4)+jp nz taken(10)+ld(ix+0f),a(19)+jp(10)
const EXPIRY_TOTAL = 114; // +ld(ix+7)(19)+xor(7)+ld(ix+7),a(19)+ld a,0x04(7) instead of the jp-taken skip

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) --------------

test("STRICT (whole-machine): loc_1fce is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1fce]]));
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

test("STRICT-TEETH (cycles): a wrong per-arm total forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging the STEP arm 61 t
  // instead of 62 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG entropy)
  // and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    regs.a = regs.dec8(mem.read8((ix + 0x0f) & 0xffff));
    if (regs.fNZ) {
      mem.write8((ix + 0x0f) & 0xffff, regs.a);
      m.step(TAIL, 61); // DROPPED: 62 -> 61 on the STEP arm
      return m.call(TAIL);
    }
    regs.a = mem.read8((ix + 0x07) & 0xffff);
    regs.xor(0x01);
    mem.write8((ix + 0x07) & 0xffff, regs.a);
    regs.a = 0x04;
    mem.write8((ix + 0x0f) & 0xffff, regs.a);
    m.step(TAIL, 114);
    return m.call(TAIL);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry, real loc_21ba tail) ---------------------------

/** Capture the pristine machine the instant loc_1fce is first entered (via m.call, deep
 *  in sub_1f72's NMI scan). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1fce(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry` (real loc_21ba tail runs on both);
 *  report the diff. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1fce(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_1fce matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1fce);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural entry, real tail)");
});

test("TEETH (unit behavioural): dropping the (ix+0f) counter store is CAUGHT", () => {
  // loc_1fce ALWAYS writes (ix+0f) (decremented on STEP, reloaded 4 on EXPIRY), and the
  // loc_21ba tail never rewrites it -- so a twin that omits that store leaves the stale
  // pre-decrement value in RAM and the gate must catch it, whichever arm the natural
  // entry takes.
  const broken_dropStore = (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    regs.a = regs.dec8(mem.read8((ix + 0x0f) & 0xffff));
    if (regs.fNZ) {
      // BUG: the STEP arm's `ld (ix+0f),a` is dropped.
      m.step(TAIL, 62);
      return m.call(TAIL);
    }
    regs.a = mem.read8((ix + 0x07) & 0xffff);
    regs.xor(0x01);
    mem.write8((ix + 0x07) & 0xffff, regs.a);
    regs.a = 0x04;
    // BUG: the EXPIRY arm's `ld (ix+0f),a` is dropped too.
    m.step(TAIL, 114);
    return m.call(TAIL);
  };
  const r = runBoth(NATURAL_ENTRY, broken_dropStore);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a dropped counter store -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "ram@0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? r.regs.reg : !r.pcEqual ? "pc" : "SP"} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted pokes, tail stubbed identically both sides) --

// A no-op stub for the tail loc_21ba: charges nothing and writes nothing, so the crafted
// tests measure loc_1fce's OWN contribution (RAM writes, exit reg file, pc=0x21ba, SP,
// and the collapsed per-arm cycle total) in isolation. Installed on BOTH the oracle and
// the optimized machine, so the comparison stays fair. (The real tail is exercised by the
// whole-machine and natural-entry tests above.)
const TAIL_STUB = () => {};

/** Fresh machine with the tail stubbed, a sentinel caller frame, IX at an object record,
 *  and (ix+0f)/(ix+7) poked to steer the arm -- the sanctioned identical-both-sides seed. */
function seed(delayVal) {
  const m = new Machine(ROM, { overrides: new Map([[TAIL, TAIL_STUB]]) });
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // caller frame (loc_1fce does no push/ret, so SP must survive intact)
  const entrySP = m.regs.sp;
  m.regs.ix = OBJ_BASE;
  m.mem.write8((OBJ_BASE + 0x0f) & 0xffff, delayVal); // (ix+0f) the frame-delay counter
  m.mem.write8((OBJ_BASE + 0x07) & 0xffff, 0x55); // (ix+7) the animation-frame field (bit0 toggled)
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total: optimized must equal the oracle, and the oracle total must equal the structural
 *  constant `expectCycles`. */
function assertArm(label, delayVal, expectCycles, checkRam) {
  const a = seed(delayVal);
  const b = seed(delayVal);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1fce(a.m);
  optimized_1fce(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(b.m.pc, TAIL, `${label}: must land at the tail (0x21ba)`);
  assert.equal(b.m.regs.sp, a.entrySP, `${label}: SP unchanged (no push/ret in loc_1fce)`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  checkRam(b.m); // the arm actually did its writes
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
    `${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): STEP arm -- (ix+0f)=9 dec->8 (NZ), store 8, no frame flip", () => {
  assertArm("step", 0x09, STEP_TOTAL, (m) => {
    assert.equal(m.mem.read8(OBJ_BASE + 0x0f), 0x08, "step: (ix+0f) stored decremented (8)");
    assert.equal(m.mem.read8(OBJ_BASE + 0x07), 0x55, "step: (ix+7) untouched");
    assert.equal(m.regs.a, 0x08, "step: A = dec result (8)");
  });
});

test("BRANCH (unit): EXPIRY arm -- (ix+0f)=1 dec->0 (Z), flip (ix+7), reload (ix+0f)=4", () => {
  assertArm("expiry", 0x01, EXPIRY_TOTAL, (m) => {
    assert.equal(m.mem.read8(OBJ_BASE + 0x07), 0x54, "expiry: (ix+7) bit0 toggled (0x55->0x54)");
    assert.equal(m.mem.read8(OBJ_BASE + 0x0f), 0x04, "expiry: (ix+0f) reloaded to 4");
    assert.equal(m.regs.a, 0x04, "expiry: A = reload value (4)");
  });
});

test("BRANCH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // EXPIRY arm charged 113 t instead of 114 -> total no longer matches the oracle.
  const dropped = (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    regs.a = regs.dec8(mem.read8((ix + 0x0f) & 0xffff));
    if (regs.fNZ) {
      mem.write8((ix + 0x0f) & 0xffff, regs.a);
      m.step(TAIL, 62);
      return m.call(TAIL);
    }
    regs.a = mem.read8((ix + 0x07) & 0xffff);
    regs.xor(0x01);
    mem.write8((ix + 0x07) & 0xffff, regs.a);
    regs.a = 0x04;
    mem.write8((ix + 0x0f) & 0xffff, regs.a);
    m.step(TAIL, 113); // DROPPED: the correct EXPIRY total is 114 t
    return m.call(TAIL);
  };
  const a = seed(0x01);
  const b = seed(0x01);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1fce(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});

test("BRANCH-TEETH (behavioural): omitting the (ix+7) frame flip is CAUGHT", () => {
  // A twin that reloads the counter but forgets to store the toggled animation-frame bit
  // leaves (ix+7) stale -- the crafted EXPIRY seed makes it deterministic.
  const broken_noFlip = (m) => {
    const { regs, mem } = m;
    const ix = regs.ix;
    regs.a = regs.dec8(mem.read8((ix + 0x0f) & 0xffff));
    if (regs.fNZ) {
      mem.write8((ix + 0x0f) & 0xffff, regs.a);
      m.step(TAIL, 62);
      return m.call(TAIL);
    }
    regs.a = mem.read8((ix + 0x07) & 0xffff);
    regs.xor(0x01);
    // BUG: the `ld (ix+7),a` frame-flip store is dropped.
    regs.a = 0x04;
    mem.write8((ix + 0x0f) & 0xffff, regs.a);
    m.step(TAIL, 114);
    return m.call(TAIL);
  };
  const a = seed(0x01);
  const b = seed(0x01);
  translated_1fce(a.m);
  broken_noFlip(b.m);
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.notEqual(ram, null, "gate FAILED to catch an omitted frame flip -- it is worthless");
  assert.equal(a.m.mem.read8(OBJ_BASE + 0x07), 0x54, "oracle flipped (ix+7) to 0x54");
  assert.equal(b.m.mem.read8(OBJ_BASE + 0x07), 0x55, "broken twin left (ix+7) stale at 0x55");
  console.log(`  BRANCH-TEETH/behavioural: caught -- (ix+7) oracle 0x54 vs broken 0x55 (RAM diff at 0x${(ram.addr ?? 0).toString(16)})`);
});
