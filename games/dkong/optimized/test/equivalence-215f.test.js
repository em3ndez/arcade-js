// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_215f -- the object-dispatch branch at ROM 0x215F that
 * presets D=L+5, A=H, BC=0x0015, `call 0x216d` (the difficulty/RNG spawn gate), then
 * UNCONDITIONALLY `jp 0x21ba` into the shared object-sprite tail. See
 * optimized/loc_215f.js for the full behaviour block.
 *
 * COLLAPSE. The five straight-line loads (ld a,l / add a,0x05 / ld d,a / ld a,h /
 * ld bc,0x0015 = 4+7+4+4+10) fold into ONE m.step (29 t) at the block's exit PC
 * 0x2167. loc_215f writes NO memory, so there is no hardware-latch bus cycle to pin --
 * the block folds flat. The CALL and the JP are control-transfer boundaries kept
 * verbatim (push16 0x216a + step 0x216d,17 + call ; step 0x21ba,10 + call). loc_215f
 * has no internal branch, so its OWN charge is a single 56 t total (29+17+10) on every
 * path; the arm difference lives entirely in the callees.
 *
 * GATE = STRICT whole-machine (MEASURED, not from prose). loc_215f is HOT and
 * ATTRACT-REACHABLE (132 dispatches / 1200 attract frames via m.call from shared_1ff6)
 * and ATOMIC: io.nmiMask==0 at 132/132 dispatches (NMI mask cleared, cannot re-enter)
 * and the NMI's pushed PC lands in [0x215F,0x216A] 0 times / 1194 NMIs. An atomic
 * routine whose collapse ALSO preserves the exact per-branch total is byte-exact, so it
 * passes the STRICT whole-machine gate directly (no convergent gate needed). That run
 * exercises BOTH callee arms NATURALLY: 101 hidden-exit (sub_236e cpir-miss splices to
 * 0x216A) + 31 normal-return (sub_216d's own ret to 0x216A) over the 132 invocations --
 * both reach the unconditional jp.
 *
 * Jobs: WHOLE-MACHINE STRICT EQUAL (+ invocation proof) and its cycle-total teeth
 * (a dropped block charge forks the PRNG / NMI pushed-PC); UNIT EQUAL on BOTH natural
 * arms (RAM + full register file + pc + SP) with each arm's collapsed cycle total pinned
 * (optimized delta == oracle delta); and UNIT teeth -- a behavioural twin that WRONGLY
 * guards the jp (the hidden-exit contract), a dropped-charge cycle twin, and a
 * wrong-register-value twin -- each CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_215f as translated_215f, sub_236e as translated_236e } from "../../translated/state0.js";
import { loc_215f as optimized_215f } from "../loc_215f.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x215f;
const FRAMES_WHOLE = 1200; // ~132 invocations across both arms (101 hidden-exit + 31 normal)
const FRAMES_UNIT = 900;   // past the first dispatch (~f586); reaches both arms with margin

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC + total-preserving) --

