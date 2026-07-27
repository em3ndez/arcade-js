// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_2934 (ROM 0x2934, The Pit) — commit one dig entity
 * into its tilemap cell: promote the staged placement values into the live dig-object
 * record, stamp the entity's sprite id + fill tile into the tilemap, and patch the
 * captured neighbour tile (a seam neighbour defers to the entity's sub-type, a
 * dig-channel tile is remapped through a ROM table, anything else is kept).
 *
 * loc_2934 is entered only once the dig-object spawn counter has rolled down to a fresh
 * commit — reached from the placement classifier and from the per-frame carve handler's
 * pending-entity tail-jump. The attract demo never digs deep enough to get there, so a
 * boot/attract run never dispatches it and the capture/replay harness cannot hook it.
 * This is the CRAFTED-ENTRY path: it reads all its inputs from RAM (the saved cell
 * pointer, the staging scratch block, the sub-type, and the two neighbour tiles), so a
 * real captured attract state with those inputs poked identically on both sides is a
 * faithful entry, and the input domain that shapes the output is small enough to sweep.
 *
 * The routine has no calls and no stack pushes — its only stack touch is the final
 * return, which merely reads the stack — so both arms leave identical RAM and the gate
 * compares the FULL state dump (work + colour + video + sprite RAM), its declared
 * memory-only live-out, excluding only the dead value-registers/flags/pc the idiomatic
 * layer does not preserve.
 *
 * Checks:
 *   1. EQUAL (real captured states) — over several real attract states, craft the cell
 *      pointer + staging block + neighbours and confirm oracle vs idiomatic leave
 *      identical state; plus positive checks that every staged value landed where the
 *      carve handler reads it and the entity was stamped in.
 *   2. EQUAL (neighbour sweep 0..255) — for every possible captured-neighbour code the
 *      classifier can see, oracle vs idiomatic agree (seam / dig-channel band / kept).
 *   3. EQUAL (sub-type + deep-neighbour sweep) — the seam path across every sub-type arm
 *      (0 keep, 2 timer+fill, else remap) and deep-neighbour tiles spanning the ROM-table
 *      index wrap, all identical.
 *   4. NON-VACUOUS — pre-set the record targets to a sentinel; both arms overwrite them
 *      all and still agree, so a no-op/partial twin cannot pass.
 *   5. TEETH — deliberately-broken twins (wrong state code, wrong fill tile, dropped
 *      dig-channel remap, wrong sub-type-2 timer) are each CAUGHT at the exact address.
 *
 * The oracle is run on a clone() (frame machinery neutralised) so its internal cycle
 * steps cannot trip a live NMI whose handler would write RAM and masquerade as an effect.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-2934.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2934 as oracle } from "../../translated/loc_2934.js";
import { loc_2934 as idiomatic } from "../loc_2934.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  DIG_OBJ_STATE,
  DIG_OBJ_ATTR,
  DIG_OBJ_TIMER,
  DIG_OBJ_SUBTYPE,
  TARGET_X,
  TARGET_Y,
} from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

// Unnamed staging / pointer scratch this routine reads or mirrors (kept hex in ram.js).
const SAVED_CELL_PTR = 0x80ba; // 16-bit saved tilemap cell pointer for the entity
const CARVE_CURSOR = 0x80af; // 16-bit live carve cursor (loc_2934 sets it = SAVED_CELL_PTR)
const STAGED_COLUMN = 0x80b6; // staged target column -> TARGET_X + its mirror
const STAGED_ROW = 0x80b9; // staged target row -> TARGET_Y
const STAGED_TIMER = 0x80bc; // staged initial dig timer -> DIG_OBJ_TIMER
const STAGED_SPRITE = 0x80bf; // staged sprite id stamped at cellPtr-1
const COLUMN_MIRROR = 0x80be; // second copy of the target column
const TILE_REMAP_TABLE = 0x2dc3; // ROM: dig-channel tile -> patched seam tile

// A cell pointer safely inside video RAM (0x9000-0x93ff) so cellPtr-2..cellPtr all land
// in diffed tilemap RAM.
const CELL_PTR = 0x9210;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// Distinct staged sentinels (none equal a constant the routine writes: 48/7/112/16).
const COL = 51;
const ROW = 68;
const TIMER = 34;
const SPRITE = 136;

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async,
// so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** Real attract machine states, cloned at a spread of frames (frame machinery neutralised). */
function captureStates(frames) {
  const m = makeMachine();
  const caps = [];
  let at = 0;
  for (const f of frames) {
    m.runFrames(f - at);
    at = f;
    caps.push(m.clone());
  }
  return caps;
}

/**
 * A crafted entry: a real captured state with the routine's inputs poked in (identically
 * used to seed both arms). n1 is the tile before the cursor, n2 the tile two cells back.
 */
