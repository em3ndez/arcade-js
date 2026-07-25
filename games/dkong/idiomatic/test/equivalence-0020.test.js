// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for tickSubstatePrescaler (ROM 0x0020) — the rst-0x20 skip helper,
 * the low/fast stage of the two-level sub-state countdown.
 *
 * sub_0020's entire memory-observable behaviour is a function of just TWO bytes:
 * SUBSTATE_TIMER_LO (0x6008) and SUBSTATE_TIMER (0x6009). It decrements 0x6008; if that
 * underflows to 0 it tail-jumps into rst 0x18, which decrements 0x6009 and reports its
 * expiry. Everything else the oracle touches (SP, the return address it pops, HL/A/F) is
 * the Z80 caller-skip *mechanism* the direct-call model replaces with the boolean
 * return — none of it reaches RAM, so none of it is in the contract. Note the oracle
 * chains into 0x0018 via `m.call`, which on a plain Machine (no overrides) resolves to
 * the frozen sub_0018 oracle; the candidate calls the proven-equal tickSubstateTimer
 * directly. Both leave RAM + the boolean identical, so the strongest gate is available:
 *
 *   1. EQUAL (exhaustive) — tickSubstatePrescaler == oracle over ALL 65,536 (lo,hi)
 *      combos of (0x6008, 0x6009), compared on BOTH halves of the contract: the
 *      resulting RAM (firstStateDiff over the whole dump, incl. the stack region —
 *      which neither side writes) AND the returned boolean. 256x256 is the complete
 *      input space, so this is a proof, not a sample.
 *
 *   2. TEETH (exhaustive) — two deliberately-broken twins the sweep MUST catch, one per
 *      half of the contract:
 *        (a) proceed-on-any-underflow (`return true` on prescaler underflow instead of
 *            the high half's expiry) — still decrements 0x6009, so it writes the SAME
 *            RAM and is invisible to the RAM diff; only the RETURN check catches it, and
 *            only when lo==1 and hi != 1. Proves the boolean check has teeth AND that
 *            the sweep exercises that edge.
 *        (b) double-decrement the prescaler (`-2`) — writes the WRONG 0x6008 byte;
 *            caught by the RAM diff. Proves the memory check has teeth.
 *
 *   3. REALISM (captured dispatches) — hook 0x0020 in a real attract run, clone the
 *      machine at each true rst-0x20 dispatch (fired from its timed-advance sites), and
 *      confirm tickSubstatePrescaler reproduces the oracle's RAM + return on every real
 *      state the game actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-0020.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0020 as oracle } from "../../translated/sub_0020.js";
import { tickSubstatePrescaler } from "../tickSubstatePrescaler.js";
import { tickSubstateTimer } from "../tickSubstateTimer.js";
import { SUBSTATE_TIMER_LO, SUBSTATE_TIMER } from "../../optimized/ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0020;
// The oracle's `pop hl` + `ret` (and, on the chained path, sub_0018's `ret`) read the
// stack; the not-yet-zero arm reads up to SP+3. Point SP low in work RAM so those reads
// stay valid (never I/O). It writes no RAM, so it never affects the compared state — it
// only keeps the oracle well-defined on the synthetic entries below.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Run the oracle and the candidate on two fresh clones of `entry` and diff the
 * memory-equivalence contract: RAM (whole dump) + the returned boolean. A FRESH clone
 * per side because the routine WRITES memory — a reused machine would carry the previous
 * tick forward (docs/06: only a pure read-only leaf may reuse a clone).
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

/** A synthetic entry: this machine with the two timer bytes set and a safe stack. */
function makeEntry(base, lo, hi) {
  const e = base.clone();
  e.mem.write8(SUBSTATE_TIMER_LO, lo);
  e.mem.write8(SUBSTATE_TIMER, hi);
  e.regs.sp = SAFE_SP;
  return e;
}

/**
 * Sweep a candidate against the oracle over all 65,536 (lo,hi) timer-byte combos.
 * Returns the first mismatch (RAM or return), or null, plus the count compared.
 */
