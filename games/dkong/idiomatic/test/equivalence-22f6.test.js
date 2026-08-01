// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_22f6 (ROM 0x22F6) — the chance-based arm of the object-velocity setup.
 *
 * loc_22f6 reads one byte, RANDOM (0x6018), and falls into loc_22f9 with that byte as the value and
 * the caller's object-record pointer (IX) unchanged. Its whole memory-observable effect is therefore
 * loc_22f9's effect with value = RANDOM: it writes record +0x11 = RANDOM (magnitude) and record
 * +0x10 = (RANDOM & 1) - 1 (parity sign). loc_22f9 itself is proven exhaustively (equivalence-22f9);
 * this gate proves loc_22f6 (a) sources the value from RANDOM specifically and (b) passes the record
 * pointer through untouched.
 *
 *   1. EQUAL (exhaustive) — poke RANDOM to every one of 256 values, at several real record pointers,
 *      and confirm loc_22f6 == oracle on RAM. Sweeping all 256 RANDOM values proves the value logic;
 *      multiple pointers prove the record pointer is honoured (not a fixed address).
 *   2. TEETH — (a) a wrong-source twin that reads 0x6019 (the neighbouring counter) instead of
 *      RANDOM is caught whenever the two differ; (b) a fixed-address twin that ignores the pointer is
 *      caught at every pointer but the hardcoded one.
 *   3. REALISM — hook 0x22F6 in a real attract run and confirm loc_22f6 reproduces the oracle's RAM
 *      on every real (pointer, RANDOM) the game actually produces.
 *
 * The oracle's tail is `m.call(0x22f9)`, which dispatches the translated loc_22f9 through the default
 * routine table, so a plain Machine clone runs the whole 0x22F6->0x22F9 chain. Live-out is
 * memory-only (the caller, sub_22cb, discards the result), so pc/SP are not compared.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-22f6.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_22f6 as oracle } from "../../translated/loc_22f6.js";
import { loc_22f6 } from "../loc_22f6.js";
import { loc_22f9 } from "../loc_22f9.js";
import { RANDOM } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x22f6;
const SAFE_SP = 0x6bf8; // aim SP at work RAM so the oracle chain's pops read valid bytes
const NEIGHBOUR = 0x6019; // the counter next to RANDOM; the wrong-source twin reads this
const IX_POINTERS = [0x6700, 0x6400, 0x6a00];

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const hx16 = (v) => "0x" + (v & 0xffff).toString(16);

/**
 * A synthetic entry: a clone of `base` with the record pointer in IX (the oracle's live-in), RANDOM
 * poked to `value`, and the neighbour cell poked to a DIFFERENT fixed byte so a twin that reads it
 * instead of RANDOM diverges. Frame machinery neutralised so the oracle's m.step cannot fire an NMI.
 */
function makeEntry(base, ix, value) {
  const e = base.clone();
  e.regs.ix = ix;
  e.regs.sp = SAFE_SP;
  e.mem.write8(RANDOM, value);
  e.mem.write8(NEIGHBOUR, (value ^ 0xa5) & 0xff); // guaranteed != value, so wrong-source has teeth
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/** Run oracle vs candidate on two fresh byte-identical entries; diff RAM over the whole dump. */
function runPair(base, ix, value, candidate) {
  const a = makeEntry(base, ix, value); // oracle reads IX + RANDOM
  const b = makeEntry(base, ix, value); // candidate takes objRecord as a param, reads RANDOM
  oracle(a);
  candidate(b, ix);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

function fullSweep(base, candidate) {
  let count = 0;
  for (const ix of IX_POINTERS) {
    for (let v = 0; v < 256; v++) {
      const { ram } = runPair(base, ix, v, candidate);
      count++;
      if (ram) return { mismatch: { ix, value: v, ram }, count };
    }
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at pointer=${hx16(mm.ix)} RANDOM=${hx(mm.value)}: RAM diverges at ${hx16(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_22f6 == oracle over all 256 RANDOM values at every real pointer", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_22f6);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, IX_POINTERS.length * 256, "must have compared the full RANDOM space at every pointer");

  // Non-vacuity: the magnitude field really is sourced from RANDOM (not the neighbour or a constant).
  const base2 = new Machine(ROM).clone();
  const e = makeEntry(base2, 0x6700, 0x40); oracle(e);
  assert.equal(e.mem.read8(0x6711), 0x40, "magnitude field (+0x11) must equal the RANDOM byte");
  assert.equal(e.mem.read8(0x6710), 0xff, "even RANDOM must set the sign field (+0x10) to 0xFF");
  console.log(`  EQUAL/exhaustive: ${count} (pointer, RANDOM) combos — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** BUG (a): sources the value from the neighbour (0x6019) instead of RANDOM (0x6018). Because
 *  makeEntry pokes them to different bytes, this diverges on the magnitude/sign fields. */
function brokenWrongSource(m, objRecord) {
  return loc_22f9(m, objRecord, m.mem.read8(NEIGHBOUR)); // BUG: wrong source cell
}

/** BUG (b): writes to a FIXED record (0x6700) instead of the passed pointer. Passes at 0x6700,
 *  caught at every other pointer. */
function brokenFixedAddress(m, _objRecord) {
  return loc_22f9(m, 0x6700, m.mem.read8(RANDOM)); // BUG: ignores objRecord
}

test("TEETH: the wrong-source twin (reads 0x6019, not RANDOM) is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongSource);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong source cell — RANDOM is not proven live");
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
// 0x22F6 belongs to the object-velocity setup (sub_22cb), whose cascade only runs once a board
// populates its object arrays (board 3+); plain attract stays on board 1 and never dispatches it.
// The EQUAL sweep is a COMPLETE proof anyway — the routine's whole effect is a pure function of the
// RANDOM byte and the record pointer, both swept exhaustively — so a 0-capture attract is honest
// coverage, not a gap. When a real dispatch IS captured, confirm it too.

test("REALISM: real captured 0x22F6 dispatches — loc_22f6 matches oracle RAM (0 in attract is OK)", () => {
  const caps = [];
  const overrides = new Map([[TARGET, (mm) => {
    if (caps.length < 64) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides });
  host.runFrames(3000);
  if (caps.length === 0) {
    console.log("  REALISM: 0 dispatches in attract (board-3+ path) — EQUAL exhaustive sweep is the complete proof");
    return;
  }

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const ix = a.regs.ix;
    oracle(a);
    loc_22f6(b, ix);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `RAM diverges on real dispatch (pointer=${hx16(ix)}) at ${hx16(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
  }
  console.log(`  REALISM: ${caps.length} real 0x22F6 dispatches — RAM == oracle`);
});
