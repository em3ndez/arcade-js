// SPDX-License-Identifier: GPL-3.0-only
/**
 * enableInterruptAndEnterForegroundLoop — memory-equivalent to the frozen oracle at ROM 0x00A8.
 *
 * GATE: crafted-entry, with the foreground loop SEVERED on both arms — it never returns, so no
 *   arm of this file can run it. Plus a hardware-side comparison the state dump cannot make, plus
 *   teeth. What it exercises, holes stated:
 *
 *   1. ★ THE STATE DUMP IS BLIND TO THIS ENTRY, AND THAT IS THE HEADLINE. Both of its stores go
 *      to hardware, and the dump covers colour, character, work and sprite memory only. A RAM
 *      comparison therefore passes a candidate that does nothing, which the vacuity arm below
 *      MEASURES rather than assumes. The real contract is the latch bit, the watchdog, and the
 *      state handed to the loop — all three asserted here.
 *   2. ★ NO REAL CAPTURED DISPATCH IS COMPARED, because the routine does not come back: the one
 *      dispatch in a session enters the foreground loop and the rest of the session happens
 *      inside it. Every arm below therefore runs against a captured machine with the loop
 *      replaced by a recorder, identically on both sides. That is a genuine narrowing.
 *   3. THE REAL DISPATCH IS STILL WITNESSED — a separate arm witnesses it and records the value
 *      the caller carries, so the crafted entries below are anchored to a state the game reaches.
 *   4. EXHAUSTIVE over the whole input: all 256 carried values, against a latch starting in each
 *      of its reachable states. Only the low bit of the value reaches the latch, and this is what
 *      proves the other seven do not. The watchdog is NOT swept — both arms clone one machine, so
 *      only the delta can differ, and the watchdog ignores its data anyway.
 *   5. TEETH — one twin per named arm below. This does NOT claim to cover every way the
 *      handover could be wrong; it claims each listed twin is caught.
 *
 * HOLE: nothing here runs the foreground loop, so nothing here shows that the loop is the right
 * thing to hand over to beyond the address itself matching.
 * HOLE: the watchdog is modelled as a count of kicks, so an arm asserting it cannot distinguish
 * a kick from any other kick.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-00a8.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { enableInterruptAndEnterForegroundLoop } from "../enableInterruptAndEnterForegroundLoop.js";
import { loc_00a8 as oracle } from "../../translated/loc_00a8.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { LATCH_NMI_ENABLE } from "../../../../boards/timeplt/io.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TARGET = 0x00a8;
const FOREGROUND_LOOP = 0x0b93;
const CORPUS_FRAMES = 1200;

/** The value the one caller in the image carries in. Measured by the witness arm below. */
const CARRIED = 1;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

let entry = null;
let witnessed = null;

/**
 * Capture the machine at the real dispatch. The routine never returns, so the capture hook must
 * NOT let the oracle run and then continue — it stops the session instead, which is why this
 * file cannot use the shared unit harness.
 */
function entryState() {
  if (entry === null) {
    class Reached extends Error {}
    const host = makeMachine(
      new Map([[TARGET, (mm) => {
        entry = mm.clone();
        witnessed = { value: mm.regs.a, latch: mm.io.latch[LATCH_NMI_ENABLE] };
        throw new Reached();
      }]]),
      {},
    );
    try {
      host.runFrames(CORPUS_FRAMES);
    } catch (e) {
      if (!(e instanceof Reached)) throw e;
    }
  }
  return entry;
}

/** A clone whose foreground loop is a recorder, installed identically on both arms. */
function severed(machine, log) {
  const c = machine.clone();
  c.routines = new Map(c.routines);
  c.routines.set(FOREGROUND_LOOP, (mm) => {
    log.push({ a: mm.regs.a, latch: mm.io.latch[LATCH_NMI_ENABLE], kicks: mm.io.watchdogKicks });
  });
  return c;
}

