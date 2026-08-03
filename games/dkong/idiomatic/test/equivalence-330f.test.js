// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for tickFireTimerAndRerollDirection (ROM 0x330F) — the per-object periodic timer.
 *
 * entry_330f services ONE object record (the record pointer is the register live-in)
 * and its entire memory effect is a function of just two things:
 *
 *   • the object's timer byte (record +0x16): while nonzero the routine only
 *     decrements it; at zero it reloads to 43 and resets the state byte (+0x0d) to 0;
 *   • the pseudo-random low bit (RANDOM 0x6018 bit 0): on the expiry pass it, and
 *     only it, advances the reset state byte from 0 to 1.
 *
 * Every path then falls through the same decrement, so an expiry leaves the timer at
 * 42. It writes only those two record fields, returns nothing a caller consumes, and
 * does NOT modify the record pointer — so the contract is memory-only, and because the
 * effect factors into (timer byte) × (random low bit) it admits an exhaustive gate.
 *
 * It IS dispatched live: the attract call chain runs it ~322× per 2000 frames against
 * the 0x6400 hazard-object record, so real captured dispatches cover the countdown
 * (timer 1..42) and the expiry pass — the crafted sweep then covers the whole space.
 *
 * No stack scratch is excluded: entry_330f is a LEAF (calls nothing) with a single
 * caller-return pop and no push, so it writes no stack — the RAM diff is the whole
 * dump, exactly as for the 0x037F leaf.
 *
 *   1. REACHABILITY — 0x330F is dispatched during attract.
 *   2. EQUAL (captured) — tickFireTimerAndRerollDirection == oracle on every real dispatch (RAM whole-dump).
 *   3. EQUAL (crafted-exhaustive) — every timer value 0..255 crossed with random bytes
 *      of both parities, at two record bases, with a sentinel state input; RAM identical
 *      AND the oracle never writes state 2 (the dead ROM arm is unreachable).
 *   4. TEETH — three broken twins the sweep MUST catch: a dropped final decrement, an
 *      inverted random-bit gate, and a wrong reload value.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-330f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_330f as oracle } from "../../translated/loc_330f.js";
import { tickFireTimerAndRerollDirection } from "../tickFireTimerAndRerollDirection.js";
import { RANDOM } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x330f;
const TIMER = 0x16; // object-record field: countdown timer
const STATE = 0x0d; // object-record field: 0/1 phase
// The oracle ends with one caller-return pop; point SP at dead stack scratch so that
// pop reads valid bytes. The routine writes no RAM through the stack (a leaf: only the
// one pop), so this never affects the compared memory.
const SAFE_SP = 0x6bf8;
const STATE_SENTINEL = 0x07; // a non-{0,1,2} state input, so any 2 that appears was WRITTEN

const hx = (v) => "0x" + (v & 0xffff).toString(16);

/**
 * A synthetic dispatch: a clone of `base` with the record pointer, the two record
 * fields and the random byte set, and a safe stack. clone() already neutralises the
 * frame machinery (nextNmi/nextBoundary = Infinity); re-asserted for clarity.
 */
function makeEntry(base, record, timer, state, rand) {
  const e = base.clone();
  e.regs.sp = SAFE_SP;
  e.regs.ix = record;
  e.mem.write8((record + TIMER) & 0xffff, timer);
  e.mem.write8((record + STATE) & 0xffff, state);
  e.mem.write8(RANDOM, rand);
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * whole RAM dump. Fresh entries per side because the routine WRITES memory.
 * @returns {{ram: object|null, oracleState: number}}
 */
function runPair(base, record, timer, state, rand, candidate) {
  const a = makeEntry(base, record, timer, state, rand); // oracle
  const b = makeEntry(base, record, timer, state, rand); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram, oracleState: a.mem.read8((record + STATE) & 0xffff) };
}

// The random dimension only matters through bit 0; this set covers bit0 = 0 and bit0 = 1
// with varied high bits so a mask mistake in the high bits would show too.
const RAND_SET = [0x00, 0x01, 0xfe, 0xff, 0x2a, 0x55];
const BASES = [0x6400, 0x6700]; // real attract base + a second, to pin the offset math

/**
 * Exhaustive sweep: every timer value 0..255 × every random byte in RAND_SET × the two
 * record bases, with the sentinel state input. Returns the first RAM mismatch (or null),
 * the count compared, and whether the ORACLE ever produced state 2 (it must not).
 */
function fullSweep(base, candidate) {
  let count = 0;
  let sawState2 = false;
  let sawExpiryAdvance = false; // an expiry pass that advanced state to 1 (coverage tell)
  for (const record of BASES) {
    for (let t = 0; t < 256; t++) {
      for (const r of RAND_SET) {
        const { ram, oracleState } = runPair(base, record, t, STATE_SENTINEL, r, candidate);
        count++;
        if (oracleState === 0x02) sawState2 = true;
        if (t === 0 && oracleState === 0x01) sawExpiryAdvance = true;
        if (ram) return { mismatch: { record, t, r, ram }, count, sawState2, sawExpiryAdvance };
      }
    }
  }
  return { mismatch: null, count, sawState2, sawExpiryAdvance };
}

