// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1e4a — sub_1dbd's rst-28 dispatch arm for
 * dispatcher-state 2 (0x6340 == 2): a once-per-frame COUNTDOWN of the state-2 hold
 * timer at 0x6341 that, on expiry, clears 0x6A30 and resets the dispatcher state
 * 0x6340 := 0. Armed to 0x40 (64) by state 1 (loc_1dc9 @0x1DC9), so one hold is
 * exactly 64 dispatches: 63 `ret nz` then one expiry.
 *
 * GATE — STRICT whole-machine (+ unit). loc_1e4a is ATOMIC (runs mask-cleared
 * inside the vblank NMI: entry_0066 -> ... -> loc_197a -> sub_1dbd -> here) and the
 * rewrite is byte-exact + total-preserving, so the strict byte-exact gate is the
 * right, stronger one — and it self-validates atomicity (a redistributed cycle
 * landing on a real mid-routine NMI would push the wrong PC and drift the stack).
 *
 * REACHABILITY — NATURAL DISPATCH, no tape/poke needed. In a plain-boot attract run
 * loc_1e4a dispatches 64x over frames 1138..1201 (measured): 63 ret-nz arms + one
 * expiry at frame 1201. So the whole-machine gate exercises BOTH arms naturally over
 * a 1210-frame window. The two branch arms are additionally pinned by a captured-
 * entry test (ret-nz as captured, counter=64; expiry synthesised by setting the
 * timer to 1) that asserts EQUAL *and* each arm's exact oracle CYCLE TOTAL — the
 * mandatory pin for a collapsed routine.
 *
 * Jobs: EQUAL (whole-machine over 64 dispatches + unit); TEETH (a wrong countdown
 * write is CAUGHT, naming 0x6341, whole-machine + unit; a wrong expiry reset of
 * 0x6340 is CAUGHT; a dropped cycle charge yields a wrong per-arm total and is
 * CAUGHT); BRANCH + CYCLE COVERAGE for both arms.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1e4a as translated_1e4a } from "../../translated/state0.js";
import { loc_1e4a as optimized_1e4a } from "../loc_1e4a.js";
import { Machine } from "../../machine.js";
import {
  unitEquivalence,
  wholeMachineEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1e4a;
const COUNTDOWN = 0x6341; // the state-2 hold timer this routine decrements
const DISPATCH_STATE = 0x6340; // sub_1dbd's router index; reset to 0 on expiry
const PARAM_6A30 = 0x6a30; // param-block byte cleared on expiry
const FRAMES = 1210; // covers the natural 64-dispatch window (frames 1138..1201) + tail
const MAX_FRAMES = 1150; // first dispatch is frame 1138

// Plain-boot attract: no input tape, no poke — loc_1e4a dispatches naturally.
function makeMachine(overrides) {
  return new Machine(ROM, overrides ? { overrides } : {});
}

// -- EQUAL --------------------------------------------------------------------

test("EQUAL (whole-machine): idiomatic optimized loc_1e4a matches translated every frame", () => {
  const r = wholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, optimized_1e4a]]));

  // The override must actually have run, or EQUAL would be vacuous — and it must
  // cover BOTH arms (63 ret-nz + 1 expiry = 64 dispatches in this window).
  assert.ok(
    r.invocations.get(TARGET) >= 2,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `diverged at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  assert.equal(r.framesCompared, FRAMES);
  console.log(
    `  EQUAL/whole: ${r.framesCompared} frames identical, override fired ` +
      `${r.invocations.get(TARGET)}x (natural attract, both arms: ret-nz + expiry)`,
  );
});

test("EQUAL (unit): idiomatic optimized loc_1e4a matches translated in RAM + registers", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_1e4a, optimized_1e4a, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, SP) + pc identical (first entry: frame 1138)");
});

// -- TEETH (value) ------------------------------------------------------------

/**
 * Deliberately-broken twin: behaviourally optimized_1e4a EXCEPT the countdown
 * write to 0x6341 lands a wrong value (correct byte XOR 0xFF). 0x6341 is genuine
 * work RAM read back next frame (no forcing poke masks it in this attract run), so
 * the corruption persists into the compared trace.
 */
function broken_countdownWrite(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === COUNTDOWN) {
      broke = true;
      return realWrite(addr, value ^ 0xff, busOffset);
    }
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_1e4a(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

test("TEETH (whole-machine): a wrong countdown write is CAUGHT and NOT-EQUAL", () => {
  const r = wholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, broken_countdownWrite]]));

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "harness FAILED to catch a wrong countdown write — it is worthless");
  assert.equal(typeof r.frame, "number");
  assert.ok(r.addr != null, "a caught divergence must name an address");
  console.log(
    `  TEETH/whole: caught at frame ${r.frame}, addr 0x${r.addr.toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
});

