// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_22bd (ROM 0x22BD) — the "display mirror" leaf.
 *
 * loc_22bd reads the byte at a source pointer and stores it into ONE of two fixed cells
 * in the sprite shadow buffer, chosen by bit 3 of the pointer's low byte: clear -> 0x6947
 * (record 17, +3), set -> 0x694b (record 18, +3). It is a LEAF: one read, one write, no
 * callees, and nothing a caller consumes (both callers overwrite the copied byte the
 * instant they return and reuse the source pointer, which the routine never touches). So
 * the contract is MEMORY-ONLY, and — because dumpState() is memory — comparing RAM over
 * the whole dump is the whole contract. The oracle's terminal `ret` only POPS the stack
 * (reads, never writes), so no STACK_SCRATCH exclusion is needed.
 *
 * The main loop never dispatches 0x22BD in attract (0 in 3000 frames — it is an arm of the
 * 0x2207 object state machine, not exercised by the attract demo), so real captured
 * dispatches are unavailable. But the observable space is tiny and factorises, so the
 * crafted sweep is a PROOF, not a sample:
 *
 *   The write is  mem[dest] = mem[srcAddr]  with  dest = bit3(srcAddr) ? 0x694b : 0x6947.
 *   The destination depends ONLY on the source pointer's low byte; the value copied is the
 *   source byte and is independent of the address. So two sweeps cover the whole space:
 *
 *   SWEEP A (selection) — all 256 source-pointer low bytes with a fixed probe value; covers
 *            the destination choice for every low byte (and pins it to bit 3, not some other
 *            bit). Also checks non-vacuity: the oracle really mirrors the byte to the
 *            selected cell and leaves the other cell untouched.
 *   SWEEP B (value)     — all 256 byte values on EACH arm (a bit-3-clear pointer and a
 *            bit-3-set pointer); covers the exact byte copy into both destination cells.
 *
 *   1. EQUAL (crafted, exhaustive) — loc_22bd == oracle on RAM across both sweeps (768
 *      combos), each run on a real attract-base state with a surgical poke of the source
 *      byte, identically on both sides.
 *
 *   2. TEETH — three deliberately-broken twins the same sweeps MUST catch:
 *        (a) wrong selector bit — keys the choice off bit 2 instead of bit 3.
 *        (b) inverted selector — swaps the two destination cells.
 *        (c) value corruption — flips a bit of the copied byte.
 *
 *   3. REALISM — hook 0x22BD in a real attract run; document the (zero) natural dispatches
 *      and verify any that DO occur match the oracle.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-22bd.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_22bd as oracle } from "../../translated/sub_22bd.js";
import { loc_22bd } from "../loc_22bd.js";
import { SPRITE_BUFFER } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x22bd;

// The two destination cells (+3 field of sprite records 17 and 18 inside SPRITE_BUFFER).
const DEST_BIT3_CLEAR = SPRITE_BUFFER + 17 * 4 + 3; // 0x6947
const DEST_BIT3_SET = SPRITE_BUFFER + 18 * 4 + 3; // 0x694b

// A safe source page well clear of the destinations, the stack, and I/O — the sweep pokes
// mem[SRC_BASE + low] and points the source pointer there, so its low byte ranges 0..255.
const SRC_BASE = 0x6200;

// The oracle ends in `ret`; point SP at work RAM so that pop reads valid bytes (never I/O).
// The oracle never WRITES through the stack, so this choice never affects compared memory.
const SAFE_SP = 0x6bf8;

// A distinctive probe byte and a distinct destination sentinel, so a wrong destination or a
// corrupted value always produces a real (non-coincidental) RAM difference.
const PROBE_VALUE = 0xa5;
const SENTINEL = 0x11;

const hx = (v) => "0x" + (v & 0xffff).toString(16);

/**
 * A crafted entry: a clone of `base` with both destination cells pre-seeded to a sentinel,
 * the source byte poked, and the source pointer + a safe stack set for the oracle. Frame
 * machinery is neutralised so the oracle's `ret` cannot fire an NMI or push a frame.
 */
function makeEntry(base, srcAddr, value) {
  const e = base.clone();
  e.mem.write8(DEST_BIT3_CLEAR, SENTINEL);
  e.mem.write8(DEST_BIT3_SET, SENTINEL);
  e.mem.write8(srcAddr, value);
  e.regs.hl = srcAddr; // the oracle reads the source through this pointer
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and a candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump — dumpState() is memory). A fresh
 * entry per side because the routine WRITES memory. Returns the RAM diff (or null) and the
 * oracle machine (for the non-vacuity checks).
 */
function runPair(base, srcAddr, value, candidate) {
  const a = makeEntry(base, srcAddr, value); // oracle
  const b = makeEntry(base, srcAddr, value); // candidate
  oracle(a);
  candidate(b, srcAddr);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram, a };
}

