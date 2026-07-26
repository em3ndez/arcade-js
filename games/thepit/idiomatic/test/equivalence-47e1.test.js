// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_47e1 (ROM 0x47e1) — the fixed vertical HUD/status panel
 * painter: seed the shared tile-plotter params and drive its five (still-frozen) plot
 * helpers to stamp one tile column + colour column at screen column 1, row 12.
 *
 * loc_47e1 is only invoked while a game is running (round setup calls it for the 1-/2-
 * player modes; the in-play HUD loops call it), so it is NEVER dispatched during a plain
 * attract run — the natural-capture harness (unitEquivalence) would find no entry. This
 * is therefore a CRAFTED-ENTRY gate, the accepted fallback for an unreached arm:
 *
 *   - Capture a real mid-attract machine state (by hooking loc_3dae, which IS reached
 *     early in attract) so the one input the routine actually reads, the secondary
 *     game-state byte at 0x8002, and the ROM tables are all realistic.
 *   - Craft the loc_47e1 entry from it: give it a clean cold-boot stack (sp = 0x83ff)
 *     with one caller return address pushed, so the routine's tail hand-off has somewhere
 *     to return. The Pit keeps its stack in diffed work RAM, so the stack is part of the
 *     compared state — both sides run the identical crafted entry, so it stays equal.
 *   - Run the ORACLE on one clone and the idiomatic loc_47e1 on another and diff the FULL
 *     contract: all of RAM (work + colour + video, nothing excluded — the whole panel is
 *     the point), the entire register file, and pc. Repeat across several 0x8002 values
 *     so the top-cell copy is exercised.
 *
 * TEETH (a green gate must be able to fail):
 *   - a broken twin of loc_47e1 that paints with the wrong fill byte MUST be caught;
 *   - corrupting one painted colour cell after the oracle runs MUST be caught.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-47e1.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_47e1 as oracle } from "../../translated/loc_47e1.js";
import { loc_3dae as real3dae } from "../../translated/loc_3dae.js";
import { loc_47e1 as idiomatic } from "../loc_47e1.js";
import { makeMachineFactory } from "../../machine.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const SEED_HOOK = 0x3dae; // a routine reached early in attract, used to grab a real state
const GAME_STATE2 = 0x8002; // the one input loc_47e1 reads (its top-cell copy source)
const CALLER_RETURN = 0x032c; // a real caller return address (round setup's call site)
const PANEL_COLOUR_CELL = 0x8981; // colour-RAM cell for column 1, row 12 (a painted output)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async,
// so build the factory once up front (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- capture a real attract state --------------------------------------------

/** Hook a reached routine and clone the machine at its first real dispatch. */
function captureAttractSeed(maxFrames) {
  let seed = null;
  const snapshot = new Map([[SEED_HOOK, (mm) => {
    if (seed === null) seed = mm.clone();
    return real3dae(mm); // let the host game proceed undisturbed
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return seed;
}

/**
 * Craft the loc_47e1 entry from a real seed: a clean cold-boot stack with one caller
 * return address staged, and (optionally) the secondary game-state byte poked so the
 * top-cell copy is exercised with different values. Both compared sides run this same
 * crafted entry, so anything the crafting clobbers is clobbered identically.
 */
function craftEntry(seed, state2) {
  const e = seed.clone();
  if (state2 !== undefined) e.mem.write8(GAME_STATE2, state2);
  e.regs.sp = 0x83ff;
  e.push16(CALLER_RETURN);
  return e;
}

// -- the memory-equivalence contract -----------------------------------------

/** Run one implementation on a fresh clone of the entry. */
function runOn(entry, fn) {
  const c = entry.clone();
  fn(c);
  return c;
}

/**
 * Full contract: RAM (work + colour + video, nothing excluded), the entire register
 * file, and pc. Returns human-readable mismatches (empty when equal).
 */
function contractDiffs(entry, fn) {
  const o = runOn(entry, oracle);
  const c = runOn(entry, fn);
  const diffs = [];

  const da = o.dumpState(), db = c.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] !== db[i]) {
      diffs.push(`RAM@${hx(o.stateOffsetToAddr(i))} oracle=${da[i]} cand=${db[i]}`);
      break;
    }
  }
  for (const k of REG_FIELDS) {
    if (o.regs[k] !== c.regs[k]) {
      diffs.push(`reg ${k} oracle=${hx(o.regs[k])} cand=${hx(c.regs[k])}`);
      break;
    }
  }
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  return diffs;
}

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: idiomatic loc_47e1 == oracle from a real crafted entry, across secondary-state values", () => {
  const seed = captureAttractSeed(240);
  assert.ok(seed, "no attract seed captured — loc_3dae was not reached in 240 frames");

  const state2Values = [undefined, 0x00, 0x01, 0x02, 0x2b, 0xff];
  for (const s2 of state2Values) {
    const entry = craftEntry(seed, s2);
    const diffs = contractDiffs(entry, idiomatic);
    assert.equal(diffs.length, 0, `0x8002=${s2 === undefined ? "(real)" : hx(s2)}: ${diffs.join("; ")}`);
  }

  // Confirm the routine really paints (guards against a vacuously-equal no-op entry).
  const painted = runOn(craftEntry(seed, 0x01), idiomatic);
  assert.equal(painted.mem.read8(PANEL_COLOUR_CELL), 7, "panel colour cell was not painted");
  console.log(
    `  EQUAL: ${state2Values.length} crafted entries identical (RAM+regs+pc); ` +
      `panel colour cell ${hx(PANEL_COLOUR_CELL)} = 7`,
  );
});

// -- 2. TEETH -----------------------------------------------------------------

/** Broken twin of loc_47e1: paints the panel with the wrong fill byte (6, not 7). */
function brokenLoc47e1(m) {
  const { regs, mem } = m;
  mem.write8(0x8058, 1);
  mem.write8(0x8059, 12);
  m.push16(0x47ee); m.call(0x3dae);
  m.push16(0x47f1); m.call(0x3dc9);
  mem.write8(0x8057, 6); // BUG: fill byte should be 7
  mem.write8(0x8055, 1); regs.ix = 0x8002; m.push16(0x4802); m.call(0x3dea);
  mem.write8(0x8055, 7); regs.ix = 0x49b1; m.push16(0x480e); m.call(0x3ddb);
  mem.write8(0x8055, 9); return m.call(0x3e01);
}

/** After the real routine, corrupt one painted colour cell — a pure output diff. */
function corruptedOutput(m) {
  oracle(m);
  m.mem.write8(PANEL_COLOUR_CELL, m.mem.read8(PANEL_COLOUR_CELL) ^ 0xff);
}

test("TEETH: a wrong-fill-byte twin and a corrupted output cell are both CAUGHT", () => {
  const seed = captureAttractSeed(240);
  assert.ok(seed, "no attract seed captured");
  const entry = craftEntry(seed, 0x01);

  const twinDiffs = contractDiffs(entry, brokenLoc47e1);
  assert.ok(twinDiffs.length > 0, "the wrong-fill-byte twin escaped detection — the gate is worthless");

  const outDiffs = contractDiffs(entry, corruptedOutput);
  assert.ok(outDiffs.length > 0, "a corrupted painted colour cell escaped detection — the gate is worthless");

  console.log(`  TEETH: wrong-fill twin caught (${twinDiffs[0]}); output corruption caught (${outDiffs[0]})`);
});
