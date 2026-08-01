// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2407 (ROM 0x2407) — the fixed-point nibble-spread subtract.
 *
 * sub_2407 is a pure arithmetic LEAF: it reads three bytes off the caller's object record
 * (the packed nibble-pair at +0x14 and the 16-bit operand at +0x12/+0x13), writes NO
 * memory, calls nothing, and leaves a single 16-bit result in the register pair the
 * callers read. Its live-out is exactly that number — loc_1bd8 stores its two halves back
 * into the record, sub_20c3 halves it and stores it, loc_2146 uses it as a coordinate;
 * none of them read any other register or flag before overwriting it, and the Z80 return
 * is just the function returning (pc/SP not modelled or compared).
 *
 * The result is a pure TOTAL function of the three input bytes, so it is validated the
 * strongest way — EXHAUSTIVELY against the frozen oracle, not by a whole-machine trace:
 *
 *   1. EQUAL (exhaustive) — loc_2407's returned value == the oracle's over the COMPLETE
 *      input space: every packed byte (256) x every operand high byte (256) x every
 *      operand low byte (256) = 16,777,216 combos. That is the entire domain the routine
 *      can ever see, so this is a proof, not a sample.
 *
 *   2. TEETH (exhaustive) — three deliberately-broken twins, each of which the same sweep
 *      MUST catch:
 *        (a) swapped-nibble spread — puts the two packed digits in each other's fixed-point
 *            slot; caught the first time the two digits differ.
 *        (b) dropped low-digit shift — leaves the low digit in the bottom nibble instead of
 *            the "sixteenths" position; caught on any nonzero low digit.
 *        (c) dropped borrow-wrap — subtracts without the 16-bit wrap, so a borrow yields a
 *            negative number where the oracle wraps; caught whenever the operand exceeds
 *            the spread (justifies the u16 in the routine).
 *
 *   3. REALISM + PURITY + MIRROR (captured dispatches) — hook 0x2407 in a real attract run
 *      (reached by m.call from the in-game object-physics cascade), clone the machine at
 *      each true dispatch, and for each confirm (a) the oracle writes NO memory (licensing
 *      the writes-nothing contract), (b) loc_2407 reproduces the oracle's returned value on
 *      every real state the game actually produces, and (c) it mirrors that value into the
 *      register pair the still-oracle callers read.
 *
 * The oracle writes no memory on any path, so the memory-equivalence RAM diff is trivially
 * empty (asserted by the purity check); the whole contract rides on the returned live-out,
 * which is why the sweeps and teeth compare that value. No STACK_SCRATCH exclusion is
 * needed — neither side writes the stack (the oracle's return only pops it).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2407.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_2407 as oracle } from "../../translated/sub_2407.js";
import { loc_2407 } from "../loc_2407.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2407;
// A scratch object-record base in work RAM; the three inputs are read off +0x12/+0x13/+0x14.
const RECORD = 0x6100;
// The oracle's trailing return pops the stack; point SP at work RAM so it reads valid bytes
// (never I/O). The oracle writes no memory (it only pops), so this never affects the result.
const SAFE_SP = 0x6bf8;

const hx16 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const hx8 = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Seed the three input bytes at the scratch record and a valid stack, then run the frozen
 * oracle and read back its 16-bit result from the register pair.
 *
 * The machine may be reused across combos: the oracle writes NO memory, so nothing
 * accumulates — only SP moves (reset each call) and the register pair (overwritten each
 * call). Inputs are re-seeded before the candidate so a mutating candidate cannot poison
 * the next oracle read.
 */
function runOracleResult(m, packed, hi, lo) {
  const { regs, mem } = m;
  regs.ix = RECORD;
  mem.write8((RECORD + 0x12) & 0xffff, hi);
  mem.write8((RECORD + 0x13) & 0xffff, lo);
  mem.write8((RECORD + 0x14) & 0xffff, packed);
  regs.sp = SAFE_SP;
  oracle(m);
  return regs.hl & 0xffff;
}

/** Seed the inputs for the candidate (no SP needed — it never touches the stack). */
function seedInputs(m, packed, hi, lo) {
  const { regs, mem } = m;
  regs.ix = RECORD;
  mem.write8((RECORD + 0x12) & 0xffff, hi);
  mem.write8((RECORD + 0x13) & 0xffff, lo);
  mem.write8((RECORD + 0x14) & 0xffff, packed);
}

/**
 * Compare a candidate's returned value against the oracle's over the FULL 256x256x256
 * (packed, operand-hi, operand-lo) space. Returns the first mismatch (or null) + the total
 * combos compared. A single reused machine keeps it tractable (~2.5s green).
 */
function fullSweep(candidate) {
  const m = new Machine(ROM).clone();
  let count = 0;
  for (let packed = 0; packed < 256; packed++) {
    for (let hi = 0; hi < 256; hi++) {
      for (let lo = 0; lo < 256; lo++) {
        const want = runOracleResult(m, packed, hi, lo);
        seedInputs(m, packed, hi, lo);
        // Do NOT mask the candidate's return here: the routine's contract is that it
        // hands back a proper 16-bit value (0..65535). Masking would re-wrap a twin that
        // dropped the borrow-wrap and hide the very bug the u16 in the routine prevents.
        const got = candidate(m);
        count++;
        if (got !== want) return { mismatch: { packed, hi, lo, want, got }, count };
      }
    }
  }
  return { mismatch: null, count };
}

// Render the candidate value honestly: a proper 16-bit result as hex, but a raw
// out-of-range value (e.g. a dropped-wrap twin's negative number) as-is, so a genuine
// catch is never disguised as an identical hex by masking.
const showResult = (v) => (Number.isInteger(v) && v >= 0 && v <= 0xffff ? hx16(v) : String(v));
const describeMismatch = (mm) =>
  mm &&
  `at packed=${hx8(mm.packed)} operand=${hx16((mm.hi << 8) | mm.lo)}: ` +
    `oracle=${hx16(mm.want)} loc=${showResult(mm.got)}`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_2407 == oracle over all 16,777,216 (packed, operand) combos", () => {
  const { mismatch, count } = fullSweep(loc_2407);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 * 256 * 256, "must have compared the full 16,777,216-combo input space");
  console.log(`  EQUAL/exhaustive: ${count} (packed, operand) combos — result identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): swaps the two packed digits into each other's fixed-point slot. Wrong the
 *  first time the digits differ (packed 0x01 -> oracle 0x0010, twin 0x0100). */
function brokenSwappedNibbles(m) {
  const { regs, mem } = m;
  const record = regs.ix;
  const packed = mem.read8((record + 0x14) & 0xffff);
  const highDigit = packed >> 4;
  const lowDigit = packed & 0x0f;
  const spread = (lowDigit << 8) | (highDigit << 4); // BUG: digits swapped
  const operand = (mem.read8((record + 0x12) & 0xffff) << 8) | mem.read8((record + 0x13) & 0xffff);
  return (spread - operand) & 0xffff;
}

/** BUG (b): leaves the low digit in the bottom nibble instead of the sixteenths position.
 *  Wrong on any nonzero low digit (packed 0x01 -> oracle 0x0010, twin 0x0001). */
function brokenNoLowShift(m) {
  const { regs, mem } = m;
  const record = regs.ix;
  const packed = mem.read8((record + 0x14) & 0xffff);
  const highDigit = packed >> 4;
  const lowDigit = packed & 0x0f;
  const spread = (highDigit << 8) | lowDigit; // BUG: low digit not shifted up by 4
  const operand = (mem.read8((record + 0x12) & 0xffff) << 8) | mem.read8((record + 0x13) & 0xffff);
  return (spread - operand) & 0xffff;
}

/** BUG (c): subtracts without the 16-bit wrap, so a borrow returns a negative number where
 *  the oracle wraps (packed 0x00, operand 0x0001 -> oracle 0xFFFF, twin -1). */
function brokenNoWrap(m) {
  const { regs, mem } = m;
  const record = regs.ix;
  const packed = mem.read8((record + 0x14) & 0xffff);
  const spread = ((packed >> 4) << 8) | ((packed & 0x0f) << 4);
  const operand = (mem.read8((record + 0x12) & 0xffff) << 8) | mem.read8((record + 0x13) & 0xffff);
  return spread - operand; // BUG: no u16 wrap on borrow
}

test("TEETH (exhaustive): the swapped-nibble twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = fullSweep(brokenSwappedNibbles);
  assert.notEqual(mismatch, null, "the exhaustive sweep FAILED to catch a swapped-nibble spread — it is worthless");
  console.log(`  TEETH/swap: caught after ${count} combos — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the dropped-low-shift twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = fullSweep(brokenNoLowShift);
  assert.notEqual(mismatch, null, "the exhaustive sweep FAILED to catch a dropped low-digit shift — it is worthless");
  console.log(`  TEETH/low-shift: caught after ${count} combos — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the dropped-borrow-wrap twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = fullSweep(brokenNoWrap);
  assert.notEqual(mismatch, null, "the exhaustive sweep FAILED to catch a dropped borrow-wrap — the u16 is unjustified");
  console.log(`  TEETH/no-wrap: caught after ${count} combos — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM + PURITY + MIRROR (captured dispatches) -----------------------

/**
 * Hook 0x2407 in a real attract run and clone the machine at up to K real dispatches.
 * 0x2407 is reached by m.call from the object-physics cascade (loc_1bd8/sub_20c3/loc_2146);
 * the construction-time override map intercepts the m.call, so each captured state is a
 * genuine mid-play entry with a valid stack and a real IX record. The wrapper clones the
 * entry state, then runs the oracle so the host game proceeds undisturbed to a clean stop.
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

test("REALISM + PURITY + MIRROR: real captured dispatches — oracle writes no memory, loc matches (return + regs)", () => {
  const caps = captureDispatches(128, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x2407 dispatch during attract");

  for (const cap of caps) {
    // PURITY + oracle result: run the oracle on a clone, confirm it mutated no RAM, and
    // read back its 16-bit result.
    const oc = cap.clone();
    const before = oc.dumpState();
    oracle(oc);
    const after = oc.dumpState();
    const wrote = firstStateDiff(before, after, (off) => oc.stateOffsetToAddr(off));
    assert.equal(
      wrote,
      null,
      wrote && `oracle wrote RAM at 0x${(wrote.addr ?? 0).toString(16)} (${wrote.a}->${wrote.b}) — not writes-nothing`,
    );
    const want = oc.regs.hl & 0xffff;

    // REALISM + MIRROR: loc_2407 reproduces the oracle's result — both as its return value
    // and as the register-pair mirror the still-oracle callers read.
    const cc = cap.clone();
    const got = loc_2407(cc); // unmasked: the routine must already return a 16-bit value
    assert.equal(
      got,
      want,
      `returned-result mismatch on real dispatch (ix=${hx16(cap.regs.ix)}): oracle=${hx16(want)} loc=${hx16(got)}`,
    );
    assert.equal(
      cc.regs.hl & 0xffff,
      want,
      `register-pair mirror mismatch: oracle=${hx16(want)} regs=${hx16(cc.regs.hl)}`,
    );
  }
  console.log(`  REALISM/purity/mirror: ${caps.length} real dispatches — no memory written, return + regs == oracle`);
});