/**
 * The two disjoint sweeps in sequence. Returns the first candidate-vs-oracle mismatch (or
 * null) and the total combos compared. By the factorisation in the file header these cover
 * the whole (source-pointer, value) observable space.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // SWEEP A — destination selection over all 256 source-pointer low bytes (value fixed).
  for (let lo = 0; lo < 256; lo++) {
    const { ram } = runPair(base, SRC_BASE + lo, PROBE_VALUE, candidate);
    count++;
    if (ram) return { mismatch: { srcLow: lo, value: PROBE_VALUE, ram }, count };
  }

  // SWEEP B — exact byte copy over all 256 values on each arm (bit 3 clear / set).
  for (const lo of [0x03, 0x0b]) { // 0x03 -> bit3 clear, 0x0b -> bit3 set
    for (let v = 0; v < 256; v++) {
      const { ram } = runPair(base, SRC_BASE + lo, v, candidate);
      count++;
      if (ram) return { mismatch: { srcLow: lo, value: v, ram }, count };
    }
  }

  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at srcLow=${hx(mm.srcLow)} value=${hx(mm.value)}: RAM diverges at ${hx(mm.ram.addr ?? 0)} ` +
    `(oracle=${mm.ram.a} cand=${mm.ram.b})`;

// A real, self-consistent machine: boot + a stretch of attract so surrounding work RAM
// holds realistic values. 0x22BD's body is never reached here; it is crafted by poking.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

// -- 1. EQUAL (crafted, exhaustive) -------------------------------------------

test("EQUAL (exhaustive): loc_22bd == oracle across both crafted sweeps", () => {
  const base = attractBase();

  const { mismatch, count } = fullSweep(base, loc_22bd);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 + 2 * 256, "must have compared the full factored input space");

  // Non-vacuity: the oracle really mirrors the source byte to the bit-3-selected cell and
  // leaves the other cell at its sentinel (proves both arms write and the compare sees it).
  for (const [lo, dest, other] of [
    [0x03, DEST_BIT3_CLEAR, DEST_BIT3_SET], // bit 3 clear
    [0x0b, DEST_BIT3_SET, DEST_BIT3_CLEAR], // bit 3 set
  ]) {
    const { a } = runPair(base, SRC_BASE + lo, PROBE_VALUE, loc_22bd);
    assert.equal(a.mem.read8(dest), PROBE_VALUE, `oracle must mirror the byte to ${hx(dest)}`);
    assert.equal(a.mem.read8(other), SENTINEL, `oracle must leave ${hx(other)} untouched`);
  }

  console.log(`  EQUAL/exhaustive: ${count} crafted (srcLow, value) combos — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** BUG (a): keys the destination off bit 2 instead of bit 3. */
function brokenWrongSelectBit(m, srcAddr) {
  const { mem } = m;
  const value = mem.read8(srcAddr);
  const dest = (srcAddr & 0x04) !== 0 ? DEST_BIT3_SET : DEST_BIT3_CLEAR; // BUG: bit 2
  mem.write8(dest, value);
}

/** BUG (b): swaps the two destination cells. */
function brokenInvertedSelect(m, srcAddr) {
  const { mem } = m;
  const value = mem.read8(srcAddr);
  const dest = (srcAddr & 0x08) !== 0 ? DEST_BIT3_CLEAR : DEST_BIT3_SET; // BUG: arms swapped
  mem.write8(dest, value);
}

/** BUG (c): corrupts the copied byte. */
function brokenValueCorrupt(m, srcAddr) {
  const { mem } = m;
  const value = mem.read8(srcAddr) ^ 0x01; // BUG: flips a bit of the mirrored byte
  const dest = (srcAddr & 0x08) !== 0 ? DEST_BIT3_SET : DEST_BIT3_CLEAR;
  mem.write8(dest, value);
}

test("TEETH: the wrong-selector-bit twin is CAUGHT", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenWrongSelectBit);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong selector bit — worthless");
  console.log(`  TEETH/select-bit: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH: the inverted-selector twin is CAUGHT", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenInvertedSelect);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch swapped destinations — worthless");
  console.log(`  TEETH/inverted: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH: the value-corruption twin is CAUGHT", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenValueCorrupt);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a corrupted mirrored byte — worthless");
  console.log(`  TEETH/value: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (natural dispatches) ------------------------------------------

test("REALISM: 0x22BD attract dispatches match the oracle (attract never reaches it)", () => {
  let count = 0;
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    count++;
    if (caps.length < 64) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2000);

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const srcAddr = b.regs.hl;
    oracle(a);
    loc_22bd(b, srcAddr);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `real dispatch diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} cand=${ram.b})`);
  }

  console.log(
    `  REALISM: ${count} natural 0x22BD dispatches in 2000 attract frames` +
      (count === 0
        ? " (none — the exhaustive crafted sweep covers the full observable space)"
        : " (all matched the oracle)"),
  );
});
