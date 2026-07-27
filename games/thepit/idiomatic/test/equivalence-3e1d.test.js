// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for fillColourColumnAt (ROM 0x3e1d) — the colour-column fill
 * that paints a full-height (28-cell) colour-RAM column with a colour handed to it, and
 * records that colour as the pipeline's shared colour index.
 *
 * Its whole effect is memory: the recorded colour lands at 0x8057, and the colour is
 * stamped down 28 cells of colour RAM at stride 32 starting from 0x8840 + columnOffset.
 * Its declared live-out is MEMORY-ONLY, so the gate compares observable RAM only —
 * dumpState is RAM-only — and excludes pc, SP, and the dead value-registers/flags the
 * oracle threads through (the honest-signature contract; a RAM+pc+register contract would
 * break the moment a callee is later dissolved).
 *
 * The two register inputs (column offset in A, colour in C) are the routine's honest
 * parameters, so the oracle side reads them from the captured/poked registers and the
 * idiomatic side takes them as arguments — the same pattern as the pure-leaf snapYToGirder.
 *
 * REACHABILITY. 0x3e1d IS dispatched during attract (the fixed-screen / panel colour
 * draws feed it ~9 times in 1500 frames), so the gate captures real entries directly via
 * the dispatch-registry hook, then also sweeps every (columnOffset, colour) it can paint
 * inside colour RAM on top of a real captured base.
 *
 * Checks:
 *   0. HARNESS — capture the real 0x3e1d dispatches and confirm the oracle run is
 *      deterministic (oracle vs oracle -> identical RAM). Proves the capture/clone/diff
 *      plumbing reaches a real colour-fill state.
 *   1. EQUAL (real entries) — for every captured dispatch, fillColourColumnAt leaves the
 *      same RAM as the oracle, and the column + colour index hold the expected colour.
 *   2. EQUAL (exhaustive sweep) — columnOffset 0..63 x colour 0..255 poked identically on
 *      both sides from a real base; both paint the same column and record the same index.
 *   3. TEETH (wrong colour) — a twin that paints colour ^ 0xff is CAUGHT at the column.
 *   4. TEETH (wrong stride) — a twin that steps 33 cells instead of 32 is CAUGHT at the
 *      second painted cell.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3e1d.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3e1d as oracle } from "../../translated/loc_3e1d.js";
import { fillColourColumnAt as idiomatic } from "../fillColourColumnAt.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3e1d;
const COLOUR_INDEX = 0x8057; // the shared colour index the fill records
const COLUMN_ANCHOR = 0x8840; // colour-RAM top-of-column anchor (base + two rows)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x3e1d in a real attract run and clone the machine at each dispatch — genuine
 * colour-fill states, each with the real column offset (A) and colour (C) the caller
 * set. The wrapper snapshots then runs the oracle so attract proceeds.
 */
function captureRealColumnFillEntries(maxFrames) {
  const entries = [];
  const snapshot = new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entries;
}

/**
 * Run the oracle (reading its inputs from the given registers) and the idiomatic routine
 * (taking them as arguments) on independent clones of one entry, and return the first
 * differing RAM byte (null == EQUAL). RAM-only, per the memory-equivalence contract.
 */
function ramDiff(entry, columnOffset, colour, fn = idiomatic) {
  const o = entry.clone();
  o.regs.a = columnOffset;
  o.regs.c = colour;
  oracle(o);

  const c = entry.clone();
  fn(c, columnOffset, colour);

  return firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off));
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: real 0x3e1d colour-fill entries are captured and the oracle run is deterministic", () => {
  const entries = captureRealColumnFillEntries(1500);
  assert.ok(entries.length > 0, "expected 0x3e1d to be dispatched during attract");

  const a = entries[0].clone();
  oracle(a);
  const b = entries[0].clone();
  oracle(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(
    `  HARNESS: captured ${entries.length} real 0x3e1d entries (first: column=${entries[0].regs.a}, ` +
      `colour=${entries[0].regs.c}); oracle run deterministic`,
  );
});

// -- 1. EQUAL on every real captured colour-fill entry -----------------------

