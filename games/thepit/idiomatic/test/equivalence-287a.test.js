// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_287a (ROM 0x287a, The Pit) — seed the dig/target
 * object control block at round start, copy a fixed column-position table from ROM,
 * then tail-jump into the round/level parameter-seeding chain (loc_2f2f → loc_30de →
 * seedActorSpawnState).
 *
 * loc_287a is entered ONLY at gameplay round init, at the head of that tail-jump
 * chain; attract mode never enters gameplay, so it is never dispatched in a
 * boot/attract run — the unit harness (which needs a real dispatch) cannot capture
 * it. But its own body reads NOTHING from the entry state: it writes fixed immediates
 * and copies a fixed ROM table. The only variable input in the whole chain is the
 * level/difficulty counter the tail reads, so any realistic machine state is a valid
 * entry. This is the CRAFTED-ENTRY path: capture real attract states and run oracle
 * vs idiomatic on independent clones of each.
 *
 * The oracle tail-jumps `m.call(0x2f2f)`, which resolves to the frozen translated
 * loc_2f2f (which in turn resolves the rest of the chain); the idiomatic routine hands
 * off to the already-decompiled loc_2f2f directly. That pair — and the rest of the
 * chain — is proven memory-equivalent by equivalence-2f2f / equivalence-30de, so the
 * whole chain lands the same work RAM. The entire chain is pure tail-jumps with a
 * single trailing return (no stack pushes), so the Z80 stack is untouched and the gate
 * compares FULL work RAM, the routine's declared live-out, not the register file.
 *
 * FIVE checks:
 *   1. EQUAL (real captured entries) — clone the running attract machine at several
 *      frames (real title/demo RAM), run the oracle and loc_287a on independent clones
 *      of each, and diff work RAM. Must be identical.
 *   2. TAIL FIRED — after the idiomatic run the control block holds its seeded values,
 *      the copied table matches its ROM source, AND the full tail's effects are present
 *      (the derived reload byte, the actor pair seeded, the spawn-phase flag cleared),
 *      proving the hand-off ran through the imported chain.
 *   3. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) — pre-set loc_287a's own targets
 *      to a sentinel identically on both sides, so a no-op or partial twin cannot pass
 *      by the entry already holding the seeded values: every target must be
 *      overwritten, and both arms must still agree byte-for-byte.
 *   4. TABLE COPY — the 24 destination bytes equal the 24 ROM source bytes exactly.
 *   5. TEETH — three deliberately-broken twins MUST be caught: a wrong control byte, a
 *      dropped table copy, and a dropped tail hand-off.
 *
 * The oracle is run on a clone() (frame machinery neutralised) so its internal cycle
 * steps cannot trip a live NMI whose handler would write RAM and masquerade as a side
 * effect.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-287a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_287a as oracle } from "../../translated/loc_287a.js";
import { loc_287a as idiomatic } from "../loc_287a.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  DIG_OBJ_STATE,
  TARGET_X,
  TARGET_Y,
  SPAWN_STATE,
  SPAWN_PHASE,
  ACTOR_X,
  TWIN_X,
} from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x287a;
const TABLE_SRC = 0x2dab; // ROM parameter table
const TABLE_DST = 0x80c3; // work-RAM copy destination
const TABLE_LEN = 24;
const RELOAD = 0x80e4; // the tail's derived animation reload byte
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// loc_287a's OWN fixed-value writes (address -> value). Every one is a constant, so
// the sentinel/non-vacuous check can assert both overwrite and value.
const FIXED = [
  [DIG_OBJ_STATE, 48], // 0x80aa — carving-phase state code
  [0x80ab, 7],
  [TARGET_X, 0], // 0x80a9
  [TARGET_Y, 0], // 0x80ac
  [0x80b1, 0],
  [SPAWN_STATE, 0], // 0x80bd
  [0x80c1, 0],
  [0x80c0, 0],
  [0x80c2, 32],
];

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real attract machine states: run the game and clone it at a spread of frames. Each
 * clone is a genuine in-play machine (real title/demo RAM), independent of the source
 * run, with its frame machinery neutralised (safe to run the oracle on).
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

