// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for drawGameOverLabel (ROM 0x48e5, The Pit) — the HUD
 * label painter that stamps the nine-character "GAME OVER" run down its text
 * column. It names one tile cell (column 1, row 12), asks the shared address
 * helpers for that cell's tilemap offset and colour-RAM / video-RAM cursors, copies
 * the nine glyphs down the video column, and tail-jumps into the colour-column
 * filler.
 *
 * WHY THIS ROUTINE IS STRAIGHTFORWARD FOR THE GATE:
 *
 *   1. It is entered from the HUD redraw (loc_472c) whenever no player is active —
 *      player count 0, the game-over state — which attract reaches early (0x48e5
 *      first dispatches ~frame 61). So a REAL captured dispatch is available with no
 *      crafted forcing, and the capture confirms player count 0 (the "GAME OVER"
 *      arm).
 *
 *   2. Its four helpers (0x3dae / 0x3dc9 / 0x3dea, and the 0x3e01 tail) are still the
 *      frozen oracle. Both the oracle and the idiomatic routine reach them the same
 *      way (through the registry), so the identical callee runs on both sides — the
 *      gate is only testing drawGameOverLabel's own layout writes and its routing.
 *
 *   3. It is straight-line: fixed column/row, a fixed colour, a fixed row count, and
 *      a fixed ROM glyph source — no input-dependent branch. So the one real dispatch
 *      exercises the whole path; there is no state-dependent input to sweep.
 *
 *   4. It tail-jumps into the colour filler, so its honest live-out is MEMORY-ONLY.
 *      Because the oracle's stack pushes are reproduced at the call boundary, the
 *      leftover register file and stack pointer also land identical, so the full
 *      unitEquivalence contract (memory + pc + registers) holds too.
 *
 * EQUAL is proven on the real captured entry (direct clones and through the shared
 * unitEquivalence harness); the teeth twins — a wrong colour, an off-by-one glyph
 * source that only surfaces in video RAM, and a post-hoc output corruption through
 * the harness — are all caught.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-48e5.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_48e5 as oracle } from "../../translated/loc_48e5.js";
import { drawGameOverLabel as idiomatic } from "../drawGameOverLabel.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x48e5; // drawGameOverLabel
const TILE_COL = 0x8058; // label cell column byte
const TILE_ROW = 0x8059; // label cell row byte
const FILL_ATTR = 0x8057; // colour attribute the label run is painted in
const CELL_COUNT = 0x8055; // row count fed to the copy and the colour fill
const GAME_OVER_SOURCE = 0x49a5; // ROM "GAME OVER" glyph source (walked backwards)
const CAPTURE_FRAMES = 240; // 0x48e5 first dispatches ~frame 61 — within this
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture the real machine state at 0x48e5's genuine attract dispatch. The hook
 * clones the pristine entry, then runs the oracle so the host run continues normally.
 */
