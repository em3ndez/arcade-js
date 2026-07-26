// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_483a (ROM 0x483a, The Pit) — the two-variant
 * panel painter: it names one tile cell (column 5), reads a live work-RAM byte to
 * pick a variant, asks the shared address helpers for that cell's tilemap offset and
 * colour-RAM / video-RAM cursors, stamps a label (plus a live-value cell in the
 * default variant), and tail-jumps into the colour-column filler.
 *
 * WHY THE GATE IS A CRAFTED ENTRY (not a captured dispatch):
 *
 *   Attract never dispatches 0x483a — a boot run of hundreds of frames enters it
 *   zero times. It draws in a state attract does not reach, so there is no genuine
 *   0x483a entry to snapshot. The pipeline's answer for unreached code is the crafted
 *   entry: take a REAL machine state and force the routine onto it. Here the entry is
 *   captured at the sibling panel painter loc_3d49's genuine frame-61 attract dispatch
 *   — a real screen-setup moment where this panel-drawing subsystem's scratch and
 *   video RAM are live — and loc_483a is then run directly on clones of it. The one
 *   input that steers the routine, the decision byte at 0x802b, is forced to each of
 *   its two arms IDENTICALLY on both sides, so any divergence is the rewrite's fault.
 *   (unitEquivalence's auto-capture cannot be used: it hooks 0x483a, which never
 *   fires in attract, so it would throw "never entered" — the reason this file drives
 *   the pair directly instead.)
 *
 *   Its five helpers (0x3dae/0x3dc9/0x3dea, and the 0x3e01 tail) are still the frozen
 *   oracle, reached the same way (through the registry) on both sides, so the gate is
 *   only testing loc_483a's own layout writes and its routing.
 *
 * WHAT IS PROVEN:
 *   EQUAL on the default variant (the realistic 0x802b == 0 plus a sweep of the live
 *   displayed value) and on the alternate variant (0x802b == 1); IDENTITY (oracle vs
 *   oracle); and TEETH — a wrong colour (direct scratch), an off-by-one label pointer
 *   that surfaces only downstream in video RAM, and a post-hoc output corruption — all
 *   caught. The gate compares the full machine dump (memory incl. the reproduced stack)
 *   plus the exit pc, with no exclusions.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-483a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_483a as oracle } from "../../translated/loc_483a.js";
import { loc_483a as idiomatic } from "../loc_483a.js";
import { loc_3d49 as sibling } from "../../translated/loc_3d49.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const SIBLING = 0x3d49; // the reachable panel painter we snapshot a real state at
const PANEL_VALUE = 0x802b; // the live decision/display byte loc_483a reads
const TILE_COL = 0x8058; // panel cell column byte (always 5)
const TILE_ROW = 0x8059; // panel cell row byte (11 default / 12 alt)
const FILL_ATTR = 0x8057; // colour attribute the panel is painted in
const CELL_COUNT = 0x8055; // per-field cell count fed to the copy/fill helpers
const DEFAULT_LABEL = 0x49ba; // ROM label glyph source, default variant (walked backwards)
const CAPTURE_FRAMES = 240; // loc_3d49 first dispatches at frame 61 — well within this
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture a real attract machine state at the sibling painter loc_3d49's genuine
 * frame-61 dispatch. The hook clones the pristine entry, then runs the sibling oracle
 * so the host run continues normally. loc_483a is never driven on the host — only on
 * isolated clones of this real state.
 */
