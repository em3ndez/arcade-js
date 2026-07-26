// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_3d49 (ROM 0x3d49, The Pit) — the fixed-panel
 * painter: it names one tile cell (column 1, row 12), asks the shared address
 * helpers for that cell's tilemap offset and colour-RAM / video-RAM cursors, then
 * stamps a nine-cell vertical panel (a live work-RAM value on top, an eight-glyph
 * label below) and tail-jumps into the colour-column filler.
 *
 * WHY THIS ROUTINE IS INTERESTING FOR THE GATE:
 *
 *   1. It is entered only during screen setup, which attract does reach — but late
 *      and rarely (0x3d49 dispatches at frame 61, then not again until ~1914). So a
 *      REAL captured dispatch is available: the harness runs a boot and snapshots the
 *      genuine frame-61 entry, no crafted forcing needed.
 *
 *   2. Its five helpers (0x3dae/0x3dc9/0x3dea/0x3ddb, and the 0x3e01 tail) are still
 *      the frozen oracle. Both the oracle and the idiomatic routine reach them the
 *      same way (through the registry), so they run the identical callee on both
 *      sides — the gate is only testing loc_3d49's own layout writes and its routing.
 *
 *   3. It tail-jumps into the colour filler, so its caller consumes no register and
 *      its honest live-out is MEMORY-ONLY. (In fact every helper reads its inputs
 *      from RAM, so even the leftover register file lands identical on both sides;
 *      the gate still compares only memory + exit pc, the honest contract.)
 *
 *   4. Its one state-dependent input is the live value at 0x8000 (copied into the top
 *      cell). Attract leaves it 0, so the real entry is swept over a range of values
 *      to exercise that input beyond what attract produces.
 *
 * EQUAL is proven on the real frame-61 entry and across a 0x8000 sweep; the teeth
 * twins (wrong colour, an off-by-one label pointer that only surfaces in video RAM,
 * a post-hoc output corruption through the shared harness) are all caught.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3d49.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3d49 as oracle } from "../../translated/loc_3d49.js";
import { loc_3d49 as idiomatic } from "../loc_3d49.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3d49; // loc_3d49
const TILE_COL = 0x8058; // panel cell column byte
const TILE_ROW = 0x8059; // panel cell row byte
const FILL_ATTR = 0x8057; // colour attribute the panel is painted in
const CELL_COUNT = 0x8055; // per-field cell count fed to the fill/copy helpers
const VALUE_SOURCE = 0x8000; // the live work-RAM value copied into the top cell
const LABEL_SOURCE = 0x496d; // ROM label glyph source (walked backwards)
const CAPTURE_FRAMES = 240; // 0x3d49 first dispatches at frame 61 — well within this
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture the real machine state at 0x3d49's genuine attract dispatch. The hook
 * clones the pristine entry, then runs the oracle so the host run continues normally.
 */