// -- 1. EQUAL over real captured attract states -------------------------------

test("EQUAL: loc_287a leaves the same work RAM as the oracle over real captured states", () => {
  const caps = captureStates(8, 120, 90);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // idiomatic
    oracle(a);
    idiomatic(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`,
    );
  }
  console.log(`  EQUAL: ${caps.length} real captured attract states — work RAM identical to the oracle`);
});

// -- 2. TAIL FIRED: the control block, table copy, and full tail all ran -------

test("TAIL FIRED: the control block is seeded, the table is copied, and the full tail's effects are present", () => {
  const [entry] = captureStates(1, 1, 175);

  const b = entry.clone();
  idiomatic(b);

  // loc_287a's own control block.
  for (const [addr, val] of FIXED) {
    assert.equal(b.mem.read8(addr), val, `control byte ${hx(addr)} not seeded`);
  }
  // The copied column-position table.
  for (let i = 0; i < TABLE_LEN; i++) {
    assert.equal(
      b.mem.read8(TABLE_DST + i),
      b.mem.read8(TABLE_SRC + i),
      `table byte ${i} not copied`,
    );
  }
  // The tail's effects: the round-parameter chain and the actor-seed tail ran.
  assert.ok(b.mem.read8(RELOAD) >= 3 && b.mem.read8(RELOAD) <= 6, "the tail's derived reload byte must be present");
  assert.equal(b.mem.read8(ACTOR_X), 36, "the chain's tail must seed the primary start column");
  assert.equal(b.mem.read8(TWIN_X), 52, "the chain's tail must seed the twin start column");
  assert.equal(b.mem.read8(SPAWN_PHASE), 0, "the chain's tail must clear the spawn-phase flag");
  console.log("  TAIL FIRED: control block seeded, 24-byte table copied, full seed chain ran");
});

// -- 3. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) -------------------------
// Sentinel 85 is never a value the routine writes (control values {48,7,0,32} nor any
// table byte {80,88,...,168}), so a target still holding it means it was never written.

test("NON-VACUOUS: with loc_287a's own targets pre-set to a sentinel, both arms overwrite them and agree", () => {
  const [entry] = captureStates(1, 1, 200);
  const SENTINEL = 85;
  for (const [addr] of FIXED) entry.mem.write8(addr, SENTINEL);
  for (let i = 0; i < TABLE_LEN; i++) entry.mem.write8(TABLE_DST + i, SENTINEL);

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  idiomatic(b);

  for (const [addr] of FIXED) {
    assert.notEqual(b.mem.read8(addr), SENTINEL, `idiomatic left ${hx(addr)} unwritten (still the sentinel)`);
  }
  for (let i = 0; i < TABLE_LEN; i++) {
    assert.notEqual(b.mem.read8(TABLE_DST + i), SENTINEL, `idiomatic left table byte ${i} unwritten`);
  }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log(`  NON-VACUOUS: all ${FIXED.length} control bytes + ${TABLE_LEN} table bytes overwritten, arms agree`);
});

// -- 4. TABLE COPY: the destination equals the ROM source ---------------------

test("TABLE COPY: the 24 destination bytes match the ROM source table exactly", () => {
  const [entry] = captureStates(1, 1, 210);
  const b = entry.clone();
  idiomatic(b);
  for (let i = 0; i < TABLE_LEN; i++) {
    assert.equal(
      b.mem.read8(TABLE_DST + i),
      b.mem.read8(TABLE_SRC + i),
      `table byte ${i}: dst ${hx(TABLE_DST + i)} != src ${hx(TABLE_SRC + i)}`,
    );
  }
  console.log(`  TABLE COPY: ${TABLE_LEN} bytes at ${hx(TABLE_DST)} match ROM ${hx(TABLE_SRC)}`);
});

// -- 5. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin A: seeds everything, but one control byte is wrong. */
function brokenControlByte(m) {
  idiomatic(m);
  m.mem.write8(DIG_OBJ_STATE, m.mem.read8(DIG_OBJ_STATE) + 1); // BUG: wrong dig-object state
}

/** Broken twin B: does everything except copy the ROM table. */
function brokenNoTable(m) {
  const { mem } = m;
  mem.write8(DIG_OBJ_STATE, 48);
  mem.write8(0x80ab, 7);
  mem.write8(TARGET_X, 0);
  mem.write8(TARGET_Y, 0);
  mem.write8(0x80b1, 0);
  mem.write8(SPAWN_STATE, 0);
  mem.write8(0x80c1, 0);
  mem.write8(0x80c0, 0);
  // BUG: the 24-byte table copy is dropped.
  mem.write8(0x80c2, 32);
  loc_2f2fTail(m);
}

/** Broken twin C: does loc_287a's own writes but drops the tail hand-off. */
function brokenNoTail(m) {
  const { mem } = m;
  mem.write8(DIG_OBJ_STATE, 48);
  mem.write8(0x80ab, 7);
  mem.write8(TARGET_X, 0);
  mem.write8(TARGET_Y, 0);
  mem.write8(0x80b1, 0);
  mem.write8(SPAWN_STATE, 0);
  mem.write8(0x80c1, 0);
  mem.write8(0x80c0, 0);
  for (let i = 0; i < TABLE_LEN; i++) mem.write8(TABLE_DST + i, mem.read8(TABLE_SRC + i));
  mem.write8(0x80c2, 32);
  // BUG: no hand-off — the level-parameter block and actor pair are never seeded.
}

// The tail the "no table" twin still runs, via the frozen oracle chain, so its only
// difference from the real routine is the missing copy.
function loc_2f2fTail(m) {
  m.step?.(0x2f2f, 10);
  return m.call(0x2f2f);
}

test("TEETH (wrong control byte): a wrong dig-object state is CAUGHT", () => {
  const caps = captureStates(4, 120, 150);
  let caught = null;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // broken twin
    oracle(a);
    brokenControlByte(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    if (d) {
      caught = d;
      break;
    }
  }
  assert.notEqual(caught, null, "the gate FAILED to catch a wrong control byte — it proves nothing");
  assert.equal(caught.addr, DIG_OBJ_STATE, `teeth caught the wrong address ${hx(caught.addr ?? 0)}`);
  console.log(`  TEETH: wrong control byte caught at ${hx(caught.addr)} (oracle=${caught.a} broken=${caught.b})`);
});

test("TEETH (dropped table copy): skipping the ROM table copy is CAUGHT", () => {
  const [entry] = captureStates(1, 1, 230);
  // Pre-set the table destination to a sentinel so a missing copy is deterministic and
  // cannot happen to already hold the ROM values.
  const SENTINEL = 85;
  for (let i = 0; i < TABLE_LEN; i++) entry.mem.write8(TABLE_DST + i, SENTINEL);

  const a = entry.clone(); // oracle (copies the table)
  const b = entry.clone(); // broken twin (no copy)
  oracle(a);
  brokenNoTable(b);

  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.notEqual(d, null, "the gate FAILED to catch a dropped table copy — it proves nothing");
  assert.equal(d.addr, TABLE_DST, `teeth caught ${hx(d.addr ?? 0)} (expected the table start ${hx(TABLE_DST)})`);
  console.log(`  TEETH: dropped table copy caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

test("TEETH (dropped hand-off): dropping the loc_2f2f tail is CAUGHT", () => {
  const [entry] = captureStates(1, 1, 220);
  // Pre-set the tail's lowest write so a missing hand-off is deterministic.
  const SENTINEL = 85;
  entry.mem.write8(SPAWN_PHASE, SENTINEL);

  const a = entry.clone(); // oracle (runs the tail)
  const b = entry.clone(); // broken twin (no tail)
  oracle(a);
  brokenNoTail(b);

  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.notEqual(d, null, "the gate FAILED to catch a dropped hand-off — it proves nothing");
  assert.equal(b.mem.read8(SPAWN_PHASE), SENTINEL, "the broken twin never cleared the spawn-phase flag");
  console.log(`  TEETH: dropped hand-off caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
