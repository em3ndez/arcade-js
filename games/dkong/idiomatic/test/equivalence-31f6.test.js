// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_31f6 (ROM 0x31F6) — the two-source entropy byte helper.
 *
 * sub_31f6 is a LEAF that writes NO memory and returns a byte in the accumulator: the
 * low two bits of RANDOM (0x6018), except when those bits are exactly 1, in which case
 * it returns FRAME (0x601A). Its whole observable effect is that returned byte — the
 * caller (sub_31dd) does `cp 0x01` on it immediately — so the contract here is the
 * memory-equivalence RAM diff (which must stay identical, since neither side writes)
 * PLUS the live-out register the caller consumes. The oracle leaves that value in
 * regs.a; the idiomatic routine, honest-signature, RETURNS it, so the check is
 * `candidate-return === oracle.regs.a`.
 *
 * The effect is a pure function of just TWO bytes, so an EXHAUSTIVE gate is available:
 *
 *   1. EQUAL (exhaustive) — sweep the WHOLE 256×256 (RANDOM, FRAME) input space; on
 *      every combo the candidate's return must equal the oracle's accumulator, and RAM
 *      must be byte-identical (neither writes any). A proof, not a sample.
 *
 *   2. TEETH (exhaustive) — two deliberately-broken twins the SAME sweep must catch:
 *        (a) inverted branch — substitutes FRAME on the 0/2/3 residues and returns the
 *            residue on residue 1 (the exact opposite selection).
 *        (b) dropped substitution — always returns the residue, never reaching for FRAME.
 *      Each must diverge somewhere in the sweep.
 *
 *   3. REALISM — the natural caller chain (entry_31b1 -> sub_31dd -> here) is NOT wired
 *      into the live dispatcher, so an attract run mints ZERO real dispatches; the
 *      capture pass asserts nothing was missed and logs that count for transparency. In
 *      its place, a CRAFTED-on-real-base pass lays a spread of (RANDOM, FRAME) values
 *      over a genuine boot+attract machine and re-checks equivalence, proving the routine
 *      has no hidden dependence on any surrounding RAM the pristine sweep held at zero.
 *
 * No stack-scratch exclusion is needed: there is no dissolved call and no push16 — the
 * oracle only pops (its terminal `ret`), which writes no RAM, so the full-RAM diff is
 * clean without any masked region.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-31f6.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_31f6 as oracle } from "../../translated/loc_31f6.js";
import { loc_31f6 } from "../loc_31f6.js";
import { RANDOM, FRAME } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x31f6;
// The oracle's `ret` pops the stack; point SP at work RAM so those pops read valid bytes
// (never I/O). A `ret` only pops — it writes no RAM — so this choice never affects the
// compared memory; it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the two input cells set and a safe stack.
 * Frame machinery is neutralised (clone() already sets nextNmi/nextBoundary = Infinity;
 * re-asserted for clarity) so the oracle's `m.step` cannot fire an NMI or push a frame
 * while running in isolation.
 */
function makeEntry(base, rand, frame) {
  const e = base.clone();
  e.mem.write8(RANDOM, rand);
  e.mem.write8(FRAME, frame);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and a candidate on two FRESH, byte-identical entries and diff the
 * contract: full-RAM equality (memory-equivalence) AND the live-out byte — the oracle
 * leaves it in regs.a, the candidate returns it.
 *
 * @returns {{ram: object|null, oracleA: number, candReturn: number}}
 */
function runPair(base, rand, frame, candidate) {
  const a = makeEntry(base, rand, frame); // oracle
  const b = makeEntry(base, rand, frame); // candidate
  oracle(a);
  const candReturn = candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram, oracleA: a.regs.a, candReturn };
}

/**
 * Exhaustive sweep of the whole (RANDOM, FRAME) input space. Returns the first mismatch
 * (RAM diff or a return != the oracle's accumulator) or null, plus the combo count.
 */