function captureRealEntry() {
  let entry = null;
  let playerCount = null;
  const overrides = new Map([
    [TARGET, (mm) => {
      if (entry === null) {
        entry = mm.clone();
        playerCount = mm.mem.read8(0x8001); // 0 in the game-over (GAME OVER) arm
      }
      return oracle(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return { entry, playerCount };
}

const CAP = ROM_PRESENT ? captureRealEntry() : { entry: null, playerCount: null };
const ENTRY = CAP.entry;

/**
 * Run the oracle and a candidate on two independent clones of one entry state and
 * diff MEMORY + exit pc — the honest live-out. (The residual register file is a dead
 * live-out here and is not part of the contract, though it also matches.)
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

test("EQUAL (captured): idiomatic == oracle on the real GAME OVER dispatch", () => {
  assert.ok(ENTRY, "captured the real 0x48e5 attract dispatch");
  assert.equal(CAP.playerCount, 0, "the captured dispatch is the game-over (player count 0) arm");
  const r = runPair(ENTRY, idiomatic);
  assert.equal(r.ram, null, r.ram && `RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
  assert.equal(r.pc, null, r.pc && `exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
  console.log("  EQUAL/captured: real 0x48e5 entry identical (memory + pc)");
});

// -- 2. EQUAL: through the shared unitEquivalence harness ----------------------
// The canonical gate: capture the real dispatch, clone, run both, diff. It compares
// memory + pc + the full register file. Memory-only is the honest live-out, but because
// the oracle's stack pushes are reproduced, the FULL contract holds — so this asserts
// the strongest result the harness reports (equal).

test("EQUAL (harness): the real 0x48e5 dispatch is memory-EQUAL through unitEquivalence", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, idiomatic, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.ram, null, `harness RAM diverged: ${JSON.stringify(res.ram)}`);
  assert.equal(res.pc, null, `harness exit pc diverged: ${JSON.stringify(res.pc)}`);
  assert.equal(res.equal, true, `harness reported not-equal (regs=${JSON.stringify(res.regs)})`);
  console.log("  EQUAL/harness: unitEquivalence captured a real 0x48e5 entry -> memory + pc + registers EQUAL");
});

// -- 3. IDENTITY: oracle vs oracle must be EQUAL (proves the gate wiring) ------

test("IDENTITY: oracle vs oracle reports EQUAL (gate wiring sanity)", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, true, `gate reported a diff for identical arms: ${JSON.stringify(res)}`);
  console.log("  IDENTITY: oracle vs oracle -> EQUAL");
});

// -- 4. TEETH: broken twins the gate MUST catch -------------------------------

// The twins mirror the idiomatic routine's exact structure (including the oracle-stack
// return pushes) and change ONE thing, so each twin's only divergence is its bug — not
// a spurious stack difference that would mask which byte the gate actually caught.

/** Broken twin A: paints the label run in the WRONG colour attribute. */
function brokenAttr(m) {
  const { mem } = m;
  mem.write8(TILE_COL, 1);
  mem.write8(TILE_ROW, 12);
  m.push16(0x48f2); m.call(0x3dae);
  m.push16(0x48f5); m.call(0x3dc9);
  mem.write8(FILL_ATTR, 7); // BUG: colour 7 instead of 6
  mem.write8(CELL_COUNT, 9);
  m.regs.ix = GAME_OVER_SOURCE;
  m.push16(0x4906); m.call(0x3dea);
  return m.call(0x3e01);
}

/**
 * Broken twin B: an off-by-one glyph source pointer. Every scratch byte is written
 * exactly as the oracle does — this divergence surfaces ONLY through the copy helper,
 * as wrong glyphs in video RAM. Proves the gate catches a purely callee-mediated
 * effect, not just a directly-written scratch byte.
 */
function brokenSource(m) {
  const { mem } = m;
  mem.write8(TILE_COL, 1);
  mem.write8(TILE_ROW, 12);
  m.push16(0x48f2); m.call(0x3dae);
  m.push16(0x48f5); m.call(0x3dc9);
  mem.write8(FILL_ATTR, 6);
  mem.write8(CELL_COUNT, 9);
  m.regs.ix = GAME_OVER_SOURCE - 1; // BUG: glyphs shifted by one
  m.push16(0x4906); m.call(0x3dea);
  return m.call(0x3e01);
}

test("TEETH: a wrong colour attribute is CAUGHT", () => {
  const r = runPair(ENTRY, brokenAttr);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong colour — it is worthless");
  assert.equal(r.ram.addr, FILL_ATTR, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the attribute byte ${hx(FILL_ATTR)})`);
  console.log(`  TEETH: wrong colour caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: an off-by-one glyph pointer is CAUGHT downstream in video RAM", () => {
  const r = runPair(ENTRY, brokenSource);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a callee-mediated glyph error — it is worthless");
  // Scratch bytes are identical to the oracle; the first diff is a painted cell.
  assert.ok(r.ram.addr >= 0x8800, `teeth caught ${hx(r.ram.addr ?? 0)}, expected a painted colour/video cell (>= 0x8800)`);
  console.log(`  TEETH: off-by-one glyph caught downstream at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

// -- 5. TEETH through the harness: a corrupted output is CAUGHT ----------------

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