test("TEETH (unit): a wrong countdown write is CAUGHT and names 0x6341", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_1e4a, broken_countdownWrite, { maxFrames: MAX_FRAMES });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong countdown write — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    COUNTDOWN,
    `expected first diff at 0x${COUNTDOWN.toString(16)}, got 0x${(r.ram.addr ?? 0).toString(16)}`,
  );
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});

// -- BRANCH + CYCLE COVERAGE --------------------------------------------------

// Capture the pristine machine state at loc_1e4a's FIRST dispatch (frame 1138),
// via the same construction-time snapshot the core unit gate uses. On this entry
// the timer 0x6341 == 0x40 (64) and 0x6340 == 2.
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1e4a(mm); // let the host run proceed to a clean stop
  }]]);
  const host = makeMachine(snap);
  host.runFrames(MAX_FRAMES);
  if (entry === null) throw new Error(`loc_1e4a never dispatched within ${MAX_FRAMES} frames`);
  return entry;
}

/** Run oracle vs optimized on two clones of `entry` and assert EQUAL + cycle total. */
function assertArm(label, entry, mutate, expectTotal, after) {
  const a = entry.clone(); // translated
  const b = entry.clone(); // optimized
  if (mutate) { mutate(a); mutate(b); }

  const cA0 = a.cycles, cB0 = b.cycles;
  translated_1e4a(a);
  optimized_1e4a(b);
  const dA = a.cycles - cA0, dB = b.cycles - cB0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)} (${ram.a} vs ${ram.b})` : "");
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg} (${regs.a} vs ${regs.b})` : "");
  assert.equal(a.pc, b.pc, `${label}: pc must match`);
  // The collapsed arm must reproduce the oracle's TOTAL cycle cost exactly.
  assert.equal(dB, dA, `${label}: cycle-total mismatch (oracle ${dA} vs collapsed ${dB})`);
  assert.equal(dA, expectTotal, `${label}: oracle total is ${dA}, expected ${expectTotal}`);
  if (after) after(a, b);
  console.log(`  BRANCH+CYCLE/${label}: EQUAL (RAM+regs+pc), cycle total ${dA} == ${dB}`);
}

test("BRANCH + CYCLE COVERAGE: ret-nz arm (timer > 0) EQUAL incl. collapsed total 32 t", () => {
  const entry = captureEntry();
  assert.equal(entry.mem.read8(DISPATCH_STATE), 0x02, "captured entry must be in dispatcher-state 2");
  assert.equal(entry.mem.read8(COUNTDOWN), 0x40, "captured entry timer must be armed to 0x40");
  assertArm("ret-nz", entry, null, 32, (a, b) => {
    assert.equal(a.mem.read8(COUNTDOWN), 0x3f, "timer decremented 0x40 -> 0x3f");
    assert.equal(a.mem.read8(DISPATCH_STATE), 0x02, "state unchanged (still 2) on ret-nz");
    assert.equal(b.mem.read8(COUNTDOWN), 0x3f, "optimized: timer decremented 0x40 -> 0x3f");
    assert.equal(b.mem.read8(DISPATCH_STATE), 0x02, "optimized: state unchanged on ret-nz");
  });
});

