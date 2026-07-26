// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_33ad -- the two-arm object-field flag toggle at ROM
 * 0x33AD (interleaved with entry_33c3): on (ix+0x0d)==1 SET bit 7 of (ix+0x07) and
 * INC (ix+0x0e); else CLEAR bit 7 and DEC (ix+0x0e); then share the tail 0x33C0
 * (call sub_3409) and FALL THROUGH into entry_33c3, whose ret ends both. See
 * optimized/entry_33ad.js for the full behaviour block.
 *
 * COLLAPSED per basic block (prologue 26 t; ==1 arm 88 t; else arm 78 t), with the
 * call 0x3409 boundary and the entry_33c3 fall-through kept verbatim. Only `cp 0x01`
 * is a live flag (the `jp z` reads it); every other flag is dead before sub_3409's
 * `and a` and is dropped.
 *
 * REACHABILITY / GATE (measured, not assumed -- the oracle's "not yet wired" note is
 * STALE). loc_197a's NMI object cascade dispatches entry_33ad 204x over 1400 attract
 * frames (first ~frame 938). BOTH arms occur NATURALLY -- ==1 arm 103x, else arm
 * 101x -- so the whole-machine gate is non-vacuous AND covers both branches.
 * ATOMIC: io.nmiMask == 0 at 204/204 (every dispatch inside the vblank NMI, where
 * entry_0066 cleared the mask so it cannot re-enter; outside-NMI 0), and the NMI's
 * pushed PC never lands in [0x33AD,0x33E5] (0 landings over 1394 NMIs; none in the
 * 0x3000-0x34FF chain; all in the 0x02BD-0x0372 main-loop band). Atomic + exact
 * per-arm total => byte-exact, so the STRICT whole-machine gate is the license (no
 * convergent gate needed).
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth;
 * UNIT EQUAL on the natural first entry and its behavioural teeth; FULL-BRANCH
 * coverage of BOTH arms from crafted identical-both-sides pokes (EQUAL over
 * RAM+regs+pc+SP AND each arm's exact cycle TOTAL); and a dropped-charge cycle twin
 * CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_33ad as translated_33ad } from "../../translated/state0.js";
import { entry_33ad as optimized_33ad } from "../entry_33ad.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x33ad;
const FRAMES_WHOLE = 1400; // past the ~f938 first dispatch; ~204 invocations across BOTH arms
const FRAMES_UNIT = 1000; // the unit host must run past the first dispatch (~f938) to capture it

const RET_ADDR = 0x4d17; // sentinel caller-return address for crafted entries
const REC_BASE = 0x6300; // object record base (work RAM, no latch), IX for crafted entries

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC, no collapse hides) --

test("STRICT (whole-machine): entry_33ad is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_33ad]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic; both arms natural)`);
});

test("STRICT-TEETH (cycles): a wrong call charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging the shared
  // `call 0x3409` 16 t instead of 17 shifts every dispatch's cycle budget -> the
  // spin count 0x6019 (PRNG entropy) and where a later NMI's pushed PC lands -> the
  // byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    const rec = (off) => (regs.ix + off) & 0xffff;
    regs.a = mem.read8(rec(0x0d));
    regs.cp(0x01);
    m.step(0x33b2, 26);
    if (regs.fZ) {
      regs.a = mem.read8(rec(0x07)) | 0x80;
      mem.write8(rec(0x07), regs.a);
      mem.write8(rec(0x0e), (mem.read8(rec(0x0e)) + 1) & 0xff);
      m.step(0x33c0, 88);
    } else {
      regs.a = mem.read8(rec(0x07)) & 0x7f;
      mem.write8(rec(0x07), regs.a);
      mem.write8(rec(0x0e), (mem.read8(rec(0x0e)) - 1) & 0xff);
      m.step(0x33c0, 78);
    }
    m.push16(0x33c3);
    m.step(0x3409, 16); // DROPPED: the call is 17 t
    m.call(0x3409);
    return m.call(0x33c3);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant entry_33ad is first entered (via m.call,
 *  deep in the NMI cascade). The snapshot override is wired at CONSTRUCTION so it
 *  fires however the routine is reached, then delegates to the oracle so the host
 *  proceeds. The natural first entry takes the ELSE arm (measured, ~f938, ix=0x6400). */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_33ad(mm);
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
  translated_33ad(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic entry_33ad matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_33ad);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural entry)");
});

