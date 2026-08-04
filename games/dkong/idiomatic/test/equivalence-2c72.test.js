// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for markNextBarrelAsAltKind (ROM 0x2C72) — set bit 7 of BARREL_CLAIM_MODE.
 *
 * markNextBarrelAsAltKind is a LEAF whose entire memory-observable behaviour is a function of ONE byte,
 * the value at BARREL_CLAIM_MODE, and it writes only that same byte back with its top bit forced on
 * (`value | 0x80`). It returns nothing a caller consumes: the oracle threads the value
 * through the accumulator and `ret`s, but its callers reload — so the contract is
 * memory-only. Because the input space is a single byte, an EXHAUSTIVE gate is a PROOF,
 * not a sample: all 256 starting values are swept.
 *
 * The oracle's terminal `ret` only READS the stack (a pop is never a memory write), and the
 * compared state is memory only (dumpState is RAM), so the candidate's plain JS return leaves
 * the compared memory identical to the oracle's — no stack-scratch exclusion is needed here.
 *
 *   1. EQUAL (exhaustive) — markNextBarrelAsAltKind == oracle on RAM (firstStateDiff over the whole dump, which
 *      neither side writes outside BARREL_CLAIM_MODE) for every one of the 256 possible starting bytes, and
 *      a non-vacuity check that the byte really became value|0x80 on both sides.
 *
 *   2. TEETH (exhaustive) — two deliberately-broken twins the same sweep MUST catch:
 *        (a) wrong bit — sets bit 6 (| 0x40) instead of bit 7; caught wherever the two masks
 *            disagree (justifies the 0x80).
 *        (b) clobbering store — writes a bare 0x80, destroying the low bits, instead of OR-ing
 *            them; caught on any starting value with a low bit set (justifies the read-modify-write).
 *
 *   3. REALISM (captured dispatches) — hook 0x2C72 in a real attract run (reached via the object-slot
 *      allocator's dispatch), clone the machine at each true dispatch, and confirm markNextBarrelAsAltKind
 *      reproduces the oracle's RAM on every real state the game actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2c72.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2c72 as oracle } from "../../translated/loc_2c72.js";
import { markNextBarrelAsAltKind } from "../markNextBarrelAsAltKind.js";
import { BARREL_CLAIM_MODE } from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2c72;
// The oracle's `ret` pops the stack; point SP at work RAM so that pop reads valid bytes
// (never I/O). The oracle writes no RAM through the stack (a leaf: it only pops), so this
// choice never affects the compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the one input byte set and a safe stack.
 * Frame machinery is neutralised (clone() already sets nextNmi/nextBoundary = Infinity;
 * re-asserted here for clarity) so the oracle's `m.step` cannot fire an NMI or push a
 * frame while running in isolation.
 */
function makeEntry(base, value) {
  const e = base.clone();
  e.mem.write8(BARREL_CLAIM_MODE, value);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). A fresh entry per side because
 * the routine WRITES memory — a reused machine would carry the previous run forward.
 */
function runPair(base, value, candidate) {
  const a = makeEntry(base, value); // oracle
  const b = makeEntry(base, value); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Sweep every possible starting byte value. Returns the first mismatch (or null) + count. */
function fullSweep(base, candidate) {
  for (let v = 0; v < 256; v++) {
    const ram = runPair(base, v, candidate);
    if (ram) return { mismatch: { v, ram }, count: v + 1 };
  }
  return { mismatch: null, count: 256 };
}

const describeMismatch = (mm) =>
  mm && `at start=${hx(mm.v)}: RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): markNextBarrelAsAltKind == oracle across all 256 starting bytes", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, markNextBarrelAsAltKind);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256, "must have compared the full single-byte input space");

  // Non-vacuity: the routine really did the work (byte -> value | 0x80) on both sides.
  for (const v of [0x00, 0x01, 0x22, 0x7f, 0x80, 0xff]) {
    const a = makeEntry(base, v); // oracle
    const b = makeEntry(base, v); // candidate
    oracle(a);
    markNextBarrelAsAltKind(b);
    assert.equal(a.mem.read8(BARREL_CLAIM_MODE), v | 0x80, `oracle must set bit 7 (start ${hx(v)})`);
    assert.equal(b.mem.read8(BARREL_CLAIM_MODE), v | 0x80, `markNextBarrelAsAltKind must set bit 7 (start ${hx(v)})`);
  }
  console.log(`  EQUAL/exhaustive: ${count} starting bytes — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): sets bit 6 instead of bit 7 — the wrong mask. Caught wherever they disagree. */
function brokenWrongBit(m) {
  const { mem } = m;
  mem.write8(BARREL_CLAIM_MODE, mem.read8(BARREL_CLAIM_MODE) | 0x40); // BUG: 0x40, not 0x80
}

/** BUG (b): stores a bare 0x80, clobbering the low bits instead of OR-ing them. Caught on
 *  any starting value that has a low bit set (proves the read-modify-write is load-bearing). */
function brokenClobber(m) {
  const { mem } = m;
  mem.write8(BARREL_CLAIM_MODE, 0x80); // BUG: destroys the low bits under the flag
}

test("TEETH (exhaustive): the wrong-bit twin is CAUGHT (0x6382 diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongBit);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch the wrong bit mask — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, BARREL_CLAIM_MODE, "the wrong-bit twin must diverge on 0x6382");
  console.log(`  TEETH/wrong-bit: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the low-bit-clobbering twin is CAUGHT (0x6382 diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenClobber);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a low-bit clobber — the read-modify-write is unproven");
  assert.equal(mismatch.ram.addr, BARREL_CLAIM_MODE, "the clobber twin must diverge on 0x6382");
  console.log(`  TEETH/clobber: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x2C72 in a real attract run and clone the machine at each real dispatch. It is
 * reached through the object-slot allocator's dispatch, so it fires only occasionally.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed.
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

test("REALISM: real captured 0x2C72 dispatches — markNextBarrelAsAltKind matches oracle RAM", () => {
  const caps = captureDispatches(32, 3000);
  assert.ok(caps.length >= 1, "expected at least one real 0x2C72 dispatch during attract");

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const before = a.mem.read8(BARREL_CLAIM_MODE);
    oracle(a);
    markNextBarrelAsAltKind(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (0x6382 was ${hx(before)}) ` +
          `at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x2C72 dispatches — RAM == oracle`);
});
