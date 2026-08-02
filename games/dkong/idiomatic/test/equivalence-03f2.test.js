// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_03f2 (ROM 0x03F2) — the spin-jittered byte store helper.
 *
 * sub_03f2 is a LEAF whose entire memory-observable behaviour is a function of THREE
 * inputs — the destination address (a caller register), the byte to store (a caller
 * register), and the low bit of SPIN_COUNT (0x6019). It writes ONLY the caller's
 * destination cell: the byte unconditionally, then the byte + 1 at the SAME cell unless
 * the spin low bit is set. It returns nothing a caller consumes. Everything else the
 * oracle touches (residual registers/flags, the SP/PC churn of its `ret`s) never reaches
 * RAM, so the contract is memory-only. That makes an EXHAUSTIVE gate available, because
 * the effect factorises cleanly and each sweep varies exactly the input its check needs:
 *
 *   CORE — byte × spin-low-bit at the real destination (0x6A29): all 256 bytes (covering
 *          the +1 wrap at 0xFF -> 0x00) crossed with the low bit clear/set. Exercises both
 *          branches and both stored values.
 *   SPIN — all 256 SPIN_COUNT values at a fixed byte: proves ONLY the low bit is consulted
 *          (the high 7 bits must not change the branch).
 *   DEST — a set of work-RAM destinations, both branches: proves the write is POINTER-
 *          relative, not hardcoded. Includes the self-referential destination == SPIN_COUNT,
 *          which pins the store-then-read order (the first store lands before the spin read).
 *
 * Together these cover the full (destination, byte, spin) space by that factorisation, so
 * this is a proof over the reachable input space, not a sample.
 *
 *   1. EQUAL (exhaustive) — loc_03f2 == oracle on RAM (firstStateDiff over the whole dump,
 *      which neither side writes outside the destination cell) across all three sweeps. Each
 *      entry pre-loads the destination with a sentinel distinct from the stored bytes, so a
 *      missing or mis-targeted write cannot hide behind a coincidentally-equal prior value.
 *
 *   2. TEETH (exhaustive) — four deliberately-broken twins, one per check, each of which the
 *      same sweeps MUST catch:
 *        (a) no-first-store — drops the unconditional store; on set-bit frames it writes
 *            nothing, leaving the sentinel. Caught by the CORE sweep on the set-bit branch.
 *        (b) inverted parity — bumps on set instead of clear; writes the wrong value on every
 *            frame. Caught immediately.
 *        (c) hardcoded destination — always writes 0x6A29, ignoring the caller pointer. Caught
 *            by the DEST sweep wherever the destination differs.
 *        (d) wrong spin bit — tests bit 7 instead of bit 0. Caught wherever the two bits
 *            disagree (e.g. spin 0x01).
 *
 *   3. REALISM (captured dispatches) — hook 0x03F2 in a real attract run (sub_03a2 m.calls it
 *      many times per attract via its periodic servicing), clone the machine at each true
 *      dispatch, and confirm loc_03f2 reproduces the oracle's RAM on every real state.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-03f2.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_03f2 as oracle } from "../../translated/loc_03f2.js";
import { loc_03f2 } from "../loc_03f2.js";
import { SPIN_COUNT } from "../ram.js";
import { u8 } from "../../../../core/int.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x03f2;
// The real caller (sub_03a2) hands this destination (a sprite-buffer cell) and byte.
const REAL_DEST = 0x6a29;
const REAL_BYTE = 0x42;
// A sentinel pre-loaded at the destination so a missing/mis-targeted write is visible.
const SENTINEL = 0xcc;
// The oracle's `ret`s pop the stack; point SP at work RAM so those pops read valid bytes
// (never I/O). The oracle writes no RAM through the stack (a leaf: only pops), so this
// choice never affects the compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the destination register/byte set, SPIN_COUNT
 * set, the destination pre-loaded with a sentinel, and a safe stack. Frame machinery is
 * neutralised (clone() already sets nextNmi/nextBoundary = Infinity; re-asserted for
 * clarity) so the oracle's `m.step` cannot fire an NMI or push a frame in isolation. The
 * sentinel is written BEFORE SPIN_COUNT so the degenerate destination == SPIN_COUNT still
 * ends with SPIN_COUNT == spin (identical for both sides).
 */
function makeEntry(base, dest, byte, spin) {
  const e = base.clone();
  e.mem.write8(dest, SENTINEL);
  e.mem.write8(SPIN_COUNT, spin);
  e.regs.hl = dest;
  e.regs.b = byte;
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). A fresh entry per side because the
 * routine WRITES memory — a reused machine would carry the previous run forward.
 *
 * @returns {{ram: object|null}}
 */