function captureRealEntry() {
  let entry = null;
  const overrides = new Map([
    [SIBLING, (mm) => {
      if (entry === null) entry = mm.clone();
      return sibling(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return entry;
}

const REAL = ROM_PRESENT ? captureRealEntry() : null;

/** A crafted entry: the real captured state with the decision byte forced to `value`. */
function craftedEntry(value) {
  const e = REAL.clone();
  e.mem.write8(PANEL_VALUE, value);
  return e;
}

/**
 * Run the oracle and a candidate on two independent clones of one entry state and
 * diff MEMORY (full dump, incl. the reproduced stack) + exit pc — the honest live-out.
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

// -- 1. EQUAL: default variant (the realistic arm) + a displayed-value sweep --------

test("EQUAL (default variant): idiomatic == oracle across the live 0x802b value", () => {
  assert.ok(REAL, "captured a real sibling-panel attract dispatch");
  // Every value but 1 takes the default arm; each is also the byte shown in the last
  // cell, so this sweeps the one state-dependent input the routine has.
  const values = [0, 2, 3, 7, 10, 0x80, 0xff];
  for (const v of values) {
    const r = runPair(craftedEntry(v), idiomatic);
    assert.equal(r.ram, null, r.ram && `v=${hx(v)}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
    assert.equal(r.pc, null, r.pc && `v=${hx(v)}: exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
  }
  console.log(`  EQUAL/default: ${values.length} live-value inputs identical to the oracle (memory + pc)`);
});

// -- 2. EQUAL: alternate variant (the crafted arm, 0x802b == 1) ---------------------

test("EQUAL (alternate variant): idiomatic == oracle when 0x802b == 1", () => {
  const r = runPair(craftedEntry(1), idiomatic);
  assert.equal(r.ram, null, r.ram && `RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
  assert.equal(r.pc, null, r.pc && `exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
  console.log("  EQUAL/alternate: 0x802b==1 arm identical to the oracle (memory + pc)");
});

// -- 3. IDENTITY: oracle vs oracle must be EQUAL (proves the gate wiring) -----------

test("IDENTITY: oracle vs oracle reports EQUAL on both arms (gate wiring sanity)", () => {
  for (const v of [0, 1]) {
    const r = runPair(craftedEntry(v), oracle);
    assert.equal(r.ram, null, `identity RAM diff on v=${hx(v)}: ${JSON.stringify(r.ram)}`);
    assert.equal(r.pc, null, `identity pc diff on v=${hx(v)}`);
  }
  console.log("  IDENTITY: oracle vs oracle -> EQUAL on both arms");
});

// -- 4. TEETH: broken twins the gate MUST catch ------------------------------------
// Each twin mirrors the idiomatic routine exactly (including the oracle-stack return
// pushes) and changes ONE thing, so the caught diff is precisely its bug — not a
// spurious stack difference.

/** Broken twin A: default arm, painted in the WRONG colour attribute. */
function brokenAttr(m) {
  const { mem, regs } = m;
  mem.write8(TILE_COL, 5);
  mem.write8(TILE_ROW, 11);
  m.push16(0x484d); m.call(0x3dae);
  m.push16(0x4850); m.call(0x3dc9);
  mem.write8(FILL_ATTR, 152); // BUG: colour 152 instead of 151
  mem.write8(CELL_COUNT, 9);
  regs.ix = DEFAULT_LABEL;
  m.push16(0x4861); m.call(0x3dea);
  mem.write8(CELL_COUNT, 1);
  regs.ix = PANEL_VALUE;
  m.push16(0x486d); m.call(0x3dea);
  mem.write8(CELL_COUNT, 10);
  return m.call(0x3e01);
}

/**
 * Broken twin B: default arm with an off-by-one label source pointer. The scratch
 * bytes are written exactly as the oracle does — this divergence surfaces ONLY through
 * the copy helper, as wrong glyphs in video RAM. Proves the gate catches a purely
 * callee-mediated effect, not just a directly-written scratch byte.
 */
function brokenLabelSource(m) {
  const { mem, regs } = m;
  mem.write8(TILE_COL, 5);
  mem.write8(TILE_ROW, 11);
  m.push16(0x484d); m.call(0x3dae);
  m.push16(0x4850); m.call(0x3dc9);
  mem.write8(FILL_ATTR, 151);
  mem.write8(CELL_COUNT, 9);
  regs.ix = DEFAULT_LABEL - 1; // BUG: label glyphs shifted by one
  m.push16(0x4861); m.call(0x3dea);
  mem.write8(CELL_COUNT, 1);
  regs.ix = PANEL_VALUE;
  m.push16(0x486d); m.call(0x3dea);
  mem.write8(CELL_COUNT, 10);
  return m.call(0x3e01);
}

/** Broken twin C: the correct idiomatic routine, then one wrong store. */
function brokenPostHoc(m) {
  const r = idiomatic(m);
  m.mem.write8(TILE_COL, m.mem.read8(TILE_COL) ^ 0xff); // BUG: corrupts a layout byte
  return r;
}

test("TEETH: a wrong colour attribute is CAUGHT", () => {
  const r = runPair(craftedEntry(0), brokenAttr);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong colour — it is worthless");
  assert.equal(r.ram.addr, FILL_ATTR, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the attribute byte ${hx(FILL_ATTR)})`);
  console.log(`  TEETH: wrong colour caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: an off-by-one label pointer is CAUGHT downstream in video RAM", () => {
  const r = runPair(craftedEntry(0), brokenLabelSource);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a callee-mediated label error — it is worthless");
  // Scratch bytes are identical to the oracle; the first diff is a painted cell.
  assert.ok(r.ram.addr >= 0x8800, `teeth caught ${hx(r.ram.addr ?? 0)}, expected a painted colour/video cell (>= 0x8800)`);
  console.log(`  TEETH: off-by-one label caught downstream at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a post-hoc corrupted output is CAUGHT", () => {
  const r = runPair(craftedEntry(0), brokenPostHoc);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a corrupted output — it is worthless");
  assert.equal(r.ram.addr, TILE_COL, `teeth caught ${hx(r.ram.addr ?? 0)} (expected ${hx(TILE_COL)})`);
  console.log(`  TEETH: corrupted layout byte caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});
