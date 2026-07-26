// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for tileInProbeRow (ROM 0x33bc, The Pit) — the object
 * mover's tile-vs-probe-row membership check.
 *
 * The routine reads three work-RAM inputs (0x808d phase-row selector, 0x8089 probe
 * cell pointer, 0x8086 object sub-row), fetches the tile at the probe cell — one
 * cell back at the boundary phase — and scans a 32-tile row of the ROM probe table
 * at 0x34fe for it. It writes NO memory. Every caller (0x319d) consumes exactly one
 * thing: the found/not-found result. So the declared LIVE-OUT is that boolean (the
 * oracle's Z flag), and equivalence compares the idiomatic return against it — never
 * the full register file the oracle also churns and the caller never reads.
 *
 * CRAFTED-ENTRY, because 0x33bc is never dispatched during attract: the mover 0x319d
 * runs thousands of times but the demo objects never take a probe arm. So there is no
 * natural capture of the target. Instead a REAL attract state is captured at the
 * caller 0x319d, and the probe's inputs are poked onto clones of it — a real machine
 * with a surgical nudge, the crafted-entry escape hatch for an unreached routine.
 * The base state carries a genuine ROM table and a valid stack; only the probe inputs
 * are set. The probe cell is aimed at a work-RAM byte the test owns, so the searched
 * tile is fully controlled on both sides.
 *
 * THREE checks:
 *   1. EQUAL (exhaustive membership) — for many row selectors and both phases, sweep
 *      the searched tile over all 256 byte values (placed so the boundary step does
 *      not change which byte is read) and confirm the idiomatic result equals the
 *      oracle's found flag, and that the oracle mutates no memory (the pure read that
 *      licenses the memory-free contract).
 *   2. EQUAL (boundary-offset matrix) — put a different byte at the probe cell and at
 *      the cell-before it, across both phases, so the result depends on the one-step-
 *      back sampling; confirm the idiomatic result still tracks the oracle. This is
 *      what makes the gate sensitive to the boundary-phase pointer step.
 *   3. TEETH — two deliberately-broken twins the gate MUST catch: one that never
 *      steps the pointer back at the boundary (caught by the offset matrix), and one
 *      that ignores the search result and always reports found (caught by the sweep).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-33bc.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_33bc as oracle } from "../../translated/loc_33bc.js";
import { tileInProbeRow as idiomatic } from "../tileInProbeRow.js";
import { loc_319d } from "../../translated/loc_319d.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const CALLER = 0x319d; // the mover we capture a real attract state at
const CAPTURE_FRAMES = 1300; // the mover first runs ~frame 1150; run well past it

const PHASE_ROW = 0x808d; // probe-table row selector (multiples of 32 in play)
const PROBE_PTR = 0x8089; // 16-bit tilemap pointer to the object's probe cell
const SUB_ROW = 0x8086; // object sub-row; its boundary phase steps the probe back
const TABLE = 0x34fe; // base of the ROM probe table (32-byte rows)

const PROBE_CELL = 0x8200; // a work-RAM byte the test aims the probe at (test-owned)
const DEC_PHASE = 3; // (3 + 5) % 8 == 0 -> boundary phase, probe steps one cell back
const KEEP_PHASE = 0; // (0 + 5) % 8 != 0 -> probe cell used as-is

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture one real attract machine state at the mover 0x319d's entry. The hook clones
 * the pristine entry, then runs the real mover so attract continues undisturbed.
 */
