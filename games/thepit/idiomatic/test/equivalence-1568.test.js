// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for resolveObjectTerrainStep (ROM 0x1568) — resolve a moving object's step against the
 * terrain directly under it (and, off the grid, the tile one step ahead): hold against a solid,
 * push a pushable block, or walk on. The vertical/other-axis counterpart of resolveActorTerrainStep.
 *
 * Given the tile the object sits ON (register live-in, surfaced as underTile), the object's biased
 * tile column (column; low 3 bits = the sub-tile offset), and the object's tile-cell pointer
 * (cellPtr; the cell one step ahead is the next byte), it writes the whole outcome of the step to
 * work RAM and then hands off to either advanceObjectWalkFrame (walk on) or stageObjectSpriteRecord
 * (hold / arm / settle — rebuild the record in place). Both are already idiomatic, so resolveObjectTerrainStep calls
 * them directly; no register hand-off survives. Its declared LIVE-OUT is MEMORY-ONLY: the two
 * special-tile latches (FEATURE_TILE_LATCH / GOAL_TILE_LATCH), the under/ahead expected-tile records
 * (EXPECTED_TILE / NEXT_TILE / the raw-ahead scratch 0x80a6), the push-reaction state/timer/sprite
 * (REACTION_STATE / REACTION_TIMER / SPRITE_CODE), and whatever the record builder or walk step
 * leaves.
 *
 * FULL-RAM CONTRACT, NO STACK WINDOW. resolveObjectTerrainStep has no ret of its own — every exit is a tail-jump to
 * a separate routine — so the still-frozen oracle reaches its tail targets by tail-jump too, never a
 * pushing CALL. Measured oracle-vs-idiomatic across the whole input domain: the two leave IDENTICAL
 * RAM with nothing written below the entry stack pointer (unlike resolveActorTerrainStep, whose loot-award sub-calls
 * pushed dead scratch). So the diff is the full RAM dump with no exclusion — tighter than the
 * sound-stub / resolveActorTerrainStep dissolves. Registers/flags/pc/SP are excluded (the honest-signature
 * contract); the three register live-ins default to the registers so a no-arg call reproduces the
 * oracle exactly.
 *
 * CRAFTED ENTRIES. Attract never digs an object into this case (measured: 0 dispatches in 4000
 * frames), so the capture/replay harness cannot hook 0x1568 directly. Per the crafted-entry method
 * the gate runs it from REAL captured attract clones (a valid stack, video RAM, and object record)
 * with its three inputs poked — and because the routine's behaviour depends only on the under tile,
 * the ahead tile, and the low 3 bits of the column, those axes are swept exhaustively.
 *
 * Checks:
 *   0. HARNESS — confirm attract never dispatches 0x1568, and oracle-vs-oracle on a crafted entry is
 *      deterministic (the capture/clone/replay plumbing works on a real attract clone).
 *   1. EQUAL (real attract clones) — over a spread of captured attract states, a representative
 *      crafted step leaves identical RAM to the oracle. Proves it on real machine states.
 *   2. EQUAL (under-tile sweep) — every under-tile id 0..255 across all 8 sub-offsets (plus high-bit
 *      columns): every solid / diagonal-block / pushable-band / settled branch, both push arms.
 *   3. EQUAL (ahead-tile sweep) — every ahead-tile id 0..255 across the off-grid sub-offsets: the
 *      whole tile-ahead ladder, its ROM table, and the sub-offset step-down.
 *   4. EQUAL (cross-check) — both branches of the under-record cross-check (walk vs re-arm the push).
 *   5. NON-VACUOUS — a push-arm entry really sets the reaction state/timer/sprite, and a feature
 *      entry really latches; a no-op twin cannot pass, and both agree with the oracle.
 *   6. TEETH (feature latch) — a twin that skips the feature-tile latch is CAUGHT at FEATURE_TILE_LATCH.
 *   7. TEETH (push arm) — a twin that skips the push-reaction arm is CAUGHT at REACTION_STATE.
 *   8. TEETH (ahead lookup) — a twin that corrupts the ahead expected-tile record is CAUGHT at NEXT_TILE.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-1568.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1568 as oracle } from "../../translated/loc_1568.js";