test("BRANCH + CYCLE COVERAGE: expiry arm (timer == 1 -> 0) EQUAL incl. collapsed total 66 t, both bytes cleared", () => {
  const entry = captureEntry();
  const setTimerToOne = (mm) => mm.mem.write8(COUNTDOWN, 0x01); // synthesise the expiry arm
  assertArm("expiry", entry, setTimerToOne, 66, (a, b) => {
    assert.equal(a.mem.read8(COUNTDOWN), 0x00, "timer decremented 1 -> 0 (expired)");
    assert.equal(a.mem.read8(DISPATCH_STATE), 0x00, "dispatcher reset to 0 (idle) on expiry");
    assert.equal(a.mem.read8(PARAM_6A30), 0x00, "0x6A30 cleared on expiry");
    assert.equal(a.regs.a, 0x00, "A := 0 (xor a) on expiry");
    assert.equal(b.mem.read8(DISPATCH_STATE), 0x00, "optimized: dispatcher reset to 0 on expiry");
    assert.equal(b.mem.read8(PARAM_6A30), 0x00, "optimized: 0x6A30 cleared on expiry");
  });
});

// -- TEETH (expiry-specific reset + cycles) -----------------------------------

/** Twin that fails to reset 0x6340 on expiry (leaves it at 2) — must be CAUGHT. */
function broken_noStateReset(m) {
  const { regs, mem } = m;
  regs.hl = COUNTDOWN;
  const remaining = regs.dec8(mem.read8(COUNTDOWN));
  mem.write8(COUNTDOWN, remaining);
  if (remaining !== 0) { m.step(0x1e4e, 21); m.ret(11); return; }
  regs.xor(regs.a);
  mem.write8(PARAM_6A30, regs.a);
  // BUG: the `ld (0x6340),a` reset is dropped — the dispatcher stays in state 2.
  m.step(0x1e56, 56);
  m.ret(10);
}

test("TEETH (expiry reset): a twin that skips the 0x6340 reset is CAUGHT and names 0x6340", () => {
  const entry = captureEntry();
  const a = entry.clone(); const b = entry.clone();
  a.mem.write8(COUNTDOWN, 0x01); b.mem.write8(COUNTDOWN, 0x01);
  translated_1e4a(a);
  broken_noStateReset(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.ok(ram != null, "gate FAILED to catch a missing dispatcher reset — it is worthless");
  assert.equal(ram.addr, DISPATCH_STATE, `expected diff at 0x${DISPATCH_STATE.toString(16)}, got 0x${(ram.addr ?? 0).toString(16)}`);
  assert.equal(ram.a, 0x00, "oracle reset 0x6340 to 0");
  assert.equal(ram.b, 0x02, "broken twin left 0x6340 at 2");
  console.log(`  TEETH/expiry-reset: caught at 0x${ram.addr.toString(16)} (oracle ${ram.a} vs broken ${ram.b})`);
});

test("TEETH (cycles): a dropped charge yields a wrong per-arm total and is CAUGHT (both arms)", () => {
  const entry = captureEntry();
  for (const { name, timer } of [{ name: "ret-nz", timer: null }, { name: "expiry", timer: 0x01 }]) {
    const a = entry.clone(); const b = entry.clone();
    if (timer != null) { a.mem.write8(COUNTDOWN, timer); b.mem.write8(COUNTDOWN, timer); }
    const cA0 = a.cycles, cB0 = b.cycles;
    translated_1e4a(a);
    // Same behaviour as optimized, but each block charge is 5 t short.
    (function cyclebroken(m) {
      const { regs, mem } = m;
      regs.hl = COUNTDOWN;
      const remaining = regs.dec8(mem.read8(COUNTDOWN));
      mem.write8(COUNTDOWN, remaining);
      if (remaining !== 0) { m.step(0x1e4e, 16); m.ret(11); return; } // DROPPED 5 t (21 -> 16)
      regs.xor(regs.a);
      mem.write8(PARAM_6A30, regs.a);
      mem.write8(DISPATCH_STATE, regs.a);
      m.step(0x1e56, 51); m.ret(10); // DROPPED 5 t (56 -> 51)
    })(b);
    const dA = a.cycles - cA0, dB = b.cycles - cB0;
    assert.notEqual(dB, dA, `${name}: cycle-total assertion has no teeth`);
    console.log(`  TEETH/cycles/${name}: oracle ${dA} t vs dropped-charge ${dB} t — caught`);
  }
});