function captureCallerState() {
  let entry = null;
  const overrides = new Map([[CALLER, (mm) => {
    if (entry === null) entry = mm.clone();
    return loc_319d(mm);
  }]]);
  makeMachine(overrides).runFrames(CAPTURE_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureCallerState() : null;

/**
 * Poke one probe scenario onto a clone: row selector, sub-row phase, and the two
 * bytes the probe might read — `atCell` at the probe cell, `atCellBefore` one cell
 * back (the byte the boundary phase samples). The stack is parked in work RAM so the
 * oracle's trailing return reads valid bytes.
 */
function pokeProbe(c, rowSel, phase, atCellBefore, atCell) {
  c.mem.write8(PHASE_ROW, rowSel);
  c.mem.write8(SUB_ROW, phase);
  c.mem.write16(PROBE_PTR, PROBE_CELL);
  c.mem.write8(PROBE_CELL - 1, atCellBefore);
  c.mem.write8(PROBE_CELL, atCell);
  c.regs.sp = 0x83fe;
}

/** Run the oracle on a crafted clone; return its found flag and whether it wrote RAM. */
function oracleResult(rowSel, phase, atCellBefore, atCell) {
  const c = ENTRY.clone();
  pokeProbe(c, rowSel, phase, atCellBefore, atCell);
  const before = c.dumpState();
  oracle(c);
  const wrote = firstStateDiff(before, c.dumpState(), (off) => c.stateOffsetToAddr(off));
  return { found: c.regs.fZ, wrote };
}

/** Run a candidate on a crafted clone; return its boolean and whether it wrote RAM. */
function candidateResult(fn, rowSel, phase, atCellBefore, atCell) {
  const c = ENTRY.clone();
  pokeProbe(c, rowSel, phase, atCellBefore, atCell);
  const before = c.dumpState();
  const found = fn(c);
  const wrote = firstStateDiff(before, c.dumpState(), (off) => c.stateOffsetToAddr(off));
  return { found, wrote };
}

/** Read the 32 tile bytes of a probe row from the captured ROM. */
function rowBytes(rowSel) {
  const c = ENTRY.clone();
  const bytes = [];
  for (let i = 0; i < 32; i++) bytes.push(c.mem.read8(TABLE + rowSel + i));
  return bytes;
}

/** A tile present in the row, and one guaranteed absent from it. */
function rowMembers(rowSel) {
  const present = new Set(rowBytes(rowSel));
  let absent = -1;
  for (let v = 0; v < 256 && absent < 0; v++) if (!present.has(v)) absent = v;
  return { inRow: [...present][0], notInRow: absent };
}

// Real row selectors (multiples of 32) plus a few odd values for breadth.
const ROW_SELECTORS = [0, 32, 64, 96, 128, 160, 192, 224, 1, 16, 31, 255];
// The eight in-play rows for the offset matrix.
const REAL_ROWS = [0, 32, 64, 96, 128, 160, 192, 224];

// -- 1. EQUAL: exhaustive membership sweep + purity ---------------------------

test("EQUAL (exhaustive): found flag == oracle over every tile byte, and the oracle writes no memory", () => {
  assert.ok(ENTRY, "captured a real attract state at the mover 0x319d");
  let compared = 0;
  for (const rowSel of ROW_SELECTORS) {
    for (const phase of [DEC_PHASE, KEEP_PHASE]) {
      for (let tile = 0; tile < 256; tile++) {
        // Same byte at both possible read sites, so the boundary step cannot change
        // which byte is searched — this isolates the membership decision.
        const o = oracleResult(rowSel, phase, tile, tile);
        const c = candidateResult(idiomatic, rowSel, phase, tile, tile);
        compared++;
        assert.equal(
          o.wrote, null,
          o.wrote && `oracle wrote RAM at ${hx(o.wrote.addr ?? 0)} — the memory-free contract is false`,
        );
        assert.equal(c.wrote, null, c.wrote && `idiomatic wrote RAM at ${hx(c.wrote.addr ?? 0)}`);
        assert.equal(
          c.found, o.found,
          `row=${hx(rowSel)} phase=${phase} tile=${hx(tile)}: idiomatic=${c.found} oracle=${o.found}`,
        );
      }
    }
  }
  assert.equal(compared, ROW_SELECTORS.length * 2 * 256, "must have compared the full membership grid");
  console.log(`  EQUAL/exhaustive: ${compared} tile-membership cases match the oracle; no memory written`);
});

// -- 2. EQUAL: boundary-offset matrix -----------------------------------------

test("EQUAL (offset matrix): the result tracks the oracle through the one-step-back sampling", () => {
  let compared = 0;
  for (const rowSel of REAL_ROWS) {
    const { inRow, notInRow } = rowMembers(rowSel);
    for (const phase of [DEC_PHASE, KEEP_PHASE]) {
      // [byte one cell back, byte at the probe cell] — mixed so the read site matters.
      for (const [before, at] of [[inRow, notInRow], [notInRow, inRow], [inRow, inRow], [notInRow, notInRow]]) {
        const o = oracleResult(rowSel, phase, before, at);
        const c = candidateResult(idiomatic, rowSel, phase, before, at);
        compared++;
        assert.equal(
          c.found, o.found,
          `row=${hx(rowSel)} phase=${phase} before=${hx(before)} at=${hx(at)}: idiomatic=${c.found} oracle=${o.found}`,
        );
      }
    }
  }
  assert.equal(compared, REAL_ROWS.length * 2 * 4, "must have compared the full offset matrix");
  console.log(`  EQUAL/offset-matrix: ${compared} boundary-sampling cases match the oracle`);
});

// -- 3. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin A: never steps the probe pointer back at the boundary phase. */
function brokenNoStepBack(m) {
  const { mem } = m;
  const rowSelector = mem.read8(PHASE_ROW);
  const probeCell = mem.read16(PROBE_PTR); // BUG: ignores the boundary-phase step-back
  const tile = mem.read8(probeCell);
  const rowBase = TABLE + rowSelector;
  for (let i = 0; i < 32; i++) if (mem.read8(rowBase + i) === tile) return true;
  return false;
}

/** Broken twin B: ignores the search result and always reports a match. */
function brokenAlwaysFound(m) {
  idiomatic(m);
  return true; // BUG: never reports "not found"
}

test("TEETH: the no-step-back twin is CAUGHT by the offset matrix", () => {
  let caught = null;
  for (const rowSel of REAL_ROWS) {
    const { inRow, notInRow } = rowMembers(rowSel);
    // At the boundary phase, the correct read is one cell back (inRow -> found); the
    // twin reads the probe cell (notInRow -> not found).
    const o = oracleResult(rowSel, DEC_PHASE, inRow, notInRow);
    const c = candidateResult(brokenNoStepBack, rowSel, DEC_PHASE, inRow, notInRow);
    if (c.found !== o.found) { caught = { rowSel, oracle: o.found, twin: c.found }; break; }
  }
  assert.ok(caught, "the gate FAILED to catch a dropped boundary step-back — it has no teeth");
  console.log(`  TEETH: no-step-back twin caught at row=${hx(caught.rowSel)} (oracle=${caught.oracle} twin=${caught.twin})`);
});

test("TEETH: the always-found twin is CAUGHT by the membership sweep", () => {
  let caught = null;
  for (const rowSel of REAL_ROWS) {
    const { notInRow } = rowMembers(rowSel);
    // A tile absent from the row: oracle reports not-found, the twin still says found.
    const o = oracleResult(rowSel, KEEP_PHASE, notInRow, notInRow);
    const c = candidateResult(brokenAlwaysFound, rowSel, KEEP_PHASE, notInRow, notInRow);
    if (c.found !== o.found) { caught = { rowSel, oracle: o.found, twin: c.found }; break; }
  }
  assert.ok(caught, "the gate FAILED to catch an always-found result — it has no teeth");
  console.log(`  TEETH: always-found twin caught at row=${hx(caught.rowSel)} (oracle=${caught.oracle} twin=${caught.twin})`);
});