function sweep(base, candidate) {
  let count = 0;
  for (let lo = 0; lo < 256; lo++) {
    for (let hi = 0; hi < 256; hi++) {
      const { ram, retOracle, retCand } = runPair(makeEntry(base, lo, hi), candidate);
      count++;
      if (ram || retOracle !== retCand) {
        return { mismatch: { lo, hi, ram, retOracle, retCand }, count };
      }
    }
  }
  return { mismatch: null, count };
}

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): tickSubstatePrescaler == oracle over all 65,536 (0x6008,0x6009) combos", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, tickSubstatePrescaler);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at 0x6008=${hx(mismatch.lo)} 0x6009=${hx(mismatch.hi)}: ` +
        (mismatch.ram
          ? `RAM diverges at 0x${(mismatch.ram.addr ?? 0).toString(16)} (${mismatch.ram.a}->${mismatch.ram.b})`
          : `return oracle=${mismatch.retOracle} cand=${mismatch.retCand}`),
  );
  assert.equal(count, 256 * 256, "must have compared all 65,536 (lo,hi) combos");
  console.log(`  EQUAL/exhaustive: ${count} (lo,hi) combos — RAM + return identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * BUG: on prescaler underflow it still ticks the high half (correct RAM) but returns
 * true unconditionally, ignoring whether 0x6009 actually expired. Writes the SAME RAM as
 * the oracle, so the RAM diff can never see it — only the return diverges, and only when
 * lo==1 (prescaler underflows) and hi != 1 (high half does NOT expire). A gate that
 * skips that edge or ignores the return would pass this.
 */
function brokenProceedOnAnyUnderflow(m) {
  const { mem } = m;
  const remaining = (mem.read8(SUBSTATE_TIMER_LO) - 1) & 0xff;
  mem.write8(SUBSTATE_TIMER_LO, remaining);
  if (remaining !== 0) return false;
  tickSubstateTimer(m); // still decrements 0x6009 — RAM stays correct
  return true; // BUG: should be the high half's expiry, not an unconditional proceed
}

/** BUG: decrements the prescaler by two — writes the wrong 0x6008 byte. Caught by RAM. */
function brokenDoubleDecrementPrescaler(m) {
  const { mem } = m;
  const remaining = (mem.read8(SUBSTATE_TIMER_LO) - 2) & 0xff;
  mem.write8(SUBSTATE_TIMER_LO, remaining);
  if (remaining !== 0) return false;
  return tickSubstateTimer(m);
}

test("TEETH (exhaustive): the proceed-on-any-underflow twin is CAUGHT (return check has teeth)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, brokenProceedOnAnyUnderflow);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong proceed decision — the return check is worthless");
  assert.equal(mismatch.ram, null, "this twin writes correct RAM; it must be caught by the RETURN check, not RAM");
  console.log(
    `  TEETH/return: caught after ${count} combos at 0x6008=${hx(mismatch.lo)} 0x6009=${hx(mismatch.hi)} ` +
      `(oracle=${mismatch.retOracle} broken=${mismatch.retCand})`,
  );
});

test("TEETH (exhaustive): the double-decrement-prescaler twin is CAUGHT (memory check has teeth)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = sweep(base, brokenDoubleDecrementPrescaler);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong 0x6008 write — the RAM check is worthless");
  assert.notEqual(mismatch.ram, null, "the double-decrement twin must be caught by the RAM diff");
  console.log(`  TEETH/memory: caught — 0x6008 diverges at 0x6008=${hx(mismatch.lo)} 0x6009=${hx(mismatch.hi)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x0020 in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed to a clean stop. rst 0x20 is the timed sub-state advance, dispatched from
 * the state handlers during attract.
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

test("REALISM: real captured rst-0x20 dispatches — tickSubstatePrescaler matches oracle RAM + return", () => {
  const caps = captureDispatches(128, 2000);
  assert.ok(caps.length >= 1, "expected at least one real 0x0020 dispatch during attract");

  for (const cap of caps) {
    const lo = cap.mem.read8(SUBSTATE_TIMER_LO);
    const hi = cap.mem.read8(SUBSTATE_TIMER);
    const { ram, retOracle, retCand } = runPair(cap, tickSubstatePrescaler);
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (0x6008 in=${hx(lo)} 0x6009 in=${hx(hi)}) at ` +
          `0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
    assert.equal(
      retCand,
      retOracle,
      `return diverges on real dispatch (0x6008 in=${hx(lo)} 0x6009 in=${hx(hi)}): oracle=${retOracle} cand=${retCand}`,
    );
  }
  console.log(`  REALISM: ${caps.length} real rst-0x20 dispatches — RAM + return == oracle`);
});
