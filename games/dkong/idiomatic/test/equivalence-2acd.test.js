// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for triggerMarioFall (ROM 0x2ACD) — the "start falling" trigger.
 *
 * entry_2acd is a LEAF whose entire memory-observable behaviour is a single, INPUT-
 * INDEPENDENT write: MARIO_START_FALL (0x6221) := 1. It reads nothing that decides the
 * value, calls nothing, and returns nothing a caller consumes (its terminal return only
 * pops the caller's address off the stack — the popped bytes never reach RAM). So the
 * contract is memory-only, and an EXHAUSTIVE gate is available: since the routine ignores
 * all input, sweeping the trigger's PRIOR value over all 256 bytes — with and without a
 * surrounding-RAM fuzz — proves both facts that could be wrong (the write always lands
 * exactly 1, and nothing else is ever touched) across every prior state.
 *
 *   1. EQUAL (exhaustive) — triggerMarioFall == oracle on RAM (firstStateDiff over the
 *      whole dump, which neither side writes outside the one trigger byte) across all 256
 *      prior values of the trigger, both on a clean base and on a noise-clobbered base
 *      whose neighbours and a spread of work RAM are set to 0xFF.
 *
 *   2. TEETH (exhaustive) — three deliberately-broken twins the same sweep MUST catch:
 *        (a) wrong value — writes 2 instead of 1; caught at the trigger byte.
 *        (b) wrong address — writes 1 to the fatal-fall neighbour (0x6220) and leaves the
 *            trigger alone; caught (the trigger is unwritten and a neighbour moved).
 *        (c) no-op — writes nothing; caught at the trigger byte (prior stays, oracle sets 1).
 *
 *   3. REALISM (captured dispatches) — the slope cascade dispatches 0x2ACD rarely in
 *      attract (~once per few thousand frames), so run a long attract, clone the machine
 *      at each true dispatch, and confirm triggerMarioFall reproduces the oracle's RAM on
 *      every real state the game actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2acd.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_2acd as oracle } from "../../translated/entry_2acd.js";
import { triggerMarioFall } from "../triggerMarioFall.js";
import { MARIO_START_FALL } from "../../optimized/ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2acd;
// The oracle's `ret` pops the stack; point SP at work RAM so that pop reads valid bytes
// (never I/O). The oracle writes no RAM through the stack (a leaf: it only pops), so this
// choice never affects the compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

// Neighbours of the trigger plus a spread of work RAM. Set to 0xFF (identically on both
// sides) so a candidate that wrote a collateral cell, or a value derived from surrounding
// state, would surface as a divergence.
const NOISE_CELLS = [0x6220, 0x6222, 0x6223, 0x6000, 0x6100, 0x6400, 0x66a0, 0x6a29];

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the trigger's prior byte set (and optional
 * surrounding noise) and a safe stack. Frame machinery is neutralised (clone() already
 * sets nextNmi/nextBoundary = Infinity; re-asserted here for clarity) so the oracle's
 * `m.step` cannot fire an NMI or push a frame while running in isolation.
 */
function makeEntry(base, prior, noise) {
  const e = base.clone();
  if (noise) for (const a of NOISE_CELLS) e.mem.write8(a, 0xff);
  e.mem.write8(MARIO_START_FALL, prior);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). A fresh entry per side because
 * the routine WRITES memory — a reused machine would carry the previous run forward.
 *
 * @returns {{ram: object|null}}
 */
function runPair(base, prior, noise, candidate) {
  const a = makeEntry(base, prior, noise); // oracle
  const b = makeEntry(base, prior, noise); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/**
 * Exhaustive sweep: every prior trigger byte 0..255, on a clean base and a noise base.
 * Because the routine ignores all input, these two sweeps cover its whole behaviour.
 * Returns the first mismatch (or null) and the total combos compared.
 */
function fullSweep(base, candidate) {
  let count = 0;
  for (const noise of [false, true]) {
    for (let prior = 0; prior < 256; prior++) {
      const { ram } = runPair(base, prior, noise, candidate);
      count++;
      if (ram) return { mismatch: { prior, noise, ram }, count };
    }
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at prior=${hx(mm.prior)} noise=${mm.noise}: RAM diverges at ` +
    `0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): triggerMarioFall == oracle across all 256 prior values (clean + noise)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, triggerMarioFall);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 * 2, "must have compared every prior byte on both bases");
  console.log(`  EQUAL/exhaustive: ${count} prior-value combos — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): writes 2 instead of 1 — a wrong trigger value. */
function brokenWrongValue(m) {
  m.mem.write8(MARIO_START_FALL, 2);
}

/** BUG (b): writes 1 to the fatal-fall neighbour and leaves the trigger untouched. */
function brokenWrongAddr(m) {
  m.mem.write8(0x6220, 1); // MARIO_FATAL_FALL — the wrong cell
}

/** BUG (c): does nothing — the trigger is never raised. */
function brokenNoOp(_m) {
  /* no write */
}

test("TEETH (exhaustive): the wrong-value twin is CAUGHT at the trigger byte", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongValue);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong trigger value — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, MARIO_START_FALL, "the wrong-value twin must diverge on the trigger byte");
  console.log(`  TEETH/value: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-address twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongAddr);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a write to the wrong cell — worthless");
  console.log(`  TEETH/addr: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the no-op twin is CAUGHT at the trigger byte", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenNoOp);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a missing write — worthless");
  assert.equal(mismatch.ram.addr, MARIO_START_FALL, "the no-op twin must diverge on the trigger byte");
  console.log(`  TEETH/noop: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x2ACD in a real attract run and clone the machine at each real dispatch (up to
 * K). The slope cascade reaches it only occasionally, so a longer run is needed than for
 * a per-frame routine. The wrapper clones the entry state, then runs the oracle so the
 * host game proceeds undisturbed.
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

test("REALISM: real captured 0x2ACD dispatches — triggerMarioFall matches oracle RAM", () => {
  const caps = captureDispatches(16, 4200);
  assert.ok(caps.length >= 1, "expected at least one real 0x2ACD dispatch during attract");

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const prior = a.mem.read8(MARIO_START_FALL);
    oracle(a);
    triggerMarioFall(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (prior trigger=${hx(prior)}) ` +
          `at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x2ACD dispatches — RAM == oracle`);
});
