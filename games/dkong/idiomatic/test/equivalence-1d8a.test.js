// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for tickMoveStepTimer (ROM 0x1D8A) — the walk/climb sub-step-timer
 * decrement tail (ld hl,0x620f ; dec (hl) ; ret).
 *
 * entry_1d8a is a branch-free LEAF whose entire memory-observable behaviour is a total
 * function of ONE byte, MARIO_MOVE_STEP_TIMER (0x620F): it decrements that byte in place
 * and returns. It reads no other memory and calls nothing. The oracle's `ret` is a plain
 * return (no caller-skip), so SP/PC are the return mechanism the JS return replaces and
 * are NOT in the contract; the residual HL/A/F are dead ABI (the exit successor loc_197a
 * @ 0x1983 immediately does `call 0x1f72`, reading none of them). That leaves a
 * memory-only contract and makes the strongest possible gate available:
 *
 *   1. EQUAL (exhaustive) — tickMoveStepTimer == oracle on RAM over all 256 values of the
 *      0x620F timer byte. 256 values is the complete input space, including the
 *      wrap-to-0xFF edge (0x00 -> 0xFF).
 *
 *   2. TEETH (exhaustive) — two deliberately-broken twins the sweep MUST catch:
 *        (a) POINTER-not-byte — models `dec hl` (the pointer) instead of `dec (hl)` (the
 *            byte), i.e. it writes NOTHING to 0x620F. The oracle explicitly warns of this
 *            confusion; here it manifests as the timer never counting down. Caught on
 *            every value.
 *        (b) wrong operation — increments instead of decrements. Caught on every value.
 *
 *   3. REALISM (captured dispatches) — hook 0x1d8a in a real attract run and clone the
 *      machine at each true dispatch (attract plays 25m and Mario walks/climbs, so this
 *      fires ~46x, ~frames 844..1300), then confirm tickMoveStepTimer reproduces the
 *      oracle's RAM on every real state the game actually feeds it.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1d8a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1d8a as oracle } from "../../translated/loc_1d8a.js";
import { tickMoveStepTimer } from "../tickMoveStepTimer.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1d8a;
const TIMER = 0x620f; // MARIO_MOVE_STEP_TIMER
// The oracle's `ret` pops the stack; point SP at work RAM so the pop reads valid bytes
// (never I/O). `ret` only READS the stack (no write), so it does not affect the compared
// RAM — this just keeps the oracle well-defined on synthetic entries.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Run the oracle and the candidate on two FRESH clones of `entry` and diff the
 * memory-equivalence contract: RAM (whole dump; neither side writes the stack region).
 * A fresh clone per side because the routine WRITES memory — a reused machine would carry
 * the previous tick forward (docs/decompiler-pipeline: only a pure read-only leaf may reuse a clone).
 *
 * @returns {object|null}  the first RAM diff, or null when identical.
 */
function runPair(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** A synthetic entry: this machine with the timer = v and a safe stack. */
function makeEntry(base, v) {
  const e = base.clone();
  e.mem.write8(TIMER, v);
  e.regs.sp = SAFE_SP;
  return e;
}

/**
 * Sweep a candidate against the oracle over all 256 timer values. Returns the first
 * mismatch (RAM) or null, plus the count compared.
 */
function sweep(base, candidate) {
  let count = 0;
  for (let v = 0; v < 256; v++) {
    const ram = runPair(makeEntry(base, v), candidate);
    count++;
    if (ram) return { mismatch: { v, ram }, count };
  }
  return { mismatch: null, count };
}

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): tickMoveStepTimer == oracle over all 256 timer values", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, tickMoveStepTimer);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at 0x620F=${hx(mismatch.v)}: RAM diverges at ` +
        `0x${(mismatch.ram.addr ?? 0).toString(16)} (${mismatch.ram.a}->${mismatch.ram.b})`,
  );
  assert.equal(count, 256, "must have compared all 256 timer values");
  console.log(`  EQUAL/exhaustive: ${count} timer values — RAM identical to the oracle (incl. 0x00->0xFF wrap)`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * BUG: models `dec hl` (the POINTER) instead of `dec (hl)` (the BYTE) — writes nothing
 * to 0x620F, so the timer never counts down. The oracle warns of exactly this confusion.
 */
function brokenPointerNotByte(_m) {
  // (intentionally leaves 0x620F untouched)
}

/** BUG: increments the timer instead of decrementing it — wrong operation, every value. */
function brokenWrongDirection(m) {
  const { mem } = m;
  mem.write8(TIMER, (mem.read8(TIMER) + 1) & 0xff);
}

test("TEETH (exhaustive): the pointer-not-byte twin (no write) is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = sweep(base, brokenPointerNotByte);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a routine that never decrements the timer — worthless");
  assert.equal(mismatch.ram.addr, TIMER, "the caught diff must be at the un-decremented timer byte 0x620F");
  console.log(`  TEETH/pointer: caught — 0x620F left ${mismatch.ram.b} vs oracle ${mismatch.ram.a} (value ${hx(mismatch.v)})`);
});

test("TEETH (exhaustive): the wrong-direction twin (increment) is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = sweep(base, brokenWrongDirection);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an increment-instead-of-decrement — worthless");
  assert.equal(mismatch.ram.addr, TIMER, "the caught diff must be at the mis-written timer byte 0x620F");
  console.log(`  TEETH/direction: caught — 0x620F diverges at value ${hx(mismatch.v)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x1d8a in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed. Attract plays 25m and Mario walks/climbs, so the walk/climb steppers
 * route here ~46x (~frames 844..1300) with real timer/state values.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("REALISM: real captured walk/climb-tail dispatches — tickMoveStepTimer matches oracle RAM", () => {
  const caps = captureDispatches(128, 1300);
  assert.ok(caps.length >= 1, "expected at least one real 0x1d8a dispatch during 25m attract");

  for (const cap of caps) {
    const before = cap.mem.read8(TIMER);
    const ram = runPair(cap, tickMoveStepTimer);
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (0x620F in=${hx(before)}) at ` +
          `0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real walk/climb-tail dispatches — RAM == oracle`);
});