import { resolveObjectTerrainStep as idiomatic } from "../resolveObjectTerrainStep.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  FEATURE_TILE_LATCH,
  GOAL_TILE_LATCH,
  EXPECTED_TILE,
  NEXT_TILE,
  CUR_TILE,
  REACTION_STATE,
  REACTION_TIMER,
  SPRITE_CODE,
} from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x1568;
const AHEAD_CELL = 0x8700; // isolated high work-RAM cell IX points at, so the tile-ahead read (IX+1) is controllable
const RAW_AHEAD = 0x80a6; // raw tile one step ahead, recorded before the table lookup
const PUSH_SPRITE = 0xb5; // the push-reaction sprite/handler code
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async, so build the
// factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real attract machine states: run the game and clone it at a spread of frames. Each clone is a
 * genuine in-play machine (real RAM, valid stack, video RAM, object record), independent of the
 * source run — a faithful base for the crafted steps 0x1568 is never naturally reached with.
 */
function captureStates(count, stride, startFrame) {
  const m = makeMachine();
  m.runFrames(startFrame);
  const caps = [];
  for (let i = 0; i < count; i++) {
    m.runFrames(stride);
    caps.push(m.clone());
  }
  return caps;
}

/**
 * Craft an entry from a real base: pick the tile under the object (underTile), its column, and the
 * tile one step ahead (IX points at an isolated cell so IX+1 is controllable). Optional under-tile
 * cross-check inputs (cur / expected) pre-set the saved-current / expected-tile scratch.
 */
function craft(base, { underTile, column, aheadTile = 0, cur, expected } = {}) {
  const e = base.clone();
  e.regs.b = underTile;
  e.regs.d = column;
  e.regs.ix = AHEAD_CELL;
  e.mem.write8((AHEAD_CELL + 1) & 0xffff, aheadTile);
  if (cur !== undefined) e.mem.write8(CUR_TILE, cur);
  if (expected !== undefined) e.mem.write8(EXPECTED_TILE, expected);
  return e;
}

/** Run oracle and candidate on independent clones of `entry`; return the first differing RAM byte
 *  (or null). The idiomatic live-ins default to the registers, so a no-arg call matches the oracle. */
function ramDiff(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** True when the oracle drives the push-reaction arm on this entry (REACTION_STATE left at 1). The
 *  caller pre-sets REACTION_STATE to a sentinel != 1 so this is unambiguous. */
function oracleArms(entry) {
  const c = entry.clone();
  oracle(c);
  return c.mem.read8(REACTION_STATE) === 1;
}

// -- 0. HARNESS: attract never dispatches 0x1568; oracle-vs-oracle is deterministic ---------------

test("HARNESS: 0x1568 is never dispatched in attract, and oracle-vs-oracle on a crafted entry is EQUAL", () => {
  let dispatched = 0;
  const probe = new Map([[TARGET, (mm) => { dispatched++; return oracle(mm); }]]);
  makeMachine(probe).runFrames(4000);
  assert.equal(dispatched, 0, `expected 0x1568 to be unreached in attract, saw ${dispatched} dispatches`);

  const [base] = captureStates(1, 1, 300);
  const entry = craft(base, { underTile: 0x72, column: 0, aheadTile: 0x74 });
  assert.equal(ramDiff(entry, oracle), null, "oracle vs oracle must be identical");
  console.log(`  HARNESS: 0x1568 unreached in attract (crafted-entry gate); oracle-vs-oracle EQUAL (SP=${hx(base.regs.sp)})`);
});

// -- 1. EQUAL over real captured attract clones ---------------------------------------------------

test("EQUAL: resolveObjectTerrainStep leaves the same RAM as the oracle over real attract clones", () => {
  const caps = captureStates(10, 90, 120);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    // A representative off-grid step over a pushable under tile with a pushable tile ahead.
    const d = ramDiff(craft(cap, { underTile: 0x72, column: 3, aheadTile: 0x74 }), idiomatic);
    assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  }
  console.log(`  EQUAL/real: ${caps.length} real attract clones — RAM identical to the oracle`);
});

// -- 2. EQUAL over the full under-tile sweep (all 256 ids x every sub-offset) ----------------------