function craft(base, { subtype = 1, n1 = 100, n2 = 151 } = {}) {
  const e = base.clone();
  e.mem.write16(SAVED_CELL_PTR, CELL_PTR);
  e.mem.write8(STAGED_COLUMN, COL);
  e.mem.write8(STAGED_ROW, ROW);
  e.mem.write8(STAGED_TIMER, TIMER);
  e.mem.write8(STAGED_SPRITE, SPRITE);
  e.mem.write8(DIG_OBJ_SUBTYPE, subtype);
  e.mem.write8(CELL_PTR - 1, n1);
  e.mem.write8(CELL_PTR - 2, n2);
  return e;
}

/** Run the oracle and a candidate on independent clones of `entry`; first differing
 *  state byte over the full dump, or null when identical. */
function stateDiff(entry, fn) {
  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// -- 1. EQUAL over real captured attract states, with positive checks ----------

test("EQUAL: loc_2934 leaves the same state as the oracle over real captured states", () => {
  const bases = captureStates([120, 200, 320, 480, 640]);
  assert.ok(bases.length >= 1, "expected at least one captured attract state");

  for (const base of bases) {
    // A representative spec on each real state (dig-channel neighbour -> table remap).
    const entry = craft(base, { subtype: 1, n1: 151, n2: 160 });
    const d = stateDiff(entry, idiomatic);
    assert.equal(d, null, d && `state diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  }

  // Positive checks: the record was armed, staged values promoted, entity stamped in.
  const b = craft(bases[0], { subtype: 1, n1: 151, n2: 160 });
  idiomatic(b);
  assert.equal(b.mem.read8(DIG_OBJ_STATE), 48, "carving-phase state code");
  assert.equal(b.mem.read8(DIG_OBJ_ATTR), 7, "attribute byte");
  assert.equal(b.mem.read16(CARVE_CURSOR), CELL_PTR, "carve cursor reloaded from the saved pointer");
  assert.equal(b.mem.read8(TARGET_X), COL, "target column promoted");
  assert.equal(b.mem.read8(COLUMN_MIRROR), COL, "target column mirrored");
  assert.equal(b.mem.read8(TARGET_Y), ROW, "target row promoted");
  assert.equal(b.mem.read8(CELL_PTR), 112, "fill tile stamped in the cursor cell");
  // n1=151 is a dig-channel tile, so cellPtr-1 is the remap-table value, not the sprite id.
  assert.equal(b.mem.read8(CELL_PTR - 1), b.mem.read8(TILE_REMAP_TABLE + (151 - 150)), "dig-channel neighbour remapped");
  console.log(`  EQUAL: ${bases.length} real captured states identical to the oracle; record armed + entity stamped`);
});

// -- 2. EQUAL over every captured-neighbour code 0..255 ------------------------

test("EQUAL (neighbour sweep 0..255): every neighbour classification matches the oracle", () => {
  const [base] = captureStates([260]);
  for (let n1 = 0; n1 < 256; n1++) {
    const d = stateDiff(craft(base, { subtype: 1, n1, n2: 151 }), idiomatic);
    assert.equal(d, null, d && `n1=${n1}: state diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
  }
  console.log("  EQUAL/neighbour: all 256 neighbour codes classified identically (seam / dig-channel / kept)");
});

// -- 3. EQUAL over the sub-type + deep-neighbour arms --------------------------

test("EQUAL (sub-type sweep): the seam path across every sub-type and deep-neighbour tile matches", () => {
  const [base] = captureStates([300]);
  const seams = [193, 149, 197]; // the three neighbour codes that route to the sub-type dispatch
  const subtypes = [0, 1, 2, 3, 4];
  const deep = [0, 16, 149, 150, 151, 153, 154, 200, 255]; // spans the table-index wrap (<150)

  let n = 0;
  for (const n1 of seams) {
    for (const subtype of subtypes) {
      for (const n2 of deep) {
        const d = stateDiff(craft(base, { subtype, n1, n2 }), idiomatic);
        assert.equal(d, null, d && `n1=${n1} subtype=${subtype} n2=${n2}: diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
        n++;
      }
    }
  }
  console.log(`  EQUAL/sub-type: ${n} seam×sub-type×deep-neighbour combos identical (incl. the table-index wrap)`);
});

// -- 4. NON-VACUOUS: the record targets are really overwritten ----------------

test("NON-VACUOUS: with the record targets pre-set to a sentinel, both arms overwrite them and agree", () => {
  const [base] = captureStates([360]);
  const SENTINEL = 85; // never a value the routine writes here
  const entry = craft(base, { subtype: 1, n1: 100, n2: 151 }); // n1<150 -> keep sprite id at cellPtr-1
  const targets = [DIG_OBJ_STATE, DIG_OBJ_ATTR, TARGET_X, COLUMN_MIRROR, TARGET_Y, DIG_OBJ_TIMER, CELL_PTR, CELL_PTR - 1];
  for (const addr of targets) entry.mem.write8(addr, SENTINEL);

  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  idiomatic(b);

  for (const addr of targets) {
    assert.notEqual(b.mem.read8(addr), SENTINEL, `idiomatic left ${hx(addr)} unwritten (still the sentinel)`);
  }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `state diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log(`  NON-VACUOUS: all ${targets.length} record targets overwritten from the sentinel; arms agree`);
});

// -- 5. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin: everything, then the wrong carving-state code. */
function twinWrongState(m) {
  idiomatic(m);
  m.mem.write8(DIG_OBJ_STATE, 47); // BUG: should be the carving-phase code 48
}
/** Broken twin: everything, then the wrong fill tile in the cursor cell. */
function twinWrongFill(m) {
  idiomatic(m);
  m.mem.write8(CELL_PTR, 113); // BUG: fill tile should be 112
}
/** Broken twin: does the record + stamp but drops the dig-channel neighbour remap. */
function twinNoRemap(m) {
  const { mem8 } = m;
  mem8[DIG_OBJ_STATE] = 48;
  mem8[DIG_OBJ_ATTR] = 7;
  const cellPtr = m.mem.read16(SAVED_CELL_PTR);
  m.mem.write16(CARVE_CURSOR, cellPtr);
  const col = mem8[STAGED_COLUMN];
  mem8[TARGET_X] = col;
  mem8[COLUMN_MIRROR] = col;
  mem8[TARGET_Y] = mem8[STAGED_ROW];
  mem8[DIG_OBJ_TIMER] = mem8[STAGED_TIMER];
  mem8[cellPtr - 1] = mem8[STAGED_SPRITE]; // BUG: leaves the sprite id; never remaps the dig-channel tile
  mem8[cellPtr] = 112;
}
/** Broken twin: sub-type-2 seam path, but the wrong re-armed dig timer. */
function twinWrongSubtypeTimer(m) {
  idiomatic(m);
  m.mem.write8(DIG_OBJ_TIMER, 15); // BUG: sub-type 2 arms the timer to 16
}

test("TEETH (wrong state code): a wrong carving-state code is CAUGHT at the record state byte", () => {
  const [base] = captureStates([400]);
  const entry = craft(base, { subtype: 1, n1: 151, n2: 160 });
  const d = stateDiff(entry, twinWrongState);
  assert.notEqual(d, null, "the gate FAILED to catch a wrong state code — it proves nothing");
  assert.equal(d.addr, DIG_OBJ_STATE, `teeth caught ${hx(d.addr ?? 0)} (expected ${hx(DIG_OBJ_STATE)})`);
  assert.equal(stateDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/state: wrong state code caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

test("TEETH (wrong fill tile): a wrong tile in the cursor cell is CAUGHT", () => {
  const [base] = captureStates([420]);
  const entry = craft(base, { subtype: 1, n1: 151, n2: 160 });
  const d = stateDiff(entry, twinWrongFill);
  assert.notEqual(d, null, "the gate FAILED to catch a wrong fill tile — it proves nothing");
  assert.equal(d.addr, CELL_PTR, `teeth caught ${hx(d.addr ?? 0)} (expected the cursor cell ${hx(CELL_PTR)})`);
  console.log(`  TEETH/fill: wrong fill tile caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

test("TEETH (dropped remap): leaving a dig-channel neighbour unmapped is CAUGHT at cellPtr-1", () => {
  const [base] = captureStates([440]);
  const entry = craft(base, { subtype: 1, n1: 151, n2: 160 }); // 151 is a dig-channel tile -> must remap
  const d = stateDiff(entry, twinNoRemap);
  assert.notEqual(d, null, "the gate FAILED to catch a dropped remap — it proves nothing");
  assert.equal(d.addr, CELL_PTR - 1, `teeth caught ${hx(d.addr ?? 0)} (expected ${hx(CELL_PTR - 1)})`);
  console.log(`  TEETH/remap: dropped dig-channel remap caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

test("TEETH (wrong sub-type-2 timer): a wrong re-armed dig timer is CAUGHT", () => {
  const [base] = captureStates([460]);
  const entry = craft(base, { subtype: 2, n1: 193, n2: 160 }); // seam + sub-type 2 -> timer=16
  const d = stateDiff(entry, twinWrongSubtypeTimer);
  assert.notEqual(d, null, "the gate FAILED to catch a wrong sub-type-2 timer — it proves nothing");
  assert.equal(d.addr, DIG_OBJ_TIMER, `teeth caught ${hx(d.addr ?? 0)} (expected ${hx(DIG_OBJ_TIMER)})`);
  console.log(`  TEETH/timer: wrong sub-type-2 timer caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
