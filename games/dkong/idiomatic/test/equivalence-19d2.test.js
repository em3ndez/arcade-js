// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for advanceSubstateAndArmTimer (ROM 0x19d2) — the shared sub-state
 * advance tail of loc_197a / loc_1a2a.
 *
 * tail_19d2 is a LEAF whose entire memory-observable behaviour is a function of ONE
 * byte, GAME_SUBSTATE (0x600A): it increments that byte (mod 256) and writes 0x40 to
 * SUBSTATE_TIMER (0x6009) unconditionally. It has no register live-in (it loads its own
 * HL) and no meaningful return (a plain `ret`, not a caller-skip). Every other byte the
 * oracle touches is the Z80 return mechanism (SP/PC) the direct-call model drops — none
 * of it reaches RAM, so none is in the contract. That makes the strongest gate available:
 *
 *   1. EQUAL (exhaustive) — advanceSubstateAndArmTimer == oracle over all 256 values of
 *      GAME_SUBSTATE, compared on the whole 5120-byte RAM dump (incl. the stack region,
 *      which neither side writes). 256 values is the complete input space — a proof, not
 *      a sample. Each entry seeds SUBSTATE_TIMER with a sentinel (0x99) so the diff would
 *      catch a routine that FAILED to re-arm it to 0x40.
 *
 *   2. TEETH (exhaustive) — two deliberately-broken twins the sweep MUST catch, one per
 *      write in the contract:
 *        (a) dropped-timer-arm — increments GAME_SUBSTATE but never writes SUBSTATE_TIMER;
 *            caught by the RAM diff because the entry seeds it to 0x99 (not 0x40). Proves
 *            the SUBSTATE_TIMER write is checked.
 *        (b) decrement-substate — writes GAME_SUBSTATE-1 instead of +1; caught by the RAM
 *            diff for every value (v+1 != v-1 mod 256). Proves the GAME_SUBSTATE write is
 *            checked.
 *
 *   3. REALISM (captured dispatches) — hook 0x19d2 in a real attract run, clone the
 *      machine at each true dispatch, and confirm advanceSubstateAndArmTimer reproduces
 *      the oracle's RAM on every real state the game actually produces.
 *
 * A FRESH clone per side everywhere: the routine WRITES memory, so a reused machine would
 * carry the previous advance forward (docs/decompiler-pipeline: only a pure read-only leaf may reuse one).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-19d2.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { tail_19d2 as oracle } from "../../translated/tail_19d2.js";
import { advanceSubstateAndArmTimer } from "../advanceSubstateAndArmTimer.js";
import { GAME_SUBSTATE, SUBSTATE_TIMER } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x19d2;
// The oracle ends in `ret`, which pops two bytes; point SP at work RAM so that pop reads
// valid bytes (never I/O) on the synthetic entries below. It writes no RAM, so it does
// not affect the compared state — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;
// A value the routine NEVER produces for SUBSTATE_TIMER (it always writes 0x40), seeded
// into each entry so a "dropped re-arm" bug is visible to the RAM diff.
const TIMER_SENTINEL = 0x99;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Run the oracle and the candidate on two fresh clones of `entry` and diff the
 * memory-equivalence contract: the whole RAM dump. A FRESH clone per side because the
 * routine WRITES memory. Returns the first RAM diff (or null).
 */
function runPair(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** A synthetic entry: this machine with GAME_SUBSTATE = v, a sentinel timer, safe stack. */
function makeEntry(base, v) {
  const e = base.clone();
  e.mem.write8(GAME_SUBSTATE, v);
  e.mem.write8(SUBSTATE_TIMER, TIMER_SENTINEL);
  e.regs.sp = SAFE_SP;
  return e;
}

/**
 * Sweep a candidate against the oracle over all 256 GAME_SUBSTATE values. Returns the
 * first RAM mismatch, or null, plus the count compared.
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

test("EQUAL (exhaustive): advanceSubstateAndArmTimer == oracle over all 256 GAME_SUBSTATE values", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, advanceSubstateAndArmTimer);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at 0x600a=${hx(mismatch.v)}: RAM diverges at ` +
        `0x${(mismatch.ram.addr ?? 0).toString(16)} (${mismatch.ram.a}->${mismatch.ram.b})`,
  );
  assert.equal(count, 256, "must have compared all 256 GAME_SUBSTATE values");
  console.log(`  EQUAL/exhaustive: ${count} GAME_SUBSTATE values — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG: advances the sub-state but forgets to re-arm SUBSTATE_TIMER. Caught by the RAM
 *  diff because the entry seeds SUBSTATE_TIMER to the 0x99 sentinel, not 0x40. */
function brokenDroppedTimerArm(m) {
  const { mem } = m;
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);
}

/** BUG: DECREMENTS GAME_SUBSTATE instead of incrementing it. Writes the wrong sub-state
 *  index for every input; caught by the RAM diff. */
function brokenDecrementSubstate(m) {
  const { mem } = m;
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) - 1) & 0xff);
  mem.write8(SUBSTATE_TIMER, 0x40);
}

test("TEETH (exhaustive): the dropped-timer-arm twin is CAUGHT (SUBSTATE_TIMER check has teeth)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, brokenDroppedTimerArm);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a missing SUBSTATE_TIMER re-arm — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, SUBSTATE_TIMER, "the dropped-arm twin must be caught at SUBSTATE_TIMER (0x6009)");
  console.log(`  TEETH/timer: caught after ${count} value(s) at 0x600a=${hx(mismatch.v)} — SUBSTATE_TIMER diverges`);
});

test("TEETH (exhaustive): the decrement-substate twin is CAUGHT (GAME_SUBSTATE check has teeth)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, brokenDecrementSubstate);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong GAME_SUBSTATE write — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, GAME_SUBSTATE, "the decrement twin must be caught at GAME_SUBSTATE (0x600A)");
  console.log(`  TEETH/substate: caught after ${count} value(s) at 0x600a=${hx(mismatch.v)} — GAME_SUBSTATE diverges`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x19d2 in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed to a clean stop. 0x19d2 is the shared tail of the per-frame update
 * cascade / idx3 handler, so attract dispatches it whenever those close a sub-state.
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

test("REALISM: real captured 0x19d2 dispatches — advanceSubstateAndArmTimer matches oracle RAM", () => {
  const caps = captureDispatches(128, 3000);
  assert.ok(caps.length >= 1, "expected at least one real 0x19d2 dispatch during attract");

  for (const cap of caps) {
    const before = cap.mem.read8(GAME_SUBSTATE);
    const ram = runPair(cap, advanceSubstateAndArmTimer);
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (0x600a in=${hx(before)}) at ` +
          `0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x19d2 dispatches — RAM == oracle`);
});
