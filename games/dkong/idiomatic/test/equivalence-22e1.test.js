// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_22e1 (ROM 0x22E1) — the level-based arm of the object-velocity setup.
 *
 * loc_22e1 reads one byte, LEVEL (0x6229), maps it to a velocity magnitude (level 1 -> 0x01,
 * level 2 -> 0xB1, every other level -> 0xE9), and falls into loc_22f9 with that byte and the
 * caller's object-record pointer (IX) unchanged. Its whole memory-observable effect is therefore
 * loc_22f9's effect with value = the level-picked magnitude: it writes record +0x11 = magnitude
 * and record +0x10 = (magnitude & 1) - 1 (all three magnitudes are odd, so +0x10 is always 0x00).
 * loc_22f9 itself is proven exhaustively (equivalence-22f9); this gate proves loc_22e1 (a) picks
 * the magnitude from LEVEL with the exact 1 / 2 / else thresholds and (b) passes the record
 * pointer through untouched.
 *
 *   1. EQUAL (exhaustive) — poke LEVEL to every one of 256 values, at several real record
 *      pointers, and confirm loc_22e1 == oracle on RAM. Sweeping all 256 LEVEL values proves the
 *      pick logic (both special cases and the shared else); multiple pointers prove the record
 *      pointer is honoured (not a fixed address).
 *   2. TEETH — (a) a constant-magnitude twin (always 0xE9) is caught at level 1 and 2, proving
 *      the special cases are real; (b) an off-by-one twin (thresholds shifted down one) is caught,
 *      proving the exact 1 / 2 thresholds; (c) a wrong-source twin that reads the neighbouring cell
 *      (0x622A) instead of LEVEL is caught whenever the two pick different branches; (d) a
 *      fixed-address twin that ignores the pointer is caught at every pointer but the hardcoded one.
 *   3. REALISM — hook 0x22E1 in a real attract run and confirm loc_22e1 reproduces the oracle's RAM
 *      on every real (pointer, LEVEL) the game actually produces (0 in plain attract is honest).
 *
 * The oracle's tail is `m.call(0x22f9)`, which dispatches the translated loc_22f9 through the
 * default routine table, so a plain Machine clone runs the whole 0x22E1->0x22F9 chain. The only
 * stack op in that chain is loc_22f9's terminal `ret`, which POPS (a read, never a write), so no
 * STACK_SCRATCH exclusion is needed — SP is aimed at valid work RAM so the pop is well-defined.
 * Live-out is memory-only (the caller, sub_22cb, discards the result), so pc/SP are not compared.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-22e1.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_22e1 as oracle } from "../../translated/loc_22e1.js";
import { loc_22e1 } from "../loc_22e1.js";
import { loc_22f9 } from "../loc_22f9.js";
import { LEVEL } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x22e1;
const SAFE_SP = 0x6bf8;   // aim SP at work RAM so the oracle chain's pop reads valid bytes
const NEIGHBOUR = 0x622a; // the byte right after LEVEL; the wrong-source twin reads this
const IX_POINTERS = [0x6700, 0x6400, 0x6a00];

// The level-based magnitude pick, as a reference for the twins and non-vacuity checks.
const magnitudeForLevel = (lvl) => (lvl === 1 ? 0x01 : lvl === 2 ? 0xb1 : 0xe9);

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const hx16 = (v) => "0x" + (v & 0xffff).toString(16);

/**
 * A synthetic entry: a clone of `base` with the record pointer in IX (the oracle's live-in),
 * LEVEL poked to `level`, and the neighbour cell poked to a byte that maps to a DIFFERENT
 * magnitude branch (level+1) so a twin that reads it instead of LEVEL diverges. Frame machinery
 * neutralised so the oracle's m.step cannot fire an NMI.
 */