test("EQUAL (real entries): fillColourColumnAt == oracle over RAM on every captured dispatch", () => {
  const entries = captureRealColumnFillEntries(1500);
  assert.ok(entries.length > 0, "need captured 0x3e1d entries");

  for (const entry of entries) {
    const columnOffset = entry.regs.a;
    const colour = entry.regs.c;

    const diff = ramDiff(entry, columnOffset, colour);
    assert.equal(diff, null, diff && `column=${columnOffset} colour=${colour}: RAM diff at ${hx(diff.addr)} (oracle=${diff.a} cand=${diff.b})`);

    // Positive checks: the recorded index and the whole 28-cell column hold the colour.
    const c = entry.clone();
    idiomatic(c, columnOffset, colour);
    assert.equal(c.mem.read8(COLOUR_INDEX), colour, `colour index not recorded for column ${columnOffset}`);
    for (let row = 0; row < 28; row++) {
      const cell = COLUMN_ANCHOR + columnOffset + row * 32;
      assert.equal(c.mem.read8(cell), colour, `cell ${hx(cell)} (row ${row}) not painted for column ${columnOffset}`);
    }
  }
  console.log(`  EQUAL/real: identical over RAM on all ${entries.length} captured entries; every column fully painted + index recorded`);
});

// -- 2. EQUAL across an exhaustive (columnOffset, colour) sweep ---------------

test("EQUAL (sweep columnOffset 0..63 x colour 0..255): every column + colour paints identically", () => {
  const seed = captureRealColumnFillEntries(1500)[0];
  assert.ok(seed, "need a captured 0x3e1d entry to craft the sweep from");
  const base = seed.clone();

  let combos = 0;
  for (let columnOffset = 0; columnOffset <= 63; columnOffset++) {
    for (let colour = 0; colour <= 255; colour++) {
      const diff = ramDiff(base, columnOffset, colour);
      if (diff) {
        assert.fail(`column=${columnOffset} colour=${colour}: RAM diff at ${hx(diff.addr)} (oracle=${diff.a} cand=${diff.b})`);
      }
      combos++;
    }
  }
  console.log(`  EQUAL/sweep: ${combos} (columnOffset, colour) combos all identical to the oracle (every column stays inside colour RAM)`);
});

// -- 3. TEETH: a wrong-colour twin is caught ---------------------------------

/** Broken twin: records + paints the WRONG colour (bit-flipped). */
function twinWrongColour(m, columnOffset, colour) {
  idiomatic(m, columnOffset, colour ^ 0xff);
}

test("TEETH (wrong colour): a twin that paints the bit-flipped colour is CAUGHT at the column", () => {
  const entry = captureRealColumnFillEntries(1500)[0];
  assert.ok(entry, "need a captured 0x3e1d entry to seed the teeth check");
  const columnOffset = entry.regs.a;
  const colour = entry.regs.c;

  const diff = ramDiff(entry, columnOffset, colour, twinWrongColour);
  assert.notEqual(diff, null, "the gate FAILED to catch the wrong-colour twin — it proves nothing");
  assert.equal(diff.addr, COLOUR_INDEX, `teeth caught the wrong address ${hx(diff.addr)} (expected the colour index ${hx(COLOUR_INDEX)})`);
  console.log(`  TEETH/colour: wrong-colour twin caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});

// -- 4. TEETH: a wrong-stride twin is caught ---------------------------------

/** Broken twin: correct colour, but steps 33 cells per row instead of 32. */
function twinWrongStride(m, columnOffset, colour) {
  const { mem8 } = m;
  mem8[COLOUR_INDEX] = colour;
  let cell = COLUMN_ANCHOR + columnOffset;
  for (let i = 0; i < 28; i++) {
    mem8[cell] = colour;
    cell += 33; // BUG: one cell too far each row
  }
}

test("TEETH (wrong stride): a twin that steps 33 cells per row is CAUGHT at the second cell", () => {
  const entry = captureRealColumnFillEntries(1500)[0];
  assert.ok(entry, "need a captured 0x3e1d entry to seed the teeth check");
  const columnOffset = entry.regs.a;
  const colour = entry.regs.c;

  const diff = ramDiff(entry, columnOffset, colour, twinWrongStride);
  assert.notEqual(diff, null, "the gate FAILED to catch the wrong-stride twin — it proves nothing");
  console.log(`  TEETH/stride: wrong-stride twin caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});