test("EQUAL (under-tile sweep): every under-tile id across every sub-offset matches the oracle", () => {
  const [base] = captureStates(1, 1, 200);
  const columns = [0, 1, 2, 3, 4, 5, 6, 7, 0x2c, 0xff]; // 0..7 exhaust the low 3 bits; two high-bit sanity columns
  let n = 0;
  for (let underTile = 0; underTile < 256; underTile++) {
    for (const column of columns) {
      // Distinct cur/expected so the cross-check tail is exercised too; a band tile ahead so the
      // off-grid cases run the tile-ahead lookup.
      const d = ramDiff(craft(base, { underTile, column, aheadTile: 0x74, cur: 0x40, expected: 0x55 }), idiomatic);
      assert.equal(d, null, d && `under=${hx(underTile)} col=${hx(column)}: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
      n++;
    }
  }
  console.log(`  EQUAL/under: ${n} (under-tile, column) combinations — RAM identical (all 256 ids)`);
});

// -- 3. EQUAL over the full ahead-tile sweep (all 256 ids, off the grid) ---------------------------

test("EQUAL (ahead-tile sweep): every ahead-tile id across the off-grid sub-offsets matches the oracle", () => {
  const [base] = captureStates(1, 1, 240);
  // under tile 0x30 is below the pushable band -> the under step settles and, off the grid, drops
  // straight into the tile-ahead ladder. Off-grid sub-offsets exercise the step-down + both tables.
  const columns = [1, 2, 3, 5, 6, 7, 0x2b];
  let n = 0;
  for (let aheadTile = 0; aheadTile < 256; aheadTile++) {
    for (const column of columns) {
      const d = ramDiff(craft(base, { underTile: 0x30, column, aheadTile, cur: 0x40, expected: 0x55 }), idiomatic);
      assert.equal(d, null, d && `ahead=${hx(aheadTile)} col=${hx(column)}: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
      n++;
    }
  }
  console.log(`  EQUAL/ahead: ${n} (ahead-tile, column) combinations — RAM identical (all 256 ids)`);
});

// -- 4. EQUAL over both cross-check branches ------------------------------------------------------

test("EQUAL (cross-check): both branches (walk vs re-arm the push) match the oracle", () => {
  const [base] = captureStates(1, 1, 260);
  // under 0x30 (below band, no under lookup, so 0x80a7 keeps the poked value) + ahead 0x20 (below
  // band -> straight to the cross-check). cur==expected -> walk; cur!=expected -> re-arm.
  for (const [cur, expected] of [[0x40, 0x40], [0x40, 0x55], [0x00, 0x00], [0x99, 0x11]]) {
    for (const column of [1, 3, 5, 7]) {
      const d = ramDiff(craft(base, { underTile: 0x30, column, aheadTile: 0x20, cur, expected }), idiomatic);
      assert.equal(d, null, d && `cur=${cur} exp=${expected} col=${hx(column)}: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
    }
  }
  console.log("  EQUAL/cross-check: walk and re-arm branches identical to the oracle");
});

// -- 5. NON-VACUOUS: the push arm and the feature latch really happen ------------------------------

test("NON-VACUOUS: a push-arm entry sets the reaction, a feature entry latches, both agree with the oracle", () => {
  const [base] = captureStates(1, 1, 280);

  // Find a real push-arm entry: a pushable-band under tile, aligned, whose ROM table mismatches.
  let arm = null;
  for (let underTile = 0x71; underTile <= 0x9d && !arm; underTile++) {
    const e = craft(base, { underTile, column: 0, aheadTile: 0x74 });
    e.mem.write8(REACTION_STATE, 0); // sentinel so oracleArms() is unambiguous
    if (oracleArms(e)) arm = e;
  }
  assert.ok(arm, "expected some aligned pushable-band under tile to arm the push");

  const c = arm.clone();
  idiomatic(c);
  assert.equal(c.mem.read8(REACTION_STATE), 1, "push reaction state not armed");
  assert.equal(c.mem.read8(SPRITE_CODE), PUSH_SPRITE, "push sprite/handler not set");
  assert.equal(c.mem.read8(REACTION_TIMER), arm.mem.read8(0x80a3), "push timer not reloaded from its source");
  assert.equal(ramDiff(arm, idiomatic), null, "the push-arm entry must also match the oracle");

  // Feature-tile latch: under tile 38 with the latch pre-cleared.
  const feat = craft(base, { underTile: 38, column: 0 });
  feat.mem.write8(FEATURE_TILE_LATCH, 0);
  const f = feat.clone();
  idiomatic(f);
  assert.equal(f.mem.read8(FEATURE_TILE_LATCH), 38, "feature tile not latched");
  assert.equal(ramDiff(feat, idiomatic), null, "the feature entry must also match the oracle");

  console.log("  NON-VACUOUS: push reaction armed (state 1, sprite 0xb5, timer reloaded); feature tile 38 latched; both agree");
});

// -- 6. TEETH (feature latch): a skipped latch is CAUGHT -------------------------------------------

/** Broken twin: does the real work, then reverts the feature-tile latch. */
function twinNoFeatureLatch(m) {
  const before = m.mem.read8(FEATURE_TILE_LATCH);
  idiomatic(m);
  m.mem.write8(FEATURE_TILE_LATCH, before); // BUG: undo the latch
}

test("TEETH (feature latch): a twin that skips the feature-tile latch is CAUGHT at FEATURE_TILE_LATCH", () => {
  const [base] = captureStates(1, 1, 300);
  const entry = craft(base, { underTile: 38, column: 0 });
  entry.mem.write8(FEATURE_TILE_LATCH, 0); // start clear so the real routine writes 38

  const d = ramDiff(entry, twinNoFeatureLatch);
  assert.notEqual(d, null, "the gate FAILED to catch a dropped feature latch — it proves nothing");
  assert.equal(d.addr, FEATURE_TILE_LATCH, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(FEATURE_TILE_LATCH)})`);
  assert.equal(ramDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/feature: dropped latch caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 7. TEETH (push arm): a skipped push-reaction arm is CAUGHT ------------------------------------

/** Broken twin: does the real work, then reverts the push-reaction state. */
function makeTwinNoPushArm(before) {
  return (m) => {
    idiomatic(m);
    m.mem.write8(REACTION_STATE, before); // BUG: un-arm the push reaction
  };
}

test("TEETH (push arm): a twin that skips the push-reaction arm is CAUGHT at REACTION_STATE", () => {
  const [base] = captureStates(1, 1, 320);

  let entry = null;
  for (let underTile = 0x71; underTile <= 0x9d && !entry; underTile++) {
    const e = craft(base, { underTile, column: 0, aheadTile: 0x74 });
    e.mem.write8(REACTION_STATE, 0);
    if (oracleArms(e)) entry = e;
  }
  assert.ok(entry, "expected an aligned pushable-band under tile that arms the push");
  const before = entry.mem.read8(REACTION_STATE); // 0

  const d = ramDiff(entry, makeTwinNoPushArm(before));
  assert.notEqual(d, null, "the gate FAILED to catch a skipped push arm — it proves nothing");
  assert.equal(d.addr, REACTION_STATE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(REACTION_STATE)})`);
  assert.equal(ramDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/push: skipped push arm caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 8. TEETH (ahead lookup): a corrupted ahead expected-tile record is CAUGHT ---------------------

/** Broken twin: does the real work, then corrupts the ahead expected-tile record. */
function twinCorruptAheadLookup(m) {
  idiomatic(m);
  m.mem.write8(NEXT_TILE, m.mem.read8(NEXT_TILE) ^ 0xff); // BUG: corrupt the looked-up ahead tile
}

test("TEETH (ahead lookup): a twin that corrupts the ahead expected-tile record is CAUGHT at NEXT_TILE", () => {
  const [base] = captureStates(1, 1, 340);
  // off-grid, under settles (0x30), ahead 0x74 is in the band -> the tile-ahead lookup writes NEXT_TILE.
  const entry = craft(base, { underTile: 0x30, column: 3, aheadTile: 0x74 });
  entry.mem.write8(NEXT_TILE, 0); // clear so the routine's write is observable

  // Precondition: the oracle really does write NEXT_TILE here.
  const probe = entry.clone();
  oracle(probe);
  assert.notEqual(probe.mem.read8(NEXT_TILE), 0, "precondition: the ahead lookup must write NEXT_TILE");

  const d = ramDiff(entry, twinCorruptAheadLookup);
  assert.notEqual(d, null, "the gate FAILED to catch a corrupted ahead lookup — it proves nothing");
  assert.equal(d.addr, NEXT_TILE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(NEXT_TILE)})`);
  assert.equal(ramDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/ahead: corrupted ahead lookup caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