function runPair(base, dest, byte, spin, candidate) {
  const a = makeEntry(base, dest, byte, spin); // oracle
  const b = makeEntry(base, dest, byte, spin); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/**
 * The three disjoint sweeps, run in sequence. Returns the first mismatch (or null) and the
 * total combos compared. By the factorisation in the file header these together cover the
 * whole (destination, byte, spin) input space.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // CORE — byte × spin-low-bit at the real destination. Covers the +1 wrap (byte 0xFF) and
  // both branches (spin 0x00 = low bit clear -> bump; 0x01 = low bit set -> no bump).
  for (let byte = 0; byte < 256; byte++) {
    for (const spin of [0x00, 0x01]) {
      const { ram } = runPair(base, REAL_DEST, byte, spin, candidate);
      count++;
      if (ram) return { mismatch: { dest: REAL_DEST, byte, spin, ram }, count };
    }
  }

  // SPIN — all 256 SPIN_COUNT values at a fixed byte. Proves only the low bit selects the
  // branch: the other seven bits must not change the written value.
  for (let spin = 0; spin < 256; spin++) {
    const { ram } = runPair(base, REAL_DEST, REAL_BYTE, spin, candidate);
    count++;
    if (ram) return { mismatch: { dest: REAL_DEST, byte: REAL_BYTE, spin, ram }, count };
  }

  // DEST — pointer-relative write across work RAM, both branches. Includes the self-
  // referential destination == SPIN_COUNT (store-then-read order) and the high work-RAM
  // boundary 0x6BFF.
  const DESTS = [0x6000, 0x6402, 0x6800, REAL_DEST, 0x6bff, SPIN_COUNT];
  for (const dest of DESTS) {
    for (const spin of [0x00, 0x01]) {
      const { ram } = runPair(base, dest, REAL_BYTE, spin, candidate);
      count++;
      if (ram) return { mismatch: { dest, byte: REAL_BYTE, spin, ram }, count };
    }
  }

  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at dest=0x${mm.dest.toString(16)} byte=${hx(mm.byte)} spin=${hx(mm.spin)}: ` +
    `RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

const EXPECTED_COMBOS = 256 * 2 + 256 + 6 * 2;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_03f2 == oracle across all three sweeps", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_03f2);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, EXPECTED_COMBOS, "must have compared the full factored input space");
  console.log(`  EQUAL/exhaustive: ${count} (dest, byte, spin) combos — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): drops the unconditional first store. On set-bit frames nothing is written, so the
 *  destination keeps the sentinel. Caught by the CORE sweep on the set-bit branch. */
function brokenNoFirstStore(m) {
  const { regs, mem } = m;
  const dest = regs.hl, value = regs.b;
  // BUG: missing `mem.write8(dest, value)` here.
  if ((mem.read8(SPIN_COUNT) & 1) === 0) mem.write8(dest, u8(value + 1));
}

/** BUG (b): bumps on the SET bit instead of the CLEAR bit — the wrong value on every frame. */
function brokenInvertedParity(m) {
  const { regs, mem } = m;
  const dest = regs.hl, value = regs.b;
  mem.write8(dest, value);
  if ((mem.read8(SPIN_COUNT) & 1) !== 0) mem.write8(dest, u8(value + 1)); // BUG: should be === 0
}

/** BUG (c): always writes the real destination, ignoring the caller pointer. Caught by DEST. */
function brokenHardcodedDest(m) {
  const { regs, mem } = m;
  const value = regs.b;
  mem.write8(REAL_DEST, value); // BUG: should be regs.hl
  if ((mem.read8(SPIN_COUNT) & 1) === 0) mem.write8(REAL_DEST, u8(value + 1));
}

/** BUG (d): tests bit 7 of SPIN_COUNT instead of bit 0. Caught where the two bits disagree. */
function brokenWrongSpinBit(m) {
  const { regs, mem } = m;
  const dest = regs.hl, value = regs.b;
  mem.write8(dest, value);
  if ((mem.read8(SPIN_COUNT) & 0x80) === 0) mem.write8(dest, u8(value + 1)); // BUG: should be & 1
}

test("TEETH (exhaustive): the no-first-store twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenNoFirstStore);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped unconditional store — worthless");
  assert.notEqual(mismatch.ram, null, "the no-first-store twin must be caught by the RAM diff");
  console.log(`  TEETH/first-store: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the inverted-parity twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenInvertedParity);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted spin branch — worthless");
  console.log(`  TEETH/parity: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the hardcoded-destination twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenHardcodedDest);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a hardcoded destination — worthless");
  console.log(`  TEETH/dest: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-spin-bit twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongSpinBit);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong spin bit — worthless");
  console.log(`  TEETH/spin-bit: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x03F2 in a real attract run and clone the machine at up to K real dispatches.
 * sub_03a2's periodic servicing m.calls it many times per attract, so dispatches are plentiful.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed to a clean stop.
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

test("REALISM: real captured 0x03F2 dispatches — loc_03f2 matches oracle RAM", () => {
  const caps = captureDispatches(200, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x03F2 dispatch during attract");

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const hl = a.regs.hl, byte = a.regs.b, spin = a.mem.read8(SPIN_COUNT);
    oracle(a);
    loc_03f2(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (dest=0x${hl.toString(16)} byte=${hx(byte)} spin=${hx(spin)}) ` +
          `at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x03F2 dispatches — RAM == oracle`);
});
