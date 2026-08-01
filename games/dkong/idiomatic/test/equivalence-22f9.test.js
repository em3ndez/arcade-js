// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_22f9 (ROM 0x22F9) — the store tail of the object-velocity setup.
 *
 * loc_22f9 is a LEAF whose entire memory-observable effect is a pure function of two live
 * inputs — the object-record pointer (IX) and the dispatched byte (A) — writing exactly two
 * fields of that record:
 *
 *   record +0x11  <-  value            (verbatim magnitude)
 *   record +0x10  <-  (value & 1) - 1  (0x00 when value odd, 0xFF when even — a sign byte)
 *
 * It writes no other RAM and returns nothing a caller consumes (loc_2146 reloads the byte from
 * (ix+0x05) immediately after), so the contract is memory-only: RAM over the whole dump. The
 * oracle's terminal `ret` only POPS the stack (a read, never a write), so it perturbs no RAM and
 * needs no STACK_SCRATCH exclusion — SP is aimed at valid work RAM so the pop is well-defined.
 *
 * Because both written fields are pure functions of the value, an EXHAUSTIVE gate is available:
 *
 *   1. EQUAL (exhaustive) — for each of several REAL object-record pointers, sweep the value over
 *      all 256 possibilities and confirm loc_22f9 == oracle on RAM. Sweeping all 256 values proves
 *      the value logic (magnitude + parity-derived sign) completely; using MULTIPLE distinct
 *      pointers proves the two fields are addressed relative to the record — a routine that wrote
 *      to a fixed address would pass at one pointer and fail at the next.
 *
 *   2. TEETH (exhaustive) — three deliberately-broken twins, each of which the same sweep MUST
 *      catch:
 *        (a) dropped-sign — writes (value & 1) instead of (value & 1) - 1, so the sign field is
 *            off by one on every value; caught at record +0x10.
 *        (b) swapped-field — writes the value to +0x10 and the sign to +0x11; caught wherever the
 *            two differ (i.e. almost every value).
 *        (c) fixed-address — writes to a hardcoded record (ignoring the pointer); passes at that
 *            one pointer but caught at every other one, proving record-relative addressing.
 *
 *   3. REALISM (captured dispatches) — hook 0x22F9 in a real attract run (the object-velocity
 *      setup dispatches it as objects are loaded), clone the machine at each true dispatch, and
 *      confirm loc_22f9 reproduces the oracle's RAM on every real (pointer, value) the game
 *      actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-22f9.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_22f9 as oracle } from "../../translated/loc_22f9.js";
import { loc_22f9 } from "../loc_22f9.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x22f9;
// The oracle's `ret` pops the stack; aim SP at work RAM so that pop reads valid bytes (never I/O).
// The oracle writes no RAM through the stack (a leaf: only pops), so this never affects the
// compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

// Real object-record pointers used by the sweep. 0x6700 is the pointer attract actually dispatches
// with; the others are distinct in-work-RAM records (their +0x10/+0x11 fields land in dumped work
// RAM, clear of the stack) so a fixed-address bug cannot hide behind a single pointer.
const IX_POINTERS = [0x6700, 0x6400, 0x6a00];

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const hx16 = (v) => "0x" + (v & 0xffff).toString(16);

/**
 * A synthetic entry: a clone of `base` with the object pointer and dispatched byte placed in the
 * registers the oracle reads (IX, A) and a safe stack. The frame machinery is neutralised
 * (clone() sets nextNmi/nextBoundary = Infinity; re-asserted here) so the oracle's `m.step` cannot
 * fire an NMI or push a frame while running in isolation.
 */
