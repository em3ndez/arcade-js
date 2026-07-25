// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for tickSubstateTimer (ROM 0x0018) — the rst-0x18 skip helper.
 *
 * sub_0018 is a LEAF whose entire memory-observable behaviour is a function of ONE
 * byte, SUBSTATE_TIMER (0x6009): it reads that byte, decrements it (mod 256), writes
 * it back, and returns whether the result is 0. Every other input the oracle touches
 * (SP, the return address it pops, HL/A/F) is the Z80 caller-skip *mechanism* the
 * direct-call model replaces with the boolean return — none of it reaches RAM, so
 * none of it is in the contract. That makes the strongest possible gate available:
 *
 *   1. EQUAL (exhaustive) — tickSubstateTimer == oracle over all 256 values of
 *      SUBSTATE_TIMER, compared on BOTH halves of the contract: the resulting RAM
 *      (firstStateDiff over the whole 5120-byte dump, incl. the stack region — which
 *      neither side writes) AND the returned boolean. 256 values is the complete
 *      input space, so this is a proof, not a sample.
 *
 *   2. TEETH (exhaustive) — two deliberately-broken twins the sweep MUST catch, one
 *      per half of the contract:
 *        (a) pre-decrement compare (`return old === 0`) — writes the SAME RAM, so it
 *            is invisible to the RAM diff and only the RETURN check catches it, and
 *            only at the two edges old ∈ {0,1}. Proves the boolean check has teeth
 *            AND that the sweep actually exercises those edges.
 *        (b) double-decrement (`-2`) — writes the WRONG byte; caught by the RAM diff.
 *            Proves the memory check has teeth.
 *
 *   3. REALISM (captured dispatches) — hook 0x0018 in a real attract run, clone the
 *      machine at each true rst-0x18 dispatch (fired from its ~50 sites and from
 *      sub_0020's tail-jump), and confirm tickSubstateTimer reproduces the oracle's
 *      RAM + return on every real state the game actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-0018.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0018 as oracle } from "../../translated/sub_0018.js";
import { tickSubstateTimer } from "../tickSubstateTimer.js";
import { SUBSTATE_TIMER } from "../../optimized/ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0018;
// The oracle's `ret` pops the stack; point SP at work RAM so that pop reads valid
// bytes (never I/O) on the synthetic entries below. The SKIP path does two `inc sp`
// (SP += 2) BEFORE the pop, so SP must be low enough that SP+3 stays inside work RAM
// (< 0x6c00). It writes no RAM, so it does not affect the compared state — it only
// keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Run the oracle and the candidate on two fresh clones of `entry` and diff the
 * memory-equivalence contract: RAM (whole dump) + the returned boolean. A FRESH
 * clone per side because the routine WRITES memory — a reused machine would carry
 * the previous tick forward (docs/06: only a pure read-only leaf may reuse a clone).
 *
 * @returns {{ram: object|null, retOracle: boolean, retCand: boolean}}
 */
function runPair(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  const retOracle = !!oracle(a);
  const retCand = !!candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram, retOracle, retCand };
}

/** A synthetic entry: this machine with SUBSTATE_TIMER = v and a safe stack. */
function makeEntry(base, v) {
  const e = base.clone();
  e.mem.write8(SUBSTATE_TIMER, v);
  e.regs.sp = SAFE_SP;
  return e;
}

/**
 * Sweep a candidate against the oracle over all 256 SUBSTATE_TIMER values. Returns
 * the first mismatch (RAM or return), or null, plus the count compared.
 */
function sweep(base, candidate) {
  let count = 0;
  for (let v = 0; v < 256; v++) {
    const { ram, retOracle, retCand } = runPair(makeEntry(base, v), candidate);
    count++;
    if (ram || retOracle !== retCand) {
      return { mismatch: { v, ram, retOracle, retCand }, count };
    }
  }
  return { mismatch: null, count };
}

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): tickSubstateTimer == oracle over all 256 SUBSTATE_TIMER values", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, tickSubstateTimer);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at 0x6009=${hx(mismatch.v)}: ` +
        (mismatch.ram
          ? `RAM diverges at 0x${(mismatch.ram.addr ?? 0).toString(16)} (${mismatch.ram.a}->${mismatch.ram.b})`
          : `return oracle=${mismatch.retOracle} cand=${mismatch.retCand}`),
  );
  assert.equal(count, 256, "must have compared all 256 SUBSTATE_TIMER values");
  console.log(`  EQUAL/exhaustive: ${count} SUBSTATE_TIMER values — RAM + return identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * BUG: tests the value BEFORE the decrement instead of after. Writes the correct RAM
 * (still decrements), so the RAM diff can never see it — only the return diverges,
 * and only at 0x6009 ∈ {0,1}. A gate that skips those edges or ignores the return
 * would pass this.
 */
function brokenPreDecrementCompare(m) {
  const { mem } = m;
  const old = mem.read8(SUBSTATE_TIMER);
  mem.write8(SUBSTATE_TIMER, (old - 1) & 0xff);
  return old === 0;
}

/** BUG: decrements by two — writes the wrong SUBSTATE_TIMER byte. Caught by the RAM diff. */
function brokenDoubleDecrement(m) {
  const { mem } = m;
  const remaining = (mem.read8(SUBSTATE_TIMER) - 2) & 0xff;
  mem.write8(SUBSTATE_TIMER, remaining);
  return remaining === 0;
}

test("TEETH (exhaustive): the pre-decrement-compare twin is CAUGHT (return check has teeth)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, brokenPreDecrementCompare);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a pre/post-decrement compare bug — the return check is worthless");
  assert.equal(mismatch.ram, null, "this twin writes correct RAM; it must be caught by the RETURN check, not RAM");
  console.log(
    `  TEETH/return: caught after ${count} values at 0x6009=${hx(mismatch.v)} ` +
      `(oracle=${mismatch.retOracle} broken=${mismatch.retCand})`,
  );
});

test("TEETH (exhaustive): the double-decrement twin is CAUGHT (memory check has teeth)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = sweep(base, brokenDoubleDecrement);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong SUBSTATE_TIMER write — the RAM check is worthless");
  assert.notEqual(mismatch.ram, null, "the double-decrement twin must be caught by the RAM diff");
  console.log(`  TEETH/memory: caught — SUBSTATE_TIMER diverges at 0x6009=${hx(mismatch.v)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x0018 in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed to a clean stop. rst 0x18 is a hot substate-timing helper, so attract
 * dispatches it many times.
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

test("REALISM: real captured rst-0x18 dispatches — tickSubstateTimer matches oracle RAM + return", () => {
  const caps = captureDispatches(128, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x0018 dispatch during attract");

  for (const cap of caps) {
    const before = cap.mem.read8(SUBSTATE_TIMER);
    const { ram, retOracle, retCand } = runPair(cap, tickSubstateTimer);
    assert.equal(
      ram,
      null,
      ram && `RAM diverges on real dispatch (0x6009 in=${hx(before)}) at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
    assert.equal(
      retCand,
      retOracle,
      `return diverges on real dispatch (0x6009 in=${hx(before)}): oracle=${retOracle} cand=${retCand}`,
    );
  }
  console.log(`  REALISM: ${caps.length} real rst-0x18 dispatches — RAM + return == oracle`);
});