function fullSweep(base, candidate) {
  let count = 0;
  for (let r = 0; r < 256; r++) {
    for (let f = 0; f < 256; f++) {
      const { ram, oracleA, candReturn } = runPair(base, r, f, candidate);
      count++;
      if (ram) return { mismatch: { r, f, kind: "ram", ram }, count };
      if (candReturn !== oracleA) {
        return { mismatch: { r, f, kind: "return", oracleA, candReturn }, count };
      }
    }
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  (mm.kind === "ram"
    ? `at RANDOM=${hx(mm.r)} FRAME=${hx(mm.f)}: RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`
    : `at RANDOM=${hx(mm.r)} FRAME=${hx(mm.f)}: return diverges (oracle=${hx(mm.oracleA)} cand=${hx(mm.candReturn)})`);

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_31f6 == oracle across the whole 256×256 input space", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_31f6);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 * 256, "must have compared the full (RANDOM, FRAME) input space");
  console.log(`  EQUAL/exhaustive: ${count} (RANDOM, FRAME) combos — RAM identical and return == oracle accumulator`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): inverts the selection — substitutes FRAME on the 0/2/3 residues and returns
 *  the residue on residue 1 (the exact opposite of the oracle). */
function brokenInvertBranch(m) {
  const { mem } = m;
  const lowBits = mem.read8(RANDOM) & 0x03;
  if (lowBits === 1) return lowBits; // BUG: branch sense inverted
  return mem.read8(FRAME);
}

/** BUG (b): never reaches for FRAME — always returns the residue. */
function brokenDropSubstitution(m) {
  const { mem } = m;
  return mem.read8(RANDOM) & 0x03; // BUG: residue 1 should return FRAME
}

test("TEETH (exhaustive): the inverted-branch twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenInvertBranch);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted branch — the gate is worthless");
  console.log(`  TEETH/invert: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the dropped-substitution twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDropSubstitution);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped FRAME substitution — worthless");
  console.log(`  TEETH/drop: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured + crafted-on-real-base) -----------------------------

/**
 * Hook 0x31F6 in a real attract run and verify any true dispatch. The caller chain is
 * not wired into the live dispatcher, so attract is EXPECTED to mint none — the test
 * asserts nothing was silently mis-verified and reports the count. Reachability is not
 * load-bearing: the exhaustive sweep above already covers the whole input space.
 */
test("REALISM (captured): every real 0x31F6 dispatch (if any) matches the oracle", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < 200) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2000);

  for (const cap of caps) {
    const a = cap.clone(); const b = cap.clone();
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    const ret = loc_31f6(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `RAM diverges on real dispatch at 0x${(ram.addr ?? 0).toString(16)}`);
    assert.equal(ret, a.regs.a, "return diverges on a real dispatch");
  }
  console.log(`  REALISM/captured: ${caps.length} natural 0x31F6 dispatches in 2000 frames (chain not yet wired live — exhaustive sweep is the proof)`);
});

/**
 * Lay a spread of (RANDOM, FRAME) values over a genuine boot+attract machine (realistic
 * work RAM everywhere else) and re-check equivalence. If the routine secretly read any
 * cell besides RANDOM/FRAME, the realistic surroundings — not the pristine zeros of the
 * exhaustive sweep — would expose it.
 */
test("REALISM (crafted-on-real-base): equivalence holds atop realistic work RAM", () => {
  const m = new Machine(ROM);
  m.runFrames(180);
  const base = m.clone(); // clone neutralises the frame machinery

  const rands = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x55, 0xaa, 0xfd, 0xfe, 0xff];
  const frames = [0x00, 0x01, 0x02, 0x7f, 0x80, 0xa5, 0xfe, 0xff];
  let count = 0;
  for (const r of rands) {
    for (const f of frames) {
      const { ram, oracleA, candReturn } = runPair(base, r, f, loc_31f6);
      assert.equal(ram, null, ram && `RAM diverges at RANDOM=${hx(r)} FRAME=${hx(f)}`);
      assert.equal(candReturn, oracleA, `return diverges at RANDOM=${hx(r)} FRAME=${hx(f)} (oracle=${hx(oracleA)} cand=${hx(candReturn)})`);
      count++;
    }
  }
  console.log(`  REALISM/crafted: ${count} (RANDOM, FRAME) spreads over a real attract base — RAM + return == oracle`);
});