function makeEntry(base, ix, value) {
  const e = base.clone();
  e.regs.ix = ix;
  e.regs.a = value;
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff RAM over the
 * whole dump (the memory-equivalence contract; live-out is memory-only, so pc/SP are not
 * compared — the oracle rets and the candidate does not). A fresh entry per side because the
 * routine WRITES memory. The candidate takes its inputs as honest parameters, extracted from the
 * same (ix, value) the oracle reads from its registers.
 *
 * @returns {{ram: object|null}}
 */
function runPair(base, ix, value, candidate) {
  const a = makeEntry(base, ix, value); // oracle reads IX + A
  const b = makeEntry(base, ix, value); // candidate takes honest params
  oracle(a);
  candidate(b, ix, value);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/**
 * The exhaustive sweep: for every real pointer, all 256 values. Returns the first mismatch (or
 * null) and the total combos compared.
 */
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
  `at pointer=${hx16(mm.ix)} value=${hx(mm.value)}: ` +
    `RAM diverges at ${hx16(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_22f9 == oracle over all 256 values at every real pointer", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_22f9);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, IX_POINTERS.length * 256, "must have compared the full value space at every pointer");

  // Non-vacuity: both fields really are written, and the sign field splits on parity as claimed.
  const base2 = new Machine(ROM).clone();
  const even = makeEntry(base2, 0x6700, 0x40); oracle(even);
  assert.equal(even.mem.read8(0x6711), 0x40, "magnitude field (+0x11) must hold the value verbatim");
  assert.equal(even.mem.read8(0x6710), 0xff, "even value must set the sign field (+0x10) to 0xFF");
  const odd = makeEntry(base2, 0x6700, 0x41); oracle(odd);
  assert.equal(odd.mem.read8(0x6711), 0x41, "magnitude field (+0x11) must hold the value verbatim");
  assert.equal(odd.mem.read8(0x6710), 0x00, "odd value must clear the sign field (+0x10) to 0x00");

  console.log(`  EQUAL/exhaustive: ${count} (pointer, value) combos — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): drops the `-1`, so the sign field is off by one on every value (0x01/0x00 instead
 *  of 0x00/0xFF). Caught by the RAM diff at record +0x10. */
function brokenDroppedSign(m, objRecord, value) {
  const { mem } = m;
  mem.write8((objRecord + 0x11) & 0xffff, value);
  mem.write8((objRecord + 0x10) & 0xffff, value & 1); // BUG: no `- 1`
}

/** BUG (b): swaps the two fields — value to +0x10, sign to +0x11. Caught wherever they differ. */
function brokenSwappedFields(m, objRecord, value) {
  const { mem } = m;
  mem.write8((objRecord + 0x10) & 0xffff, value); // BUG: fields swapped
  mem.write8((objRecord + 0x11) & 0xffff, (value & 1) - 1);
}

/** BUG (c): addresses a FIXED record (0x6700) instead of the passed pointer. Passes at 0x6700,
 *  caught at every other pointer — proving the addressing must follow the pointer. */
function brokenFixedAddress(m, objRecord, value) {
  const { mem } = m;
  mem.write8((0x6700 + 0x11) & 0xffff, value); // BUG: ignores objRecord
  mem.write8((0x6700 + 0x10) & 0xffff, (value & 1) - 1);
}

test("TEETH (exhaustive): the dropped-sign twin is CAUGHT (sign field diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDroppedSign);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped sign decrement — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, (mismatch.ix + 0x10) & 0xffff, "the dropped-sign twin must diverge on the +0x10 field");
  console.log(`  TEETH/dropped-sign: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the swapped-field twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenSwappedFields);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch swapped fields — worthless");
  console.log(`  TEETH/swapped-field: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the fixed-address twin is CAUGHT (record-relative addressing proven)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenFixedAddress);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a fixed-address write — the pointer isn't proven live");
  assert.notEqual(mismatch.ix, 0x6700, "the fixed-address twin should first diverge at a pointer other than 0x6700");
  console.log(`  TEETH/fixed-address: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x22F9 in a real attract run and clone the machine at up to K real dispatches. The
 * object-velocity setup dispatches it as board objects are loaded. The wrapper clones the entry
 * state, then runs the oracle so the host game proceeds undisturbed.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const overrides = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides });
  host.runFrames(maxFrames);
  return caps;
}

test("REALISM: real captured 0x22F9 dispatches — loc_22f9 matches oracle RAM", () => {
  const caps = captureDispatches(64, 3000);
  assert.ok(caps.length >= 1, "expected at least one real 0x22F9 dispatch during attract");

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const ix = a.regs.ix, value = a.regs.a;
    oracle(a);
    loc_22f9(b, ix, value);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (pointer=${hx16(ix)} value=${hx(value)}) ` +
          `at ${hx16(ram.addr ?? 0)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x22F9 dispatches — RAM == oracle`);
});