function captureRealEntry() {
  let entry = null;
  const overrides = new Map([
    [TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureRealEntry() : null;

/**
 * Run the oracle and a candidate on two independent clones of one entry state and
 * diff MEMORY + exit pc — the honest live-out. (The residual register file is a dead
 * live-out here and is deliberately not part of the contract, though it also matches.)
 */
function runPair(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    pc: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
  };
}

// -- 1. EQUAL: the real captured attract dispatch -----------------------------

test("EQUAL (captured): idiomatic == oracle on the real frame-61 dispatch", () => {
  assert.ok(ENTRY, "captured the real 0x3d49 attract dispatch");
  const r = runPair(ENTRY, idiomatic);
  assert.equal(r.ram, null, r.ram && `RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
  assert.equal(r.pc, null, r.pc && `exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
  console.log("  EQUAL/captured: real 0x3d49 entry identical (memory + pc)");
});

// -- 2. EQUAL: sweep the one state-dependent input (the live top-cell value) ----

test("EQUAL (sweep): idiomatic == oracle across the live 0x8000 value", () => {
  const values = [0, 1, 2, 15, 55, 0x80, 0xa0, 0xff];
  for (const v of values) {
    const entry = ENTRY.clone();
    entry.mem.write8(VALUE_SOURCE, v);
    const r = runPair(entry, idiomatic);
    assert.equal(r.ram, null, r.ram && `v=${hx(v)}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
    assert.equal(r.pc, null, r.pc && `v=${hx(v)}: exit pc diverged`);
  }
  console.log(`  EQUAL/sweep: ${values.length} live-value inputs identical to the oracle`);
});

// -- 3. EQUAL: through the shared unitEquivalence harness ----------------------
// The canonical gate: capture the real dispatch, clone, run both, diff. It compares
// memory + pc + the full register file. Memory-only is the honest live-out, but because
// the oracle's stack pushes are reproduced, the FULL contract holds — so this asserts
// the strongest result the harness reports (equal).

test("EQUAL (harness): the real 0x3d49 dispatch is memory-EQUAL through unitEquivalence", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, idiomatic, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.ram, null, `harness RAM diverged: ${JSON.stringify(res.ram)}`);
  assert.equal(res.pc, null, `harness exit pc diverged: ${JSON.stringify(res.pc)}`);
  assert.equal(res.equal, true, `harness reported not-equal (regs=${JSON.stringify(res.regs)})`);
  console.log("  EQUAL/harness: unitEquivalence captured a real 0x3d49 entry -> memory + pc + registers EQUAL");
});

// -- 4. IDENTITY: oracle vs oracle must be EQUAL (proves the gate wiring) ------

test("IDENTITY: oracle vs oracle reports EQUAL (gate wiring sanity)", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, true, `gate reported a diff for identical arms: ${JSON.stringify(res)}`);
  console.log("  IDENTITY: oracle vs oracle -> EQUAL");
});

// -- 5. TEETH: broken twins the gate MUST catch -------------------------------

// The twins mirror the idiomatic routine's exact structure (including the oracle-stack
// return pushes) and change ONE thing, so each twin's only divergence is its bug — not
// a spurious stack difference that would mask which byte the gate actually caught.

/** Broken twin A: paints the panel in the WRONG colour attribute. */
function brokenAttr(m) {
  const { mem } = m;
  mem.write8(TILE_COL, 1);
  mem.write8(TILE_ROW, 12);
  m.push16(0x3d56); m.call(0x3dae);
  m.push16(0x3d59); m.call(0x3dc9);
  mem.write8(FILL_ATTR, 7); // BUG: colour 7 instead of 6
  mem.write8(CELL_COUNT, 1);
  m.regs.ix = VALUE_SOURCE;
  m.push16(0x3d6a); m.call(0x3dea);
  mem.write8(CELL_COUNT, 8);
  m.regs.ix = LABEL_SOURCE;
  m.push16(0x3d76); m.call(0x3ddb);
  mem.write8(CELL_COUNT, 9);
  return m.call(0x3e01);
}

/**
 * Broken twin B: an off-by-one label source pointer. The scratch bytes are written
 * exactly as the oracle does — this divergence surfaces ONLY through the fill helper,
 * as a wrong glyph in video RAM. Proves the gate catches a purely callee-mediated
 * effect, not just a directly-written scratch byte.
 */
function brokenLabelSource(m) {
  const { mem } = m;
  mem.write8(TILE_COL, 1);
  mem.write8(TILE_ROW, 12);
  m.push16(0x3d56); m.call(0x3dae);
  m.push16(0x3d59); m.call(0x3dc9);
  mem.write8(FILL_ATTR, 6);
  mem.write8(CELL_COUNT, 1);
  m.regs.ix = VALUE_SOURCE;
  m.push16(0x3d6a); m.call(0x3dea);
  mem.write8(CELL_COUNT, 8);
  m.regs.ix = LABEL_SOURCE - 1; // BUG: label glyphs shifted by one
  m.push16(0x3d76); m.call(0x3ddb);
  mem.write8(CELL_COUNT, 9);
  return m.call(0x3e01);
}

test("TEETH: a wrong colour attribute is CAUGHT", () => {
  const r = runPair(ENTRY, brokenAttr);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong colour — it is worthless");
  assert.equal(r.ram.addr, FILL_ATTR, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the attribute byte ${hx(FILL_ATTR)})`);
  console.log(`  TEETH: wrong colour caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: an off-by-one label pointer is CAUGHT downstream in video RAM", () => {
  const r = runPair(ENTRY, brokenLabelSource);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a callee-mediated label error — it is worthless");
  // Scratch bytes are identical to the oracle; the first diff is a painted cell.
  assert.ok(r.ram.addr >= 0x8800, `teeth caught ${hx(r.ram.addr ?? 0)}, expected a painted colour/video cell (>= 0x8800)`);
  console.log(`  TEETH: off-by-one label caught downstream at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

// -- 6. TEETH through the harness: a corrupted output is CAUGHT ----------------

/** Broken twin for the harness: the correct routine, then one wrong store. */
function brokenHarness(m) {
  const r = idiomatic(m);
  m.mem.write8(TILE_COL, m.mem.read8(TILE_COL) ^ 0xff); // BUG: corrupts a layout byte
  return r;
}

test("TEETH (harness): a corrupted output is CAUGHT by unitEquivalence", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, brokenHarness, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, false, "unitEquivalence FAILED to catch the corrupted twin — it is worthless");
  assert.notEqual(res.ram, null, "the diff must include a RAM difference");
  assert.equal(res.ram.addr, TILE_COL, `harness caught ${hx(res.ram?.addr ?? 0)} (expected ${hx(TILE_COL)})`);
  console.log(`  TEETH/harness: corrupted layout byte caught at ${hx(res.ram.addr)} (oracle=${res.ram.a} broken=${res.ram.b})`);
});
