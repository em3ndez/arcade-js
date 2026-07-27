// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for cycleColumnColour (ROM 0x3e13) — the colour-cycle step that
 * advances the shared colour index and repaints one full-height column of colour RAM.
 *
 * The routine's whole effect is memory: the advanced index is stored back at 0x8057, and
 * the new colour is stamped down 28 colour-RAM cells (one screen row / 32 cells apart)
 * starting from the chosen column's top cell at 0x8840 + column. Its declared live-out is
 * MEMORY-ONLY, so the gate compares the RAM dump (dumpState covers work + colour + video +
 * sprite RAM) and excludes pc / SP / the dead value registers — the honest-signature
 * contract. That keeps the gate stable if a callee is ever dissolved (there is none here:
 * this is a leaf) and matches the RAM-only style of equivalence-4c5f.
 *
 * HONEST SIGNATURE. The oracle takes the column offset in the accumulator; the idiomatic
 * function takes it as a real parameter, cycleColumnColour(m, column). So every check sets
 * the oracle's accumulator to `column` and passes the same `column` to the idiomatic side.
 *
 * The routine IS dispatched in a plain attract run (the screen-setup loops showSetupScreen/showBonusScreen
 * feed it column 6, first reached within ~400 frames), so the primary EQUAL check runs from
 * a REAL captured entry. A crafted sweep then pokes the only two inputs — the column and the
 * starting colour index at 0x8057 — across their whole domain (32 x 256), which also pins the
 * increment's bit-3 clear right at the palette edge.
 *
 * Checks:
 *   0. HARNESS — capture a real 0x3e13 entry and confirm the oracle run is deterministic
 *      (oracle vs oracle -> identical RAM). Proves the capture/clone/diff plumbing reaches a
 *      real colour-cycle state.
 *   1. EQUAL (real entry) — cycleColumnColour == oracle over the RAM dump, and the index
 *      advanced and all 28 column cells hold the new colour.
 *   2. EQUAL (exhaustive sweep) — for every column 0..31 and every starting index 0..255,
 *      both leave identical RAM (8192 combos; covers the bit-3-clear wrap).
 *   3. TEETH (dropped bit-3 clear) — a twin that keeps bit 3 (masks 0xff, not 0xf7) is
 *      CAUGHT at 0x8057 when the increment lands on bit 3 (starting index 7).
 *   4. TEETH (wrong paint stride) — a twin that steps 31 cells instead of 32 is CAUGHT in
 *      colour RAM.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3e13.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3e13 as oracle } from "../../translated/loc_3e13.js";
import { cycleColumnColour as idiomatic } from "../cycleColumnColour.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3e13;
const INDEX = 0x8057; // the shared colour index that is advanced and painted
const COL_BASE = 0x8840; // colour-RAM top row; column N is COL_BASE + N
const ROWS = 28;
const STRIDE = 32;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Capture the machine at the first attract dispatch of 0x3e13 — a real colour-cycle
 * entry (valid stack + return address, a live colour index, real colour RAM). The wrapper
 * snapshots then runs the oracle so attract proceeds.
 */
function captureRealEntry(maxFrames) {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]);
  makeMachine(snapshot).runFrames(maxFrames);
  return entry;
}

/** First differing RAM byte (dumpState) between two machines, or null when identical. */
function ramDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * Run the oracle and a candidate from clones of `entry` with column offset `column` and
 * (optionally) a forced starting index, then return the first RAM difference. The oracle
 * reads the column from the accumulator; the candidate takes it as a parameter. Neither
 * writes the stack, so a RAM-only diff needs no return alignment (the oracle rets internally,
 * which only pops — it leaves RAM untouched).
 */
function ramDiffFor(entry, column, index, candidate) {
  const o = entry.clone();
  o.regs.a = column;
  if (index !== null) o.mem.write8(INDEX, index);
  oracle(o);

  const c = entry.clone();
  if (index !== null) c.mem.write8(INDEX, index);
  candidate(c, column);

  return ramDiff(o, c);
}

// -- 0. HARNESS ---------------------------------------------------------------

test("HARNESS: a real 0x3e13 entry is captured and the oracle run is deterministic", () => {
  const entry = captureRealEntry(600);
  assert.ok(entry, "expected 0x3e13 to be dispatched during attract");

  const a = entry.clone(); oracle(a);
  const b = entry.clone(); oracle(b);
  const d = ramDiff(a, b);
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(
    `  HARNESS: captured a real 0x3e13 entry (column=${entry.regs.a}, ` +
      `index=${hx(entry.mem.read8(INDEX))}); oracle run deterministic`,
  );
});