function makeEntry(base, ix, level) {
  const e = base.clone();
  e.regs.ix = ix;
  e.regs.sp = SAFE_SP;
  e.mem.write8(LEVEL, level);
  e.mem.write8(NEIGHBOUR, (level + 1) & 0xff); // maps to a different branch than `level` for some level
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/** Run oracle vs candidate on two fresh byte-identical entries; diff RAM over the whole dump. */
function runPair(base, ix, level, candidate) {
  const a = makeEntry(base, ix, level); // oracle reads IX + LEVEL
  const b = makeEntry(base, ix, level); // candidate takes objRecord as a param, reads LEVEL
  oracle(a);
  candidate(b, ix);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

function fullSweep(base, candidate) {
  let count = 0;
  for (const ix of IX_POINTERS) {
    for (let lvl = 0; lvl < 256; lvl++) {
      const { ram } = runPair(base, ix, lvl, candidate);
      count++;
      if (ram) return { mismatch: { ix, level: lvl, ram }, count };
    }
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at pointer=${hx16(mm.ix)} LEVEL=${hx(mm.level)}: RAM diverges at ${hx16(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_22e1 == oracle over all 256 LEVEL values at every real pointer", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_22e1);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, IX_POINTERS.length * 256, "must have compared the full LEVEL space at every pointer");

  // Non-vacuity: the three level branches map to their distinct magnitudes, sourced from LEVEL.
  const base2 = new Machine(ROM).clone();
  for (const [lvl, mag] of [[1, 0x01], [2, 0xb1], [3, 0xe9]]) {
    const e = makeEntry(base2, 0x6700, lvl); oracle(e);
    assert.equal(e.mem.read8(0x6711), mag, `LEVEL ${lvl} must pick magnitude ${hx(mag)} into +0x11`);
    assert.equal(e.mem.read8(0x6710), 0x00, `odd magnitude must clear the sign field (+0x10) to 0x00 at LEVEL ${lvl}`);
  }
  console.log(`  EQUAL/exhaustive: ${count} (pointer, LEVEL) combos — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** BUG (a): always uses the shared (else) magnitude 0xE9, dropping the level 1 / 2 special cases.
 *  Caught at LEVEL 1 (0x01 vs 0xE9) and LEVEL 2 (0xB1 vs 0xE9). */
function brokenConstantMagnitude(m, objRecord) {
  return loc_22f9(m, objRecord, 0xe9); // BUG: ignores the special cases
}

/** BUG (b): thresholds shifted down one (level 0 -> 0x01, level 1 -> 0xB1, else 0xE9). Caught
 *  wherever the shifted pick differs from the real one. */
function brokenOffByOne(m, objRecord) {
  const lvl = m.mem.read8(LEVEL);
  const mag = lvl === 0 ? 0x01 : lvl === 1 ? 0xb1 : 0xe9; // BUG: off-by-one thresholds
  return loc_22f9(m, objRecord, mag);
}

/** BUG (c): sources the level from the neighbouring cell (0x622A) instead of LEVEL (0x6229).
 *  Because makeEntry pokes them to values that pick different branches, this diverges. */
function brokenWrongSource(m, objRecord) {
  const lvl = m.mem.read8(NEIGHBOUR); // BUG: wrong source cell
  return loc_22f9(m, objRecord, magnitudeForLevel(lvl));
}

/** BUG (d): writes to a FIXED record (0x6700) instead of the passed pointer. Passes at 0x6700,
 *  caught at every other pointer. */
function brokenFixedAddress(m, _objRecord) {
  const lvl = m.mem.read8(LEVEL);
  return loc_22f9(m, 0x6700, magnitudeForLevel(lvl)); // BUG: ignores objRecord
}

test("TEETH: the constant-magnitude twin is CAUGHT (the level 1/2 special cases are proven)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenConstantMagnitude);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a constant magnitude — the special cases are not proven");
  console.log(`  TEETH/constant-magnitude: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH: the off-by-one-threshold twin is CAUGHT (exact 1/2 thresholds proven)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenOffByOne);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch shifted thresholds — the exact levels are not proven");
  console.log(`  TEETH/off-by-one: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH: the wrong-source twin (reads 0x622A, not LEVEL) is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongSource);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong source cell — LEVEL is not proven live");
  console.log(`  TEETH/wrong-source: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH: the fixed-address twin is CAUGHT (record-pointer passthrough proven)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenFixedAddress);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a fixed-address write — the pointer isn't proven live");
  assert.notEqual(mismatch.ix, 0x6700, "the fixed-address twin should first diverge at a pointer other than 0x6700");
  console.log(`  TEETH/fixed-address: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------
// 0x22E1 belongs to the object-velocity setup (sub_22cb), whose cascade only runs once a board
// populates its object arrays; plain attract stays on board 1 and never dispatches it. The EQUAL
// sweep is a COMPLETE proof anyway — the routine's whole effect is a pure function of LEVEL and the
// record pointer, both swept exhaustively — so a 0-capture attract is honest coverage, not a gap.
// When a real dispatch IS captured, confirm it too.

test("REALISM: real captured 0x22E1 dispatches — loc_22e1 matches oracle RAM (0 in attract is OK)", () => {
  const caps = [];
  const overrides = new Map([[TARGET, (mm) => {
    if (caps.length < 64) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides });
  host.runFrames(3000);
  if (caps.length === 0) {
    console.log("  REALISM: 0 dispatches in attract (board-object path) — EQUAL exhaustive sweep is the complete proof");
    return;
  }

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const ix = a.regs.ix;
    oracle(a);
    loc_22e1(b, ix);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `RAM diverges on real dispatch (pointer=${hx16(ix)}) at ${hx16(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
  }
  console.log(`  REALISM: ${caps.length} real 0x22E1 dispatches — RAM == oracle`);
});