/** The real contract: RAM, the latch bit, the watchdog, the registers, and the handover. */
function unitDiff(candidate, machine) {
  const logA = [];
  const logB = [];
  const a = severed(machine, logA);
  const b = severed(machine, logB);
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  // The WHOLE LS259, not just the bit this routine drives. Comparing one bit would pass a
  // candidate that additionally drove any of the other seven outputs, and there could be no twin
  // for that failure because the comparison could not express it.
  for (let i = 0; i < a.io.latch.length; i++) {
    if (a.io.latch[i] !== b.io.latch[i]) {
      return { reg: `latch[${i}]`, a: a.io.latch[i], b: b.io.latch[i] };
    }
  }
  if (a.io.watchdogKicks !== b.io.watchdogKicks) {
    return { reg: "watchdog", a: a.io.watchdogKicks, b: b.io.watchdogKicks };
  }
  if (logA.length !== logB.length) {
    return { reg: "handovers", a: logA.length, b: logB.length };
  }
  for (const [i, x] of logA.entries()) {
    for (const k of ["a", "latch", "kicks"]) {
      if (x[k] !== logB[i][k]) return { reg: `handover.${k}`, a: x[k], b: logB[i][k] };
    }
  }
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  if (moved.length) return { reg: moved[0], a: a.regs[moved[0]], b: b.regs[moved[0]] };
  return null;
}

function craft(value, latchStart) {
  const m = entryState().clone();
  m.regs.a = value;
  m.io.latch[LATCH_NMI_ENABLE] = latchStart;
  return m;
}

const VALUES = Array.from({ length: 256 }, (_unused, v) => v);
const LATCH_STARTS = [0, 1];
const SWEEP_SIZE = VALUES.length * LATCH_STARTS.length;

function sweepCaught(candidate) {
  let caught = 0;
  for (const latchStart of LATCH_STARTS) {
    for (const value of VALUES) if (unitDiff(candidate, craft(value, latchStart))) caught++;
  }
  return caught;
}

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: never kicks the watchdog. */
function brokenNoWatchdogKick(m) {
  m.mem.write8(0xc300, m.regs.a, 10);
  return m.call(FOREGROUND_LOOP);
}

/** BUG: never drives the latch. */
function brokenNoLatchWrite(m) {
  m.mem.write8(0xc200, m.regs.a, 10);
  return m.call(FOREGROUND_LOOP);
}

/** BUG: forces the latch bit set instead of taking it from what the caller carries. */
function brokenForcesLatchOn(m) {
  m.mem.write8(0xc300, 1, 10);
  m.mem.write8(0xc200, m.regs.a, 10);
  return m.call(FOREGROUND_LOOP);
}

/** BUG: drives a different bit of the latch. */
function brokenWrongLatchBit(m) {
  m.mem.write8(0xc302, m.regs.a, 10);
  m.mem.write8(0xc200, m.regs.a, 10);
  return m.call(FOREGROUND_LOOP);
}

/**
 * BUG: does everything the oracle does, correctly, and ALSO drives one more LS259 output. This
 * twin exists because it was INVISIBLE while the comparison looked at a single latch bit — a way
 * the handover could be wrong that no twin could have caught, because the check could not express
 * it. It is the reason unitDiff now walks the whole latch.
 */
function brokenAlsoDrivesAnotherOutput(m) {
  m.mem.write8(0xc300, m.regs.a, 10);
  m.mem.write8(0xc200, m.regs.a, 10);
  m.mem.write8(0xc304, 1, 10);
  return m.call(FOREGROUND_LOOP);
}

/** BUG: does both stores and then never hands over. */
function brokenSkipsTheHandover(m) {
  m.mem.write8(0xc300, m.regs.a, 10);
  m.mem.write8(0xc200, m.regs.a, 10);
}

