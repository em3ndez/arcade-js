// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_055f (ROM 0x055F) — select the current player's score
 * counter address.
 *
 * sub_055f is a LEAF whose whole observable behaviour is a function of a SINGLE
 * byte, CURRENT_PLAYER (0x600D): the flag being zero returns P1_SCORE (0x60B2),
 * non-zero returns P2_SCORE (0x60B5). It writes NO memory and its result is a
 * register value (the oracle leaves it in DE) — so the contract is "RAM unchanged
 * AND the returned address equals the oracle's DE." The residual flags the oracle
 * touches never reach a caller and are dead.
 *
 * Because the sole input is one byte and the routine reads nothing else, sweeping
 * all 256 values of CURRENT_PLAYER is an EXHAUSTIVE proof, not a sample — the
 * strongest gate available for this leaf. The routine is never dispatched during
 * attract (0 in 2000 frames), so there is no real-capture arm to add.
 *
 *   1. EQUAL (exhaustive) — for every CURRENT_PLAYER value 0..255: run the oracle
 *      and loc_055f on byte-identical clones, and assert (a) RAM is unchanged on
 *      both (neither writes), and (b) loc_055f's returned address equals the
 *      oracle's DE live-out.
 *
 *   2. TEETH (exhaustive) — three deliberately-broken twins, each of which the same
 *      sweep MUST catch:
 *        (a) swapped selection — returns the OTHER player's slot; caught by the
 *            return on the very first value (both branches are wrong).
 *        (b) constant P1 — never selects P2; caught by the return on any non-zero
 *            flag value.
 *        (c) spurious write — returns the RIGHT address but scribbles a byte; caught
 *            by the RAM diff, proving the memory arm has teeth even though the real
 *            routine writes nothing.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-055f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_055f as oracle } from "../../translated/sub_055f.js";
import { selectCurrentPlayerScoreCounter as loc_055f } from "../selectCurrentPlayerScoreCounter.js";
import { CURRENT_PLAYER, P1_SCORE, P2_SCORE } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

// The oracle's `ret` pops the stack; point SP at work RAM so those pops read valid
// bytes (never I/O). The oracle writes no RAM through the stack (a leaf: it only
// reads on the pop), so this choice never affects the compared memory — it just
// keeps the oracle well-defined. The candidate models no stack and ignores it.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the sole input cell set and a safe
 * stack. Frame machinery is neutralised (clone() already sets nextNmi/nextBoundary
 * = Infinity; re-asserted for clarity) so the oracle's `m.step`/`m.ret` cannot fire
 * an NMI or push a frame while running in isolation.
 */
function makeEntry(base, playerFlag) {
  const e = base.clone();
  e.mem.write8(CURRENT_PLAYER, playerFlag);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and a candidate on two FRESH, byte-identical entries and compute
 * the memory-equivalence contract: RAM over the whole dump (neither side should
 * write) plus the register live-out — the oracle leaves the selected address in DE,
 * the candidate returns it.
 *
 * @returns {{ram: object|null, oracleDE: number, ret: number}}
 */
function runPair(base, playerFlag, candidate) {
  const a = makeEntry(base, playerFlag); // oracle
  const b = makeEntry(base, playerFlag); // candidate
  oracle(a);
  const ret = candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram, oracleDE: a.regs.de, ret };
}

/**
 * Exhaustive sweep over the sole input byte. Returns the first mismatch (RAM or
 * return) or null, plus the number of values compared.
 */
function fullSweep(base, candidate) {
  let count = 0;
  for (let v = 0; v < 256; v++) {
    const { ram, oracleDE, ret } = runPair(base, v, candidate);
    count++;
    if (ram) return { mismatch: { v, kind: "ram", ram }, count };
    if (ret !== oracleDE) return { mismatch: { v, kind: "ret", oracleDE, ret }, count };
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) => {
  if (!mm) return "no mismatch";
  if (mm.kind === "ram") {
    return `at CURRENT_PLAYER=${hx(mm.v)}: RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;
  }
  return `at CURRENT_PLAYER=${hx(mm.v)}: returned 0x${mm.ret.toString(16)} but oracle DE = 0x${mm.oracleDE.toString(16)}`;
};

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_055f == oracle over all 256 CURRENT_PLAYER values", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_055f);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256, "must have swept the full one-byte input space");
  console.log(`  EQUAL/exhaustive: ${count} CURRENT_PLAYER values — RAM unchanged and return == oracle DE`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): returns the OTHER player's slot. Wrong on every value; caught first at 0. */
function brokenSwapped(m) {
  const { mem } = m;
  return mem.read8(CURRENT_PLAYER) === 0 ? P2_SCORE : P1_SCORE;
}

/** BUG (b): always returns P1's slot, never P2's. Caught on any non-zero flag. */
function brokenConstantP1() {
  return P1_SCORE;
}

/** BUG (c): returns the correct address but scribbles a byte into the selected
 *  counter. The real routine writes nothing, so the RAM diff must catch it. */
function brokenSpuriousWrite(m) {
  const { mem } = m;
  const slot = mem.read8(CURRENT_PLAYER) === 0 ? P1_SCORE : P2_SCORE;
  mem.write8(slot, mem.read8(slot) + 1); // BUG: the real routine writes nothing
  return slot;
}

test("TEETH (exhaustive): the swapped-selection twin is CAUGHT (return diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenSwapped);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a swapped score-slot selection — worthless");
  assert.equal(mismatch.kind, "ret", "the swap must be caught on the returned address");
  console.log(`  TEETH/swapped: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the constant-P1 twin is CAUGHT (never selects P2)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenConstantP1);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a routine that never picks P2 — worthless");
  assert.equal(mismatch.kind, "ret", "the missing P2 branch must be caught on the returned address");
  assert.notEqual(mismatch.v, 0, "value 0 is correct for constant-P1; the catch must be a non-zero flag");
  console.log(`  TEETH/constantP1: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the spurious-write twin is CAUGHT (RAM diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenSpuriousWrite);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a spurious memory write — the RAM arm is worthless");
  assert.equal(mismatch.kind, "ram", "the spurious write must be caught on RAM, not the return");
  assert.ok(
    mismatch.ram.addr === P1_SCORE || mismatch.ram.addr === P2_SCORE,
    `the write must diverge on a score slot, got 0x${(mismatch.ram.addr ?? 0).toString(16)}`,
  );
  console.log(`  TEETH/spurious-write: caught — ${describeMismatch(mismatch)}`);
});
