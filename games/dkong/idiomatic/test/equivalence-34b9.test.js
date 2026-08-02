// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_34b9 (ROM 0x34B9) — seed an object record's paired
 * position fields from one of two ROM template tables (skipped on board 3).
 *
 * loc_34b9's entire memory-observable behaviour is a function of THREE input bytes
 * plus the record pointer (IX live-in):
 *
 *   BOARD (0x6227)     — == 3 skips the whole routine (no writes).
 *   MARIO_X (0x6203)   — bit 7 selects the ROM template table (set -> 0x3AD4,
 *                        clear -> 0x3AC4).
 *   SPIN_COUNT (0x6019)— & 6 is the 2-byte entry index {0,2,4,6} into the table.
 *
 * On the non-skip path it writes SEVEN record cells, all derived from the selected
 * table entry (the two bytes) or zero: the entry's first byte into +0x03 (OBJ_X) and
 * +0x0e, its second byte into +0x05 (OBJ_Y) and +0x0f, then zero into +0x0d
 * (OBJ_STATE), +0x18 and +0x1c. It returns nothing a caller consumes and never
 * writes the stack (no push; only a terminal return), so the contract is memory-only
 * over the WHOLE dump — no STACK_SCRATCH exclusion is needed.
 *
 * The three inputs act independently (BOARD is a pure gate; the table select depends
 * only on MARIO_X bit 7; the index depends only on SPIN_COUNT & 6), so the logic is
 * covered EXHAUSTIVELY by three 256-value sweeps plus the full small cross-grid, each
 * against the FROZEN oracle reading the same ROM tables. All output cells are
 * sentinel-prefilled so a twin that DROPS a write (not just writes a wrong value)
 * still diverges.
 *
 *   1. EQUAL (exhaustive over the logic) — loc_34b9 == oracle on RAM across:
 *        - BOARD 0..255 (proves ONLY board 3 skips),
 *        - MARIO_X 0..255 over two record bases (proves the bit-7 table select and
 *          that the writes land at objBase+offset),
 *        - SPIN_COUNT 0..255 under both tables (proves the & 6 entry index),
 *        - the full {board in 3/non-3} x {bit7 clear/set} x {index 0,2,4,6} x
 *          {two bases} cross-grid.
 *
 *   2. TEETH (exhaustive) — three deliberately-broken twins, each of which the same
 *      sweeps MUST catch:
 *        (a) inverted table select — bit 7 picks the WRONG table; caught by the
 *            MARIO_X sweep (the two tables differ at index 0).
 *        (b) wrong index mask — masks SPIN_COUNT with 7 instead of 6, so odd spin
 *            values read an off-by-one entry; caught by the SPIN_COUNT sweep.
 *        (c) dropped field clear — skips zeroing +0x1c; caught by the sentinel.
 *
 *   3. FRONTIER + crafted realism — hook 0x34B9 over a long attract run: the sub_32bd
 *      path is not taken in attract, so this captures no natural dispatches (confirmed
 *      and reported; any that do occur are replayed). It then crafts dispatches on a
 *      REAL attract-base machine (realistic surrounding RAM) and checks each against
 *      the oracle, anchoring the exhaustive proof to in-distribution state.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-34b9.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_34b9 as oracle } from "../../translated/loc_34b9.js";
import { loc_34b9 } from "../loc_34b9.js";
import { BOARD, MARIO_X, SPIN_COUNT, OBJ_X, OBJ_Y, OBJ_STATE } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x34b9;

// Two record bases (IX). Both are real object arrays (OBJ_ARRAY_64 0x6400, OBJ_ARRAY_65
// 0x6500), stride 0x20, so all seven touched cells (+0x03..+0x1c) fit inside one record
// in work RAM (0x6000-0x6BFF) and never collide with BOARD (0x6227), MARIO_X (0x6203),
// SPIN_COUNT (0x6019), or the safe stack.
const IX_BASES = [0x6400, 0x6500];

// The seven record offsets this routine writes.
const WRITTEN_OFFSETS = [OBJ_X, 0x0e, OBJ_Y, 0x0f, OBJ_STATE, 0x18, 0x1c];

// The oracle's terminal return pops the stack; point SP at work RAM so the pop reads
// valid bytes (never I/O). The oracle writes NO RAM through the stack (no push; only a
// terminal pop), so this choice never affects the compared memory.
const SAFE_SP = 0x6bf8;

// Distinctive sentinel pre-loaded into every output cell so a twin that SKIPS a write
// still diverges from the oracle's write. 0xAA appears in neither ROM table, so a
// dropped position write is always caught, and it is nonzero so a dropped clear is too.
const SENTINEL = 0xaa;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the three input cells set, the record
 * pointer in IX, every output cell sentinel-filled, and a safe stack. The frame
 * machinery is neutralised (clone() already sets nextNmi/nextBoundary = Infinity;
 * re-asserted here) so the oracle's step machinery cannot fire an NMI or push a frame.
 */
