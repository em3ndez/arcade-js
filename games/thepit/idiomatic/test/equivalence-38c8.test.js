// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_38c8 (ROM 0x38c8, The Pit) — the per-frame gate for
 * the two-body actor: while the actor's coordinate (ACTOR_X, 0x810a) is in the high half
 * of the field it hands the frame to the cadence/move path (loc_3945); below the high
 * half it rebuilds the actor at the start edge and re-stamps its eight-cell tile figure
 * (tiles 184..191, colour 151) into the tilemap + colour map.
 *
 * THE CONTRACT — OBSERVABLE RAM ONLY. The move arm tail-delegates to loc_3945, whose
 * idiomatic form (and its callees descendActorToRest -> stageActorSpriteRecords) is a plain JS call
 * chain with no Z80 stack frame: it no longer marches SP, sets pc, or leaves the oracle's
 * residual value registers. So pc, SP and the value registers diverge from the oracle by
 * construction and are EXCLUDED — the gate compares the full RAM dump (work + colour +
 * video + attr/sprite) via firstStateDiff, nothing else. That is exactly what the display
 * reads; the diverged registers are dead ABI on this tail-jump ladder (its callers reload
 * the register file next frame and never read this pass's residue). The oracle's internal
 * m.call(0x3945) resolves through the frozen translated registry, so both sides run a
 * memory-equivalent move path and the RAM agrees regardless.
 *
 * Both arms are reached by the real game: the very first dispatch (~frame 976, once this
 * actor's routines come alive) still sees the boot-seeded coordinate and takes the rebuild
 * arm; every later dispatch rides the move arm. The gate also sweeps the whole coordinate
 * domain 0..255 identically on both sides to nail the 127/128 branch boundary.
 *
 * FIVE checks:
 *   1. WIRING   — the first natural attract dispatch (the rebuild arm), oracle vs
 *      idiomatic, full RAM identical. Proves the gate runs end to end.
 *   2. EQUAL    — a spread of real attract dispatches (both arms), each diffed on the full
 *      RAM dump, plus positive checks that the rebuild really parked the coordinate and
 *      stamped the figure.
 *   3. EXHAUSTIVE — over all 256 coordinate values, poked identically on both sides from a
 *      real base state; covers the 127/128 boundary, the whole rebuild arm, and the whole
 *      move arm.
 *   4. TEETH (drop the move delegation) — a twin that returns instead of running the move
 *      path on the move arm is CAUGHT (the cadence timer never advances, sprites never
 *      stage).
 *   5. TEETH (wrong rebuild) — twins that park the coordinate at the wrong edge / stamp
 *      the wrong tile are CAUGHT at exactly those addresses.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-38c8.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_38c8 as oracle } from "../../translated/loc_38c8.js";
import { loc_38c8 } from "../loc_38c8.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { ACTOR_X, ACTOR_TIMER } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x38c8;
const VIDEO_ANCHOR = 0x93a3; // anchor of the stamped figure (tilemap RAM)
const TOP_LEFT_CELL = VIDEO_ANCHOR - 32; // first cell painted, 0x9383 -> tile 184
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture real attract entry states at the target dispatch: run the game with a
 * snapshot-on-entry hook and keep a strided spread of the entry clones. The wrapper runs
 * the oracle so attract proceeds undisturbed.
 */
function captureEntries(maxFrames, stride, cap) {
  const entries = [];
  let seen = 0;
  const hook = new Map([[TARGET, (mm) => {
    if (seen % stride === 0 && entries.length < cap) entries.push(mm.clone());
    seen++;
    return oracle(mm);
  }]]);
  const host = makeMachine(hook);
  host.runFrames(maxFrames);
  return entries;
}

/** RAM-only diff (pc/SP/registers excluded per the contract). Null when identical. */
function observableDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return { msg: `RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} other=${ram.b}`, addr: ram.addr };
  return null;
}

// -- 1. WIRING: first natural dispatch (the rebuild arm) ------------------------

test("WIRING: loc_38c8 == oracle on the first natural attract dispatch (observable RAM)", () => {
  const [entry] = captureEntries(1200, 1, 1);
  assert.ok(entry, `expected 0x${TARGET.toString(16)} to dispatch during attract`);
  assert.ok(entry.mem.read8(ACTOR_X) < 128, "the first dispatch should still hold the boot coordinate (rebuild arm)");

  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  loc_38c8(b);
  const diff = observableDiff(a, b);
  assert.equal(diff, null, diff && `gate reported a RAM diff on the first dispatch: ${diff.msg}`);
  console.log("  WIRING: captured 0x38c8, ran oracle vs idiomatic through the rebuild arm -> RAM EQUAL");
});

// -- 2. EQUAL on a spread of real captured attract dispatches -------------------