test("STRICT (whole-machine): loc_215f is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_215f]]));
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

test("STRICT-TEETH (cycles): a dropped prologue charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging the collapsed
  // block 28 t instead of 29 shifts the frame's cycle budget -> the spin count 0x6019
  // (PRNG entropy) and where a later NMI's pushed PC lands -> the byte-exact trace
  // diverges. Same behaviour as the optimized routine otherwise.
  const cyclebroken = (m) => {
    const { regs } = m;
    regs.a = regs.l; regs.add(0x05); regs.d = regs.a; regs.a = regs.h; regs.bc = 0x0015;
    m.step(0x2167, 28); // DROPPED: the correct collapsed prologue is 29 t
    m.push16(0x216a); m.step(0x216d, 17); m.call(0x216d);
    m.step(0x21ba, 10); return m.call(0x21ba);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural entries, BOTH callee arms) ---------------------------------

/**
 * Capture the pristine machine at the instant loc_215f is entered for the FIRST time on
 * EACH callee arm. The snapshot override is wired at CONSTRUCTION so it fires however the
 * routine is reached (loc_215f is entered only via m.call from shared_1ff6), clones the
 * entry, then delegates to the oracle so the host proceeds. A depth-flagged sub_236e
 * wrapper observes whether THIS invocation's cpir missed (hidden-exit) or matched
 * (normal-return), bucketing the clone accordingly.
 */
function captureArms(maxFrames = FRAMES_UNIT) {
  let entryMiss = null, entryNormal = null;
  let pending = null, sawMiss = false, depth = 0;
  const snap = new Map();
  snap.set(TARGET, (mm) => {
    const clone = mm.clone();
    pending = clone; sawMiss = false; depth++;
    try {
      return translated_215f(mm);
    } finally {
      depth--;
      if (sawMiss && entryMiss === null) entryMiss = pending;
      if (!sawMiss && entryNormal === null) entryNormal = pending;
    }
  });
  snap.set(0x236e, (mm) => {
    const r = translated_236e(mm);
    if (depth > 0 && r === false) sawMiss = true; // cpir miss -> sub_216d hidden-exit
    return r;
  });
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entryMiss === null || entryNormal === null) {
    throw new Error(
      `did not reach both arms in ${maxFrames} frames ` +
        `(miss=${!!entryMiss}, normal=${!!entryNormal})`,
    );
  }
  return { entryMiss, entryNormal };
}
const ARMS = ROM_PRESENT ? captureArms() : null;

/** Run oracle and `fn` on independent clones of `entry`; report diff + cycle deltas. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  const ca = a.cycles, cb = b.cycles;
  translated_215f(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    dA: a.cycles - ca,
    dB: b.cycles - cb,
    a, b,
  };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) and pin its collapsed total. */
function assertArmEqual(label, entry) {
  const r = runBoth(entry, optimized_215f);
  assert.equal(r.ram, null, r.ram ? `${label}: RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `${label}: reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, `${label}: pc must match`);
  assert.ok(r.spEqual, `${label}: SP must match`);
  assert.equal(r.dB, r.dA, `${label}: cycle total mismatch (oracle ${r.dA} t vs collapsed ${r.dB} t)`);
  console.log(`  EQUAL/${label}: RAM + all regs (incl. F, SP) + pc identical; ${r.dB} t == oracle ${r.dA} t`);
}

test("EQUAL (unit): hidden-exit arm -- sub_236e cpir-miss splices to 0x216A, jp still runs", () => {
  assertArmEqual("hidden-exit", ARMS.entryMiss);
});

test("EQUAL (unit): normal-return arm -- sub_216d's own ret to 0x216A, then jp", () => {
  assertArmEqual("normal-return", ARMS.entryNormal);
});

// -- UNIT TEETH ---------------------------------------------------------------

/**
 * Behavioural twin: WRONGLY treats `call 0x216d` as a caller-skip guard
 * (`if (!m.call(0x216d)) return;`), the entry_30ed idiom that does NOT apply here.
 * sub_216d ALWAYS returns a falsy value (false on the hidden-exit, undefined on a normal
 * ret), so guarding it always skips the unconditional `jp 0x21ba` -- loc_21ba's four
 * sprite-field writes (to the 0x6980-block buffer) never happen and pc/SP diverge. The
 * gate must catch this on BOTH arms; asserted on the hidden-exit arm (the natural first
 * entry).
 */
function broken_guardJp(m) {
  const { regs } = m;
  regs.a = regs.l; regs.add(0x05); regs.d = regs.a; regs.a = regs.h; regs.bc = 0x0015;
  m.step(0x2167, 29);
  m.push16(0x216a); m.step(0x216d, 17);
  if (!m.call(0x216d)) return; // BUG: the jp is unconditional -- must NOT be guarded
  m.step(0x21ba, 10); return m.call(0x21ba);
}

test("TEETH (unit behavioural): guarding the jp on 0x216d's boolean skips loc_21ba and is CAUGHT", () => {
  const r = runBoth(ARMS.entryMiss, broken_guardJp);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrongly-guarded jp -- it is worthless");
  console.log(`  TEETH/behavioural: caught -- ${!r.pcEqual ? "pc" : !r.spEqual ? "SP" : r.ram ? "RAM 0x" + (r.ram.addr ?? 0).toString(16) : r.regs.reg} diverged`);
});

test("TEETH (unit cycles): a dropped prologue charge yields a wrong per-arm total and is CAUGHT", () => {
  const cyclebroken = (m) => {
    const { regs } = m;
    regs.a = regs.l; regs.add(0x05); regs.d = regs.a; regs.a = regs.h; regs.bc = 0x0015;
    m.step(0x2167, 28); // DROPPED: correct collapsed prologue is 29 t
    m.push16(0x216a); m.step(0x216d, 17); m.call(0x216d);
    m.step(0x21ba, 10); return m.call(0x21ba);
  };
  const r = runBoth(ARMS.entryNormal, cyclebroken);
  assert.notEqual(r.dB, r.dA, "cycle-total assertion has no teeth");
  console.log(`  TEETH/cycles: oracle ${r.dA} t vs dropped-charge ${r.dB} t -- caught`);
});

test("TEETH (unit value): a wrong cpir key (A = H+1) diverges the spawn gate and is CAUGHT", () => {
  // A (= H) is the byte sub_236e's cpir hunts for at 0x6300. Corrupting it changes the
  // search result on both arms -> different RAM/registers. A pure wrong-VALUE twin, no
  // structural change.
  const valuebroken = (m) => {
    const { regs } = m;
    regs.a = regs.l; regs.add(0x05); regs.d = regs.a;
    regs.a = (regs.h + 1) & 0xff; // BUG: A should be H
    regs.bc = 0x0015;
    m.step(0x2167, 29);
    m.push16(0x216a); m.step(0x216d, 17); m.call(0x216d);
    m.step(0x21ba, 10); return m.call(0x21ba);
  };
  const r = runBoth(ARMS.entryMiss, valuebroken);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong cpir key -- it is worthless");
  console.log(`  TEETH/value: caught -- ${r.ram ? "RAM 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? r.regs.reg : "pc/SP"} diverged`);
});
