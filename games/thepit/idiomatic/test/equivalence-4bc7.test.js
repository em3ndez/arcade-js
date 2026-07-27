// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for initScoreDisplay (ROM 0x4bc7) — the numeric-readout bring-up.
 *
 * initScoreDisplay blanks the 32-cell readout display strip (0x8280) with the blank tile, seeds
 * the three source records at 0x8039 (each a fixed 3-tile label block plus a zero value),
 * and tail-hands to the still-oracle score-readout formatter at 0x4cca, which copies each
 * label block to its display cell and formats each value into digit cells. The idiomatic
 * rewrite returns the same tail call, so it is gated by MEMORY-equivalence against the
 * frozen oracle: RAM byte-identical, and SP + pc landing at the same place (both go through
 * the same 0x4cca body's return). It is NOT gated on the full register file — the oracle's
 * residual pointer/counter are dead (the formatter and callers reload what they need); the
 * whole-machine/pixel gate backstops that.
 *
 *   1. EQUAL (real dispatch) — boot the machine, hook 0x4bc7, and clone it at its single
 *      real dispatch (it fires once during the cold-boot init). Run the ORACLE on one clone
 *      and the idiomatic initScoreDisplay on another, and prove RAM is byte-identical and SP/pc
 *      match. Straight-line (blank the strip, seed the records, tail-hand to the formatter),
 *      so one entry covers the whole control path.
 *
 *   2. NON-VACUOUS — the same run proves EQUAL is not passing on a no-op: the setup actually
 *      changes memory versus the captured entry (the strip fill 0x8280 and the seeded record
 *      byte 0x8039 both change, and the formatter's rendered label cell 0x8283 changes too,
 *      proving the tail render ran).
 *
 *   3. TEETH (wrong blank tile) — a twin filling the strip with the wrong tile MUST be caught
 *      in the strip cells the formatter never overwrites (0x8280..0x8282).
 *
 *   4. TEETH (wrong record value) — a twin seeding a non-zero record value MUST be caught:
 *      it changes the seeded record byte and propagates through the formatter into the
 *      rendered digit cells. A gate a wrong-seed bug slips through is worthless.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4bc7.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4bc7 as oracle } from "../../translated/loc_4bc7.js";
import { initScoreDisplay as idiomatic } from "../initScoreDisplay.js";
import { makeMachineFactory } from "../../machine.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4bc7;
const STRIP_LO = 0x8280; // first cell of the 32-cell readout display strip
const RECORD_BASE = 0x8039; // first of the three seeded source records
const LABEL_CELL = 0x8283; // where the formatter copies record 1's label block
const BLANK_TILE = 36; // the strip's blank fill tile

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** First game-visible RAM difference between two machines (full state dump), or null. */
function ramDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Boot the machine, hook 0x4bc7, and clone it at its first real dispatch. The wrapper
 * clones the entry state, then runs the oracle so the host boot proceeds undisturbed.
 */
function captureEntry(maxFrames) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]);
  makeMachine(snap).runFrames(maxFrames);
  return entry;
}

/** Replay one entry state through the oracle and a candidate on independent fresh
 *  clones (the routine writes RAM), returning the diff + both post-run machines. */
function replay(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  candidate(b);
  return { a, b, bad: ramDiff(a, b) };
}

// -- 1 + 2. EQUAL (real dispatch) + NON-VACUOUS -------------------------------