// -- 1. EQUAL on the real captured entry --------------------------------------

test("EQUAL (real entry): cycleColumnColour == oracle over RAM", () => {
  const entry = captureRealEntry(600);
  assert.ok(entry, "need a captured 0x3e13 entry");
  const column = entry.regs.a;
  const before = entry.mem.read8(INDEX);
  const expected = (before + 1) & 0xf7;

  const d = ramDiffFor(entry, column, null, idiomatic);
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);

  // Positive checks: the index advanced and every column cell holds the new colour.
  const c = entry.clone();
  idiomatic(c, column);
  assert.equal(c.mem.read8(INDEX), expected, "colour index did not advance/clear bit 3");
  for (let i = 0; i < ROWS; i++) {
    const cell = COL_BASE + column + i * STRIDE;
    assert.equal(c.mem.read8(cell), expected, `column cell ${i} at ${hx(cell)} not painted with the new colour`);
  }
  console.log(`  EQUAL/real: identical RAM; column ${column} index ${hx(before)} -> ${hx(expected)}, 28 cells painted`);
});

// -- 2. EQUAL across an exhaustive sweep of column x starting index -----------

test("EQUAL (sweep): every column 0..31 x starting index 0..255 leaves identical RAM", () => {
  const seed = captureRealEntry(600);
  assert.ok(seed, "need a captured 0x3e13 entry to craft the sweep from");

  for (let column = 0; column < 32; column++) {
    for (let index = 0; index < 256; index++) {
      const d = ramDiffFor(seed, column, index, idiomatic);
      assert.equal(d, null, d && `column=${column} index=${hx(index)}: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);
    }
  }
  console.log("  EQUAL/sweep: 32 columns x 256 indices all leave RAM identical to the oracle (bit-3-clear wrap pinned)");
});

// -- 3. TEETH: a twin that keeps bit 3 (wrong mask) --------------------------

/** Broken twin: advances the index but keeps bit 3 (masks 0xff instead of clearing bit 3). */
function twinKeepsBit3(m, column) {
  const { mem8 } = m;
  const colour = (mem8[INDEX] + 1) & 0xff; // BUG: bit 3 not cleared
  mem8[INDEX] = colour;
  let cell = COL_BASE + column;
  for (let i = 0; i < ROWS; i++) { mem8[cell] = colour; cell += STRIDE; }
}

test("TEETH (dropped bit-3 clear): a twin that keeps bit 3 is CAUGHT at 0x8057", () => {
  const entry = captureRealEntry(600);
  assert.ok(entry, "need a captured 0x3e13 entry to seed the teeth check");
  // Starting index 7 -> increment lands on bit 3, so the missing clear shows up.
  const d = ramDiffFor(entry, 6, 7, twinKeepsBit3);
  assert.ok(d, "the gate FAILED to catch the dropped-bit-3-clear twin — it proves nothing");
  assert.equal(d.addr, INDEX, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(INDEX)})`);
  console.log(`  TEETH/mask: kept-bit-3 twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 4. TEETH: a twin with the wrong paint stride ----------------------------

/** Broken twin: paints down the column with a 31-cell stride instead of 32. */
function twinWrongStride(m, column) {
  const { mem8 } = m;
  const colour = (mem8[INDEX] + 1) & 0xf7;
  mem8[INDEX] = colour;
  let cell = COL_BASE + column;
  for (let i = 0; i < ROWS; i++) { mem8[cell] = colour; cell += 31; } // BUG: stride 31
}

test("TEETH (wrong paint stride): a twin that steps 31 cells is CAUGHT in colour RAM", () => {
  const entry = captureRealEntry(600);
  assert.ok(entry, "need a captured 0x3e13 entry to seed the teeth check");
  const d = ramDiffFor(entry, 6, null, twinWrongStride);
  assert.ok(d, "the gate FAILED to catch the wrong-stride twin — it proves nothing");
  assert.ok(d.addr >= COL_BASE, `teeth caught a non-colour-RAM address ${hx(d.addr ?? 0)}`);
  console.log(`  TEETH/stride: wrong-stride twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