test("TEETH (unit behavioural): dropping the (ix+0x0e) step is CAUGHT", () => {
  // A twin that omits the counter RMW leaves (ix+0x0e) unstepped -- the byte the
  // oracle inc/dec'd -- so its work RAM diverges on either arm (the natural entry
  // is the else arm, which the oracle DECrements).
  const broken_noCounter = (m) => {
    const { regs, mem } = m;
    const rec = (off) => (regs.ix + off) & 0xffff;
    regs.a = mem.read8(rec(0x0d));
    regs.cp(0x01);
    m.step(0x33b2, 26);
    if (regs.fZ) {
      regs.a = mem.read8(rec(0x07)) | 0x80;
      mem.write8(rec(0x07), regs.a);
      m.step(0x33c0, 88); // BUG: inc (ix+0x0e) dropped
    } else {
      regs.a = mem.read8(rec(0x07)) & 0x7f;
      mem.write8(rec(0x07), regs.a);
      m.step(0x33c0, 78); // BUG: dec (ix+0x0e) dropped
    }
    m.push16(0x33c3);
    m.step(0x3409, 17);
    m.call(0x3409);
    return m.call(0x33c3);
  };
  const r = runBoth(NATURAL_ENTRY, broken_noCounter);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a dropped counter step -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? `ram@0x${(r.ram.addr ?? 0).toString(16)}` : !r.pcEqual ? "pc" : !r.spEqual ? "SP" : r.regs.reg} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides pokes: both arms) -------

/**
 * Fresh machine with a valid stack (a sentinel caller-return frame) and RAM poked so
 * entry_33ad takes the chosen arm, then falls through sub_3409 + entry_33c3 to a
 * DETERMINISTIC exit -- the sanctioned identical-both-sides poke, applied to both
 * oracle and optimized clones through the same seed:
 *   - (ix+0x0d)=1 -> ==1 arm (set bit 7, inc (ix+0x0e))
 *   - (ix+0x0d)=0 -> else arm (clear bit 7, dec (ix+0x0e))
 *   - (ix+0x15)=5 -> sub_3409 takes its short dec-and-ret path (timer nonzero)
 *   - BOARD(0x6227)=2 -> entry_33c3 early-rets (no entry_2333), so the tail is fixed
 */
function seed(arm) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // entry_33ad's caller-return frame (entry_33c3's ret pops it)
  const entrySP = m.regs.sp;
  m.regs.ix = REC_BASE;
  m.mem.write8(REC_BASE + 0x0d, arm === "eq1" ? 0x01 : 0x00);
  m.mem.write8(REC_BASE + 0x07, 0x05); // frame byte -> 0x85 (eq1) / 0x05 (else)
  m.mem.write8(REC_BASE + 0x0e, 0x40); // counter -> 0x41 (eq1) / 0x3f (else)
  m.mem.write8(REC_BASE + 0x15, 0x05); // sub_3409 timer nonzero -> short path
  m.mem.write8(0x6227, 0x02); // BOARD != 1 -> entry_33c3 early-rets
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total: optimized must equal the oracle, and (regression guard) the oracle total
 *  must equal the structural constant `expectCycles`. Totals include the shared
 *  callees sub_3409 (short path) + entry_33c3 (early-ret), which are identical both
 *  sides, so their contribution cancels in the optimized-vs-oracle comparison. */
function assertArm(label, arm, expectCycles) {
  const a = seed(arm);
  const b = seed(arm);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_33ad(a.m);
  optimized_33ad(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  // Every arm unwinds to the caller sentinel with the stack balanced.
  assert.equal(b.m.pc, RET_ADDR, `${label}: must fall through to the caller sentinel`);
  assert.equal(b.m.regs.sp, a.entrySP + 2, `${label}: stack must be balanced (caller frame consumed)`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
    `${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): ==1 arm -- (ix+0x0d)=1 sets bit 7 + inc (ix+0x0e)", () => {
  assertArm("eq1", "eq1", 228); // own 131 + sub_3409 short + entry_33c3 early-ret
});

test("BRANCH (unit): else arm -- (ix+0x0d)=0 clears bit 7 + dec (ix+0x0e)", () => {
  assertArm("else", "else", 218); // own 121 + sub_3409 short + entry_33c3 early-ret
});

test("BRANCH-TEETH (cycles): a dropped prologue charge yields a wrong total and is CAUGHT", () => {
  // Same behaviour as optimized, but the collapsed prologue is 1 t short -> the total
  // no longer matches the oracle. Uses the crafted ==1 seed so the arm is deterministic.
  const dropped = (m) => {
    const { regs, mem } = m;
    const rec = (off) => (regs.ix + off) & 0xffff;
    regs.a = mem.read8(rec(0x0d));
    regs.cp(0x01);
    m.step(0x33b2, 25); // DROPPED: the correct prologue total is 26 t
    if (regs.fZ) {
      regs.a = mem.read8(rec(0x07)) | 0x80;
      mem.write8(rec(0x07), regs.a);
      mem.write8(rec(0x0e), (mem.read8(rec(0x0e)) + 1) & 0xff);
      m.step(0x33c0, 88);
    } else {
      regs.a = mem.read8(rec(0x07)) & 0x7f;
      mem.write8(rec(0x07), regs.a);
      mem.write8(rec(0x0e), (mem.read8(rec(0x0e)) - 1) & 0xff);
      m.step(0x33c0, 78);
    }
    m.push16(0x33c3);
    m.step(0x3409, 17);
    m.call(0x3409);
    return m.call(0x33c3);
  };
  const a = seed("eq1");
  const b = seed("eq1");
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_33ad(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