test("EQUAL: idiomatic initScoreDisplay == oracle on the real dispatch (RAM + SP + pc)", () => {
  const entry = captureEntry(120);
  assert.ok(entry, "expected a real 0x4bc7 dispatch during boot");

  const { a, b, bad } = replay(entry, idiomatic);
  assert.equal(
    bad,
    null,
    bad && `game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b})`,
  );
  // Tail hand-off through the shared 0x4cca formatter: both sides pop the same caller
  // return, so SP/pc land identically (this is what makes the tail modelling faithful).
  assert.equal(b.regs.sp, a.regs.sp, "SP must match the oracle after the tail return");
  assert.equal(b.pc, a.pc, "pc must match the oracle after the tail return");

  // NON-VACUOUS: the setup actually rewrote memory — the strip fill, the seeded record
  // byte, and the formatter's rendered label cell all differ from the captured entry.
  assert.notEqual(
    a.mem.read8(STRIP_LO),
    entry.mem.read8(STRIP_LO),
    "expected the strip fill to change from the entry state (non-vacuous)",
  );
  assert.equal(a.mem.read8(STRIP_LO), BLANK_TILE, "strip should be filled with the blank tile");
  assert.notEqual(
    a.mem.read8(RECORD_BASE),
    entry.mem.read8(RECORD_BASE),
    "expected the seeded record byte to change from the entry state (non-vacuous)",
  );
  assert.notEqual(
    a.mem.read8(LABEL_CELL),
    entry.mem.read8(LABEL_CELL),
    "expected the formatter's rendered label cell to change (proves the tail render ran)",
  );

  console.log(
    `  EQUAL: 1 real dispatch — RAM byte-identical, SP/pc land at ${hx(a.pc)}; ` +
      `strip[${hx(STRIP_LO)}] ${entry.mem.read8(STRIP_LO)} -> ${a.mem.read8(STRIP_LO)}, ` +
      `record[${hx(RECORD_BASE)}] ${entry.mem.read8(RECORD_BASE)} -> ${a.mem.read8(RECORD_BASE)}, ` +
      `label[${hx(LABEL_CELL)}] ${entry.mem.read8(LABEL_CELL)} -> ${a.mem.read8(LABEL_CELL)}`,
  );
});

// -- 3. TEETH (wrong blank tile) ----------------------------------------------

/** Broken twin: fills the strip with the WRONG tile (0 instead of the blank tile) before
 *  the identical record seed + render — caught in the strip cells the formatter leaves
 *  untouched (0x8280..0x8282). */
function brokenBlankTile(m) {
  const { mem } = m;
  for (let i = 0; i < 32; i++) mem.write8(STRIP_LO + i, 0); // BUG: wrong blank fill tile
  const RECORD = [16, 10, 22, 0, 0];
  for (let r = 0; r < 3; r++) for (let i = 0; i < RECORD.length; i++) mem.write8(RECORD_BASE + r * RECORD.length + i, RECORD[i]);
  return m.call(0x4cca);
}

test("TEETH (wrong blank tile): a wrong strip fill is CAUGHT (in the un-rendered strip cells)", () => {
  const entry = captureEntry(120);
  assert.ok(entry, "need a real dispatch to test the teeth against");

  const { bad } = replay(entry, brokenBlankTile);
  assert.notEqual(bad, null, "the gate FAILED to catch a wrong strip fill — it is worthless");
  assert.ok(
    bad.addr >= STRIP_LO && bad.addr < STRIP_LO + 32,
    `expected the caught diff in the readout strip, got ${hx(bad.addr)}`,
  );
  console.log(`  TEETH/tile: wrong strip fill caught at ${hx(bad.addr)} (oracle=${bad.a} broken=${bad.b})`);
});

// -- 4. TEETH (wrong record value) --------------------------------------------

/** Broken twin: seeds a NON-ZERO record value, otherwise identical — caught at the seeded
 *  record value byte and in the digit cells the formatter renders it into. */
function brokenRecordValue(m) {
  const { mem } = m;
  for (let i = 0; i < 32; i++) mem.write8(STRIP_LO + i, BLANK_TILE);
  const RECORD = [16, 10, 22, 0x99, 0]; // BUG: non-zero value byte -> different rendered digits
  for (let r = 0; r < 3; r++) for (let i = 0; i < RECORD.length; i++) mem.write8(RECORD_BASE + r * RECORD.length + i, RECORD[i]);
  return m.call(0x4cca);
}

test("TEETH (wrong record value): a non-zero seeded value is CAUGHT", () => {
  const entry = captureEntry(120);
  assert.ok(entry, "need a real dispatch to test the teeth against");

  const { bad } = replay(entry, brokenRecordValue);
  assert.notEqual(bad, null, "the gate FAILED to catch a wrong seeded record value — it is worthless");
  console.log(`  TEETH/value: wrong seeded record value caught at ${hx(bad.addr)} (oracle=${bad.a} broken=${bad.b})`);
});