function makeEntry(base, board, marioX, spin, ixBase) {
  const e = base.clone();
  e.regs.ix = ixBase;
  e.mem.write8(BOARD, board);
  e.mem.write8(MARIO_X, marioX);
  e.mem.write8(SPIN_COUNT, spin);
  for (const off of WRITTEN_OFFSETS) e.mem.write8((ixBase + off) & 0xffff, SENTINEL);
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
function runPair(base, board, marioX, spin, ixBase, candidate) {
  const a = makeEntry(base, board, marioX, spin, ixBase); // oracle
  const b = makeEntry(base, board, marioX, spin, ixBase); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/**
 * The exhaustive-over-logic sweep. Returns the first mismatch (or null) and the total
 * combos compared. The three 256-sweeps pin each independent input's effect, and the
 * cross-grid pins their combination and the skip path.
 */
function fullSweep(base, candidate) {
  let count = 0;
  const NON3 = 0x00; // any board other than 3 runs the body

  // BOARD sweep — every board value at a fixed representative body state. Proves that
  // ONLY board 3 skips (and that every other value runs the identical body).
  for (let bd = 0; bd < 256; bd++) {
    const { ram } = runPair(base, bd, 0x40, 0x02, IX_BASES[0], candidate);
    count++;
    if (ram) return { mismatch: { board: bd, marioX: 0x40, spin: 0x02, ix: IX_BASES[0], ram }, count };
  }

  // MARIO_X sweep — every value's bit 7 selects a table; run under both record bases.
  for (const ix of IX_BASES) {
    for (let mx = 0; mx < 256; mx++) {
      const { ram } = runPair(base, NON3, mx, 0x02, ix, candidate);
      count++;
      if (ram) return { mismatch: { board: NON3, marioX: mx, spin: 0x02, ix, ram }, count };
    }
  }

  // SPIN_COUNT sweep — every value's & 6 is the entry index; run under both tables
  // (bit-7-clear MARIO_X 0x40 and bit-7-set MARIO_X 0xC0).
  for (const mx of [0x40, 0xc0]) {
    for (let sp = 0; sp < 256; sp++) {
      const { ram } = runPair(base, NON3, mx, sp, IX_BASES[0], candidate);
      count++;
      if (ram) return { mismatch: { board: NON3, marioX: mx, spin: sp, ix: IX_BASES[0], ram }, count };
    }
  }

  // Cross-grid — skip vs body x both tables x all four indices x both bases.
  for (const bd of [0x03, NON3]) {
    for (const mx of [0x40, 0xc0]) {
      for (const sp of [0x00, 0x02, 0x04, 0x06]) {
        for (const ix of IX_BASES) {
          const { ram } = runPair(base, bd, mx, sp, ix, candidate);
          count++;
          if (ram) return { mismatch: { board: bd, marioX: mx, spin: sp, ix, ram }, count };
        }
      }
    }
  }

  return { mismatch: null, count };
}

const EXPECTED_COUNT = 256 + 256 * 2 + 256 * 2 + 2 * 2 * 4 * 2;

const describeMismatch = (mm) =>
  mm &&
  `at board=${hx(mm.board)} marioX=${hx(mm.marioX)} spin=${hx(mm.spin)} ix=0x${mm.ix.toString(16)}: ` +
    `RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive over the logic) -------------------------------------

test("EQUAL (exhaustive): loc_34b9 == oracle across the full input factorisation", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_34b9);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, EXPECTED_COUNT, "must have compared the full factored input space");
  console.log(`  EQUAL/exhaustive: ${count} (board, marioX, spin, base) combos — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): inverts the table select — bit 7 picks the wrong ROM table. */
function brokenInvertedTable(m) {
  const { regs, mem } = m;
  if (mem.read8(BOARD) === 0x03) return;
  const table = (mem.read8(MARIO_X) & 0x80) !== 0 ? 0x3ac4 : 0x3ad4; // BUG: arms swapped
  const entry = table + (mem.read8(SPIN_COUNT) & 0x06);
  const posX = mem.read8(entry), posY = mem.read8(entry + 1);
  const b = regs.ix;
  mem.write8((b + OBJ_X) & 0xffff, posX);
  mem.write8((b + 0x0e) & 0xffff, posX);
  mem.write8((b + OBJ_Y) & 0xffff, posY);
  mem.write8((b + 0x0f) & 0xffff, posY);
  mem.write8((b + OBJ_STATE) & 0xffff, 0);
  mem.write8((b + 0x18) & 0xffff, 0);
  mem.write8((b + 0x1c) & 0xffff, 0);
}

/** BUG (b): masks SPIN_COUNT with 7 instead of 6 — odd spin values read an off-by-one entry. */
function brokenIndexMask(m) {
  const { regs, mem } = m;
  if (mem.read8(BOARD) === 0x03) return;
  const table = (mem.read8(MARIO_X) & 0x80) !== 0 ? 0x3ad4 : 0x3ac4;
  const entry = table + (mem.read8(SPIN_COUNT) & 0x07); // BUG: & 7, not & 6
  const posX = mem.read8(entry), posY = mem.read8(entry + 1);
  const b = regs.ix;
  mem.write8((b + OBJ_X) & 0xffff, posX);
  mem.write8((b + 0x0e) & 0xffff, posX);
  mem.write8((b + OBJ_Y) & 0xffff, posY);
  mem.write8((b + 0x0f) & 0xffff, posY);
  mem.write8((b + OBJ_STATE) & 0xffff, 0);
  mem.write8((b + 0x18) & 0xffff, 0);
  mem.write8((b + 0x1c) & 0xffff, 0);
}

/** BUG (c): drops the clear of +0x1c — leaves the sentinel where the oracle writes 0. */
function brokenDroppedClear(m) {
  const { regs, mem } = m;
  if (mem.read8(BOARD) === 0x03) return;
  const table = (mem.read8(MARIO_X) & 0x80) !== 0 ? 0x3ad4 : 0x3ac4;
  const entry = table + (mem.read8(SPIN_COUNT) & 0x06);
  const posX = mem.read8(entry), posY = mem.read8(entry + 1);
  const b = regs.ix;
  mem.write8((b + OBJ_X) & 0xffff, posX);
  mem.write8((b + 0x0e) & 0xffff, posX);
  mem.write8((b + OBJ_Y) & 0xffff, posY);
  mem.write8((b + 0x0f) & 0xffff, posY);
  mem.write8((b + OBJ_STATE) & 0xffff, 0);
  mem.write8((b + 0x18) & 0xffff, 0);
  // BUG: +0x1c clear dropped
}

test("TEETH (exhaustive): the inverted-table-select twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenInvertedTable);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted table select — the RAM check is worthless");
  console.log(`  TEETH/table: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-index-mask twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenIndexMask);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong entry-index mask — worthless");
  console.log(`  TEETH/index: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the dropped-field-clear twin is CAUGHT (+0x1c diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDroppedClear);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped field clear — worthless");
  assert.equal(mismatch.ram.addr, (IX_BASES[0] + 0x1c) & 0xffff, "the dropped-clear twin must diverge on +0x1c");
  console.log(`  TEETH/clear: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. FRONTIER + crafted realism --------------------------------------------

/**
 * Hook 0x34B9 in a real attract run and clone the machine at up to K real dispatches.
 * The caller (sub_32bd, ROM 0x32CA) path is not taken in attract, so 0x34B9 is a
 * non-executing frontier — we expect zero here, and confirm it (replaying any that do
 * occur, belt-and-braces if the frontier moves).
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

test("FRONTIER: 0x34B9 is a non-executing frontier in attract; any real dispatch matches the oracle", () => {
  const caps = captureDispatches(64, 2000);
  for (const cap of caps) {
    const a = cap.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity;
    const b = cap.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    loc_34b9(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `real dispatch diverges at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`);
  }
  console.log(`  FRONTIER: ${caps.length} natural 0x34B9 dispatches over 2000 attract frames (expected 0 — the sub_32bd path is not taken in attract)`);
});

test("CRAFTED REALISM: crafted dispatches on a real attract-base machine match the oracle", () => {
  // A real, self-consistent machine: boot + a stretch of attract so work RAM holds
  // realistic surrounding values. 0x34B9's body is never reached naturally; craft it.
  const host = new Machine(ROM);
  host.runFrames(180);
  const attractBase = host.clone();

  // Representative crafted dispatches: the board-3 skip, both table arms, all four
  // entry indices with masked-off noise bits, and both record bases.
  const cases = [
    { board: 0x03, marioX: 0x40, spin: 0x02, ix: 0x6400 }, // skip on board 3
    { board: 0x00, marioX: 0x10, spin: 0x00, ix: 0x6400 }, // bit7 clear, index 0
    { board: 0x00, marioX: 0x90, spin: 0x02, ix: 0x6400 }, // bit7 set,   index 2
    { board: 0x01, marioX: 0x7f, spin: 0xf4, ix: 0x6500 }, // bit7 clear, index 4 (noise bits masked)
    { board: 0x02, marioX: 0xff, spin: 0x0f, ix: 0x6500 }, // bit7 set,   index 6 (odd noise bit masked)
  ];

  for (const { board, marioX, spin, ix } of cases) {
    const { ram } = runPair(attractBase, board, marioX, spin, ix, loc_34b9);
    assert.equal(
      ram,
      null,
      ram &&
        `crafted dispatch (board=${hx(board)} marioX=${hx(marioX)} spin=${hx(spin)} ix=0x${ix.toString(16)}) ` +
          `diverges at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  CRAFTED REALISM: ${cases.length} crafted dispatches on a real attract base — RAM == oracle`);
});