test("EQUAL: loc_38c8 == oracle on real attract dispatches (full RAM dump)", () => {
  const entries = captureEntries(3000, 1, 400);
  assert.ok(entries.length >= 20, `expected many captured dispatches, got ${entries.length}`);

  let rebuild = 0, move = 0;
  for (const cap of entries) {
    const onMoveArm = cap.mem.read8(ACTOR_X) >= 128;
    onMoveArm ? move++ : rebuild++;

    const a = cap.clone();
    const b = cap.clone();
    oracle(a);
    loc_38c8(b);
    const diff = observableDiff(a, b);
    assert.equal(diff, null, diff && `mismatch on a real dispatch (ACTOR_X=${cap.mem.read8(ACTOR_X)}): ${diff.msg}`);
  }

  // Positive checks on the rebuild arm: pull a rebuild entry and confirm the parked
  // coordinate and the stamped figure actually landed.
  const rebuildEntry = entries.find((e) => e.mem.read8(ACTOR_X) < 128);
  assert.ok(rebuildEntry, "expected at least one rebuild-arm dispatch in attract");
  const r = rebuildEntry.clone();
  loc_38c8(r);
  assert.equal(r.mem.read8(ACTOR_X), 240, "rebuild must park the coordinate at the start edge");
  assert.equal(r.mem.read8(ACTOR_TIMER), 1, "rebuild must arm the cadence timer");
  assert.equal(r.mem.read8(TOP_LEFT_CELL), 184, "rebuild must stamp the figure's first tile");

  assert.ok(move > 0, "expected move-arm dispatches in attract");
  assert.ok(rebuild > 0, "expected at least one rebuild-arm dispatch in attract");
  console.log(`  EQUAL: ${entries.length} real dispatches identical (full RAM) — move=${move} rebuild=${rebuild}`);
});

// -- 3. EXHAUSTIVE over the whole coordinate input domain -----------------------

test("EXHAUSTIVE: over all 256 coordinate values the full RAM dump agrees with the oracle", () => {
  // Base from a real mid-attract move-arm state so the move path has valid downstream RAM.
  const entries = captureEntries(1500, 1, 60);
  const base = entries.find((e) => e.mem.read8(ACTOR_X) >= 128) ?? entries[0];
  assert.ok(base, "need a base attract state to sweep from");

  let checked = 0, sawRebuild = false, sawMove = false, sawBoundary = false;
  for (let x = 0; x < 256; x++) {
    const a = base.clone();
    const b = base.clone();
    a.mem.write8(ACTOR_X, x);
    b.mem.write8(ACTOR_X, x);
    oracle(a);
    loc_38c8(b);
    const diff = observableDiff(a, b);
    assert.equal(diff, null, diff && `ACTOR_X=${x}: ${diff.msg}`);

    if (x < 128) sawRebuild = true; else sawMove = true;
    if (x === 127 || x === 128) sawBoundary = true;
    checked++;
  }

  assert.equal(checked, 256, "must have swept the full coordinate domain");
  assert.ok(sawRebuild && sawMove && sawBoundary, "rebuild, move, and the 127/128 boundary must all be swept");
  console.log(`  EXHAUSTIVE: all ${checked} coordinate values agree on the full RAM dump`);
});

// -- 4 & 5. TEETH: broken twins the RAM diff MUST catch ------------------------

/** Broken twin A: on the move arm, drop the delegation (the cadence path never runs). */
function twinDropsMove(m) {
  if (m.mem.read8(ACTOR_X) >= 128) return; // BUG: should hand off to the move path
  return loc_38c8(m); // rebuild arm is unaffected
}

/** Broken twin B: rebuild, but park the coordinate at the wrong edge. */
function twinWrongCoordinate(m) {
  loc_38c8(m);
  if (m.mem.read8(ACTOR_X) === 240) m.mem.write8(ACTOR_X, 200); // BUG: wrong start edge
}

/** Broken twin C: rebuild, but stamp the wrong tile into the figure's first cell. */
function twinWrongTile(m) {
  const wasRebuild = m.mem.read8(ACTOR_X) < 128;
  loc_38c8(m);
  if (wasRebuild) m.mem.write8(TOP_LEFT_CELL, 200); // BUG: wrong tile code (oracle stamps 184)
}

test("TEETH (drop move delegation): a twin that skips the move path is CAUGHT", () => {
  const entries = captureEntries(3000, 1, 200);
  const moveEntry = entries.find((e) => e.mem.read8(ACTOR_X) >= 128);
  assert.ok(moveEntry, "need a move-arm entry for the move-delegation teeth");

  const a = moveEntry.clone();
  const b = moveEntry.clone();
  oracle(a);
  twinDropsMove(b);
  const diff = observableDiff(a, b);
  assert.notEqual(diff, null, "the gate FAILED to catch the dropped move delegation — it is worthless");
  console.log(`  TEETH/move: dropped delegation caught (${diff.msg})`);
});

test("TEETH (wrong rebuild): wrong coordinate and wrong tile are each CAUGHT", () => {
  const [entry] = captureEntries(1200, 1, 1);
  assert.ok(entry && entry.mem.read8(ACTOR_X) < 128, "need a rebuild-arm entry for the rebuild teeth");

  // Wrong parked coordinate -> caught at ACTOR_X.
  {
    const a = entry.clone();
    const b = entry.clone();
    oracle(a);
    twinWrongCoordinate(b);
    const diff = observableDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the wrong rebuild coordinate — it is worthless");
    assert.equal(diff.addr, ACTOR_X, `wrong-coordinate teeth caught ${hx(diff.addr)} (expected ${hx(ACTOR_X)})`);
    console.log(`  TEETH/coord: wrong start edge caught at ${hx(diff.addr)} (${diff.msg})`);
  }

  // Wrong stamped tile -> caught at the figure's first cell.
  {
    const a = entry.clone();
    const b = entry.clone();
    oracle(a);
    twinWrongTile(b);
    const diff = observableDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the wrong stamped tile — it is worthless");
    assert.equal(diff.addr, TOP_LEFT_CELL, `wrong-tile teeth caught ${hx(diff.addr)} (expected ${hx(TOP_LEFT_CELL)})`);
    console.log(`  TEETH/tile: wrong figure tile caught at ${hx(diff.addr)} (${diff.msg})`);
  }
});
