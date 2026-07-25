// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for tickDispatcherCountdown (ROM 0x1E4A) — sub_1dbd's state-2 hold.
 *
 * loc_1e4a is a LEAF whose entire memory-observable behaviour is a total function of ONE
 * byte, the state-2 countdown at 0x6341: it decrements that byte in place and, only on the
 * frame the result is 0, additionally clears 0x6a30 and resets the dispatcher byte 0x6340
 * to 0. It reads no other memory and calls nothing. The oracle's `ret nz` / `ret` are plain
 * returns (no caller-skip), so SP/PC are the return mechanism the JS return replaces and are
 * NOT in the contract; the residual A/F are dead ABI. That leaves a memory-only contract and
 * makes the strongest possible gate available:
 *
 *   1. EQUAL (exhaustive) — tickDispatcherCountdown == oracle on RAM over all 256 values of
 *      the 0x6341 countdown byte. 256 values is the complete input space and covers BOTH arms
 *      (255 still-counting + the single expiry at 0x6341 == 1). The context bytes 0x6340/0x6a30
 *      are seeded NON-ZERO so the expiry-arm writes actually change RAM and are therefore
 *      observable to the diff (a "forgot to clear" bug is invisible against a zero background).
 *
 *   2. TEETH (exhaustive) — two deliberately-broken twins the sweep MUST catch:
 *        (a) skips the dispatcher reset (writes 0x6a30 but not 0x6340) — writes correct RAM on
 *            all 255 still-counting frames, so it is only catchable at the single expiry edge
 *            (0x6341 == 1) with 0x6340 non-zero. Proves the sweep exercises that edge AND that
 *            the 0x6340 write is checked, not assumed.
 *        (b) double-decrement (`-2`) — writes the wrong 0x6341 byte on nearly every value.
 *            Proves the memory diff has teeth on the always-taken write.
 *
 *   3. REALISM (captured dispatches) — hook 0x1e4a in a real attract run and clone the machine
 *      at each true state-2 dispatch (it fires 64x: 63 ret-nz + 1 expiry, ~frames 1138..1201),
 *      then confirm tickDispatcherCountdown reproduces the oracle's RAM on every real state —
 *      both arms, including the real expiry where 0x6a30 is a genuine non-zero popup value.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1e4a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1e4a as oracle } from "../../translated/loc_1e4a.js";
import { tickDispatcherCountdown } from "../tickDispatcherCountdown.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1e4a;
const COUNTDOWN = 0x6341;
const DISPATCH_STATE = 0x6340;
const POPUP_PARAM = 0x6a30;
// The oracle's `ret` pops the stack; point SP at work RAM so that pop reads valid bytes
// (never I/O). One `ret` (SP += 2), so SP+1 must stay < 0x6c00. Writes no RAM, so it does
// not affect the compared state — it only keeps the oracle well-defined on synthetic entries.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Run the oracle and the candidate on two FRESH clones of `entry` and diff the
 * memory-equivalence contract: RAM (whole dump; neither side writes the stack region).
 * A fresh clone per side because the routine WRITES memory — a reused machine would carry
 * the previous tick forward (docs/06: only a pure read-only leaf may reuse a clone).
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

/**
 * A synthetic entry: this machine with the countdown = v, a NON-ZERO dispatcher/param
 * context (so the expiry-arm writes are observable), and a safe stack.
 */
function makeEntry(base, v) {
  const e = base.clone();
  e.mem.write8(COUNTDOWN, v);
  e.mem.write8(DISPATCH_STATE, 0x02); // state 2 (this arm), non-zero so the reset is visible
  e.mem.write8(POPUP_PARAM, 0x8a); // arbitrary non-zero, so the clear is visible
  e.regs.sp = SAFE_SP;
  return e;
}

/**
 * Sweep a candidate against the oracle over all 256 countdown values. Returns the first
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

test("EQUAL (exhaustive): tickDispatcherCountdown == oracle over all 256 countdown values", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, tickDispatcherCountdown);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at 0x6341=${hx(mismatch.v)}: RAM diverges at ` +
        `0x${(mismatch.ram.addr ?? 0).toString(16)} (${mismatch.ram.a}->${mismatch.ram.b})`,
  );
  assert.equal(count, 256, "must have compared all 256 countdown values");
  console.log(`  EQUAL/exhaustive: ${count} countdown values — RAM identical to the oracle (both arms)`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * BUG: on expiry it clears the popup param but FORGETS to reset the dispatcher (0x6340).
 * Writes correct RAM on every still-counting frame, so it is only catchable at the single
 * expiry edge (0x6341 == 1) — and only because makeEntry seeds 0x6340 non-zero.
 */
function brokenSkipsDispatcherReset(m) {
  const { mem } = m;
  const remaining = (mem.read8(COUNTDOWN) - 1) & 0xff;
  mem.write8(COUNTDOWN, remaining);
  if (remaining !== 0) return;
  mem.write8(POPUP_PARAM, 0);
  // BUG: missing mem.write8(DISPATCH_STATE, 0);
}

/** BUG: decrements by two — writes the wrong countdown byte on nearly every value. */
function brokenDoubleDecrement(m) {
  const { mem } = m;
  const remaining = (mem.read8(COUNTDOWN) - 2) & 0xff;
  mem.write8(COUNTDOWN, remaining);
  if (remaining !== 0) return;
  mem.write8(POPUP_PARAM, 0);
  mem.write8(DISPATCH_STATE, 0);
}

test("TEETH (exhaustive): the skips-dispatcher-reset twin is CAUGHT at the expiry edge", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, brokenSkipsDispatcherReset);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a missing dispatcher reset — the RAM check is worthless");
  assert.equal(mismatch.v, 1, "the missing 0x6340 reset can only diverge at the expiry edge 0x6341 == 1");
  assert.equal(mismatch.ram.addr, DISPATCH_STATE, "the caught diff must be at the un-reset dispatcher byte 0x6340");
  console.log(
    `  TEETH/reset: caught after ${count} values at 0x6341=${hx(mismatch.v)} ` +
      `(0x6340 left ${mismatch.ram.b} vs oracle ${mismatch.ram.a})`,
  );
});

test("TEETH (exhaustive): the double-decrement twin is CAUGHT (always-taken write has teeth)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = sweep(base, brokenDoubleDecrement);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong countdown write — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, COUNTDOWN, "the double-decrement twin must be caught at the countdown byte 0x6341");
  console.log(`  TEETH/memory: caught — 0x6341 diverges at value ${hx(mismatch.v)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x1e4a in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed. sub_1dbd reaches state 2 for one 0x40-frame hold, so attract dispatches
 * this 64x — 63 ret-nz frames then one expiry — covering both arms with real state.
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

test("REALISM: real captured state-2 dispatches — tickDispatcherCountdown matches oracle RAM", () => {
  const caps = captureDispatches(128, 1400);
  assert.ok(caps.length >= 1, "expected at least one real 0x1e4a dispatch during attract");

  let sawExpiry = false;
  for (const cap of caps) {
    const before = cap.mem.read8(COUNTDOWN);
    if (((before - 1) & 0xff) === 0) sawExpiry = true;
    const ram = runPair(cap, tickDispatcherCountdown);
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (0x6341 in=${hx(before)}) at ` +
          `0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  assert.ok(sawExpiry, "expected the single real expiry dispatch to be captured (both arms exercised)");
  console.log(`  REALISM: ${caps.length} real state-2 dispatches (incl. the expiry) — RAM == oracle`);
});