const describeMismatch = (mm) =>
  mm &&
  `at record=${hx(mm.record)} timer=${hx(mm.t)} rand=${hx(mm.r)}: ` +
    `RAM diverges at ${hx(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x330F is dispatched during attract", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2000);
  assert.ok(count > 0, "0x330F should be dispatched by the attract call chain");
  console.log(`  REACHABILITY: ${count} natural 0x330F dispatches in 2000 frames`);
});

// -- 2. EQUAL (captured) ------------------------------------------------------

test("EQUAL (captured): tickFireTimerAndRerollDirection == oracle on every real 0x330F dispatch", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < 300) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2000);
  assert.ok(caps.length >= 1, "expected at least one real 0x330F dispatch during attract");

  let sawCountdown = 0, sawExpiry = 0;
  for (const cap of caps) {
    const a = cap.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity; // oracle
    const b = cap.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity; // candidate
    const timer = a.mem.read8((a.regs.ix + TIMER) & 0xffff);
    if (timer === 0) sawExpiry++; else sawCountdown++;
    oracle(a);
    tickFireTimerAndRerollDirection(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram && `real dispatch (ix=${hx(a.regs.ix)} timer=${hx(timer)}) diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`,
    );
  }
  assert.ok(sawExpiry >= 1, "expected at least one real expiry (timer==0) dispatch");
  console.log(`  EQUAL/captured: ${caps.length} real dispatches identical (${sawCountdown} countdown, ${sawExpiry} expiry)`);
});

// -- 3. EQUAL (crafted-exhaustive) --------------------------------------------

test("EQUAL (crafted-exhaustive): tickFireTimerAndRerollDirection == oracle over timer × random × base", () => {
  const base = new Machine(ROM);
  base.runFrames(180);
  const attract = base.clone();

  const { mismatch, count, sawState2, sawExpiryAdvance } = fullSweep(attract, tickFireTimerAndRerollDirection);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, BASES.length * 256 * RAND_SET.length, "must have compared the full factored space");
  // The dead-arm property: the oracle never writes state 2 (the state==1 test can never
  // match because the reset-to-0 precedes it). Mirrors the oracle's own TEST 2.
  assert.equal(sawState2, false, "the oracle produced state 2 — the dead ROM arm was reached (should be impossible)");
  // Coverage tell: the random-bit-set expiry arm (state -> 1) was actually exercised.
  assert.ok(sawExpiryAdvance, "the expiry+random-set arm (state -> 1) was never exercised — the sweep missed a path");
  console.log(`  EQUAL/exhaustive: ${count} (base,timer,rand) combos — RAM identical; state 2 never produced`);
});

// -- 4. TEETH -----------------------------------------------------------------

/** Twin (a): drops the shared final decrement, so the timer is off by one on EVERY path. */
function brokenNoDec(m) {
  const { regs, mem } = m;
  const rec = regs.ix;
  const ta = (rec + TIMER) & 0xffff, sa = (rec + STATE) & 0xffff;
  if (mem.read8(ta) === 0) {
    mem.write8(ta, 43);
    mem.write8(sa, 0);
    if ((mem.read8(RANDOM) & 0x01) !== 0) mem.write8(sa, 1);
  }
  // BUG: no `mem.write8(ta, mem.read8(ta) - 1)`
}

/** Twin (b): inverts the random gate — advances the state when bit 0 is CLEAR. */
function brokenInvertedRandomBit(m) {
  const { regs, mem } = m;
  const rec = regs.ix;
  const ta = (rec + TIMER) & 0xffff, sa = (rec + STATE) & 0xffff;
  if (mem.read8(ta) === 0) {
    mem.write8(ta, 43);
    mem.write8(sa, 0);
    if ((mem.read8(RANDOM) & 0x01) === 0) mem.write8(sa, 1); // BUG: inverted
  }
  mem.write8(ta, mem.read8(ta) - 1);
}

/** Twin (c): reloads the wrong value, so an expiry leaves the timer at 43 instead of 42. */
function brokenWrongReload(m) {
  const { regs, mem } = m;
  const rec = regs.ix;
  const ta = (rec + TIMER) & 0xffff, sa = (rec + STATE) & 0xffff;
  if (mem.read8(ta) === 0) {
    mem.write8(ta, 44); // BUG: should be 43
    mem.write8(sa, 0);
    if ((mem.read8(RANDOM) & 0x01) !== 0) mem.write8(sa, 1);
  }
  mem.write8(ta, mem.read8(ta) - 1);
}

test("TEETH: the three broken twins are all CAUGHT by the sweep", () => {
  const base = new Machine(ROM);
  base.runFrames(180);
  const attract = base.clone();

  const noDec = fullSweep(attract, brokenNoDec);
  assert.notEqual(noDec.mismatch, null, "the dropped-decrement twin escaped — the RAM check is worthless");
  assert.equal(noDec.mismatch.ram.addr, (noDec.mismatch.record + TIMER) & 0xffff, "dropped-decrement must diverge on the timer field");

  const invBit = fullSweep(attract, brokenInvertedRandomBit);
  assert.notEqual(invBit.mismatch, null, "the inverted-random-bit twin escaped — worthless");
  assert.equal(invBit.mismatch.ram.addr, (invBit.mismatch.record + STATE) & 0xffff, "inverted-random-bit must diverge on the state field");

  const wrongReload = fullSweep(attract, brokenWrongReload);
  assert.notEqual(wrongReload.mismatch, null, "the wrong-reload twin escaped — worthless");
  assert.equal(wrongReload.mismatch.ram.addr, (wrongReload.mismatch.record + TIMER) & 0xffff, "wrong-reload must diverge on the timer field");

  console.log(
    `  TEETH: dropped-decrement caught (${describeMismatch(noDec.mismatch)}); ` +
      `inverted-random-bit caught (${describeMismatch(invBit.mismatch)}); ` +
      `wrong-reload caught (${describeMismatch(wrongReload.mismatch)})`,
  );
});