const TWINS = [
  ["no-op", brokenNoOp, SWEEP_SIZE],
  ["no-watchdog-kick", brokenNoWatchdogKick, SWEEP_SIZE],
  // Caught only where the carried value's low bit disagrees with the latch's starting state.
  ["no-latch-write", brokenNoLatchWrite, 256],
  ["forces-latch-on", brokenForcesLatchOn, 256],
  // 384, not 256: since the comparison widened from one latch bit to the whole LS259, this twin
  // is now caught BOTH where it fails to drive bit 0 and where the bit it wrongly drives differs.
  ["wrong-latch-bit", brokenWrongLatchBit, 384],
  ["also-drives-another-output", brokenAlsoDrivesAnotherOutput, SWEEP_SIZE],
  ["skips-the-handover", brokenSkipsTheHandover, SWEEP_SIZE],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("WITNESSED: the game really does reach this entry, carrying one fixed value", { skip }, () => {
  entryState();
  assert.notEqual(entry, null, "vacuous: no session reached the routine");
  assert.equal(witnessed.value, CARRIED, "the value the caller carries in moved");
  assert.equal(witnessed.latch, 0, "the latch bit is no longer clear on the way in");
  console.log(
    `  WITNESSED: reached carrying ${witnessed.value} with the latch bit ${witnessed.latch}`,
  );
});

test("★ THE STATE DUMP IS BLIND: a candidate that does nothing passes a RAM comparison", { skip }, () => {
  const logA = [];
  const a = severed(entryState(), logA);
  const b = severed(entryState(), []);
  oracle(a);
  brokenNoOp(b);
  assert.equal(
    firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    null,
    "a RAM difference appeared, so this entry DOES reach dumped memory and the whole framing of " +
      "this file must be re-derived",
  );
  assert.notEqual(unitDiff(brokenNoOp, entryState()), null, "the real contract must catch it");
  console.log("  BLIND: RAM is empty here; the latch, the watchdog and the handover are the gate");
});

test("EQUAL at the captured entry, loop severed: latch, watchdog and handover identical", { skip }, () => {
  const logA = [];
  const logB = [];
  const a = severed(entryState(), logA);
  const b = severed(entryState(), logB);
  oracle(a);
  enableInterruptAndEnterForegroundLoop(b);
  assert.equal(logA.length, 1, "vacuous: the oracle did not reach the foreground loop");
  assert.equal(logB.length, 1, "the rewrite did not reach the foreground loop");
  assert.deepEqual(logB[0], logA[0], "the state handed to the loop differs");
  assert.equal(a.io.latch[LATCH_NMI_ENABLE], CARRIED & 1, "the carried value's low bit drives it");
  assert.equal(b.io.latch[LATCH_NMI_ENABLE], a.io.latch[LATCH_NMI_ENABLE], "the latch differs");
  assert.equal(b.io.watchdogKicks, a.io.watchdogKicks, "the watchdog count differs");
  assert.equal(unitDiff(enableInterruptAndEnterForegroundLoop, entryState()), null, "the contract diverged");
  console.log(
    `  EQUAL: latch=${a.io.latch[LATCH_NMI_ENABLE]} kicks=${a.io.watchdogKicks} handover=` +
      JSON.stringify(logA[0]),
  );
});

test("EXCLUDED, deliberately: nothing at all, once the loop is severed", { skip }, () => {
  const a = severed(entryState(), []);
  const b = severed(entryState(), []);
  oracle(a);
  enableInterruptAndEnterForegroundLoop(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    [],
    "this entry moves no register of its own, so nothing may differ once the loop is severed",
  );
  console.log("  EXCLUDED: nothing — no register moves on either side");
});

test("EXHAUSTIVE: all 256 carried values against both starting latch states", { skip }, () => {
  assert.equal(sweepCaught(enableInterruptAndEnterForegroundLoop), 0, "the rewrite diverged somewhere in the crafted space");

  // Only the low bit reaches the latch, and the sweep is what proves the other seven do not.
  const even = severed(craft(0xfe, 1), []);
  enableInterruptAndEnterForegroundLoop(even);
  assert.equal(even.io.latch[LATCH_NMI_ENABLE], 0, "an even value must clear the latch bit");
  const odd = severed(craft(0xff, 0), []);
  enableInterruptAndEnterForegroundLoop(odd);
  assert.equal(odd.io.latch[LATCH_NMI_ENABLE], 1, "an odd value must set it");
  console.log(`  EXHAUSTIVE: ${SWEEP_SIZE} crafted entries identical; only the low bit lands`);
});

for (const [label, twin, craftedCaught] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), craftedCaught, `the ${label} twin's crafted catch count moved`);
    assert.ok(craftedCaught > 0, `the ${label} twin is caught by nothing`);
    console.log(`  TEETH/${label}: caught on ${craftedCaught} of ${SWEEP_SIZE} crafted entries`);
  });
}
