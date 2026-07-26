// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_492a (ROM 0x492a) — the screen-column painter.
 *
 * loc_492a lays a fixed 32-tile column into video RAM from a ROM strip, then tail-
 * hands to the still-oracle loc_3e1d to colour that column. It WRITES memory (the
 * column) and its tail runs through the same loc_3e1d on both sides, so it is gated
 * by MEMORY-equivalence against the frozen oracle: RAM byte-identical, and SP + pc
 * landing at the same place (both go through loc_3e1d's return). It is NOT gated on
 * the full register file — the oracle's leftover ROM-strip pointer is dead (both
 * successors, loc_4785 and loc_47a1, reload it before reading), and the idiomatic
 * layer drops that dead residual; the whole-machine/pixel gate backstops it.
 *
 *   1. EQUAL (real dispatch) — boot the machine, hook 0x492a, and clone the machine
 *      at its single real dispatch (it fires once while the screen is drawn). Run the
 *      ORACLE on one clone and the idiomatic loc_492a on another, and prove RAM is
 *      byte-identical and SP/pc match. The routine is straight-line (one fixed-length
 *      loop, no branches), so that one entry covers the whole control path.
 *
 *   2. NON-VACUOUS — the same run proves EQUAL is not passing on a no-op: the oracle
 *      actually changes the 32 painted column cells versus the captured entry state.
 *
 *   3. TEETH — a twin that reimplements the loop but corrupts every stored tile by one
 *      bit MUST be caught, in the painted column, by the RAM diff. A gate a real store
 *      bug slips through is worthless.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-492a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_492a as oracle } from "../../translated/loc_492a.js";
import { loc_492a as idiomatic } from "../loc_492a.js";
import { makeMachineFactory } from "../../machine.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x492a;

// The 32 painted column cells: bottom at 0x93f9, one full text row (32 cells) up
// per tile, to the top cell 0x9019.
const COLUMN_BOTTOM = 0x93f9;
const COLUMN_TOP = 0x9019;
const ROW = 32;
const paintedCells = Array.from({ length: 32 }, (_, i) => COLUMN_BOTTOM - i * ROW);
const isPaintedCell = (a) => a >= COLUMN_TOP && a <= COLUMN_BOTTOM && (COLUMN_BOTTOM - a) % ROW === 0;

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
 * Boot the machine, hook 0x492a, and clone it at its first real dispatch. The
 * wrapper clones the entry state, then runs the oracle so the host boot proceeds
 * undisturbed to a clean stop.
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

test("EQUAL: idiomatic loc_492a == oracle on the real dispatch (RAM + SP + pc)", () => {
  const entry = captureEntry(120);
  assert.ok(entry, "expected a real 0x492a dispatch during boot");

  const { a, b, bad } = replay(entry, idiomatic);
  assert.equal(
    bad,
    null,
    bad && `game-visible RAM diff at ${hx(bad.addr)} (oracle=${bad.a} idiomatic=${bad.b})`,
  );
  // Tail hand-off through loc_3e1d: both sides pop the same caller return, so SP/pc
  // land identically (this is what makes the tail modelling faithful).
  assert.equal(b.regs.sp, a.regs.sp, "SP must match the oracle after the tail return");
  assert.equal(b.pc, a.pc, "pc must match the oracle after the tail return");

  // NON-VACUOUS: the oracle actually painted the column — at least one cell changed
  // from the captured entry state, so EQUAL is not passing on a no-op.
  const changed = paintedCells.some((addr) => a.mem.read8(addr) !== entry.mem.read8(addr));
  assert.ok(changed, "expected the painted column to differ from the entry state (non-vacuous)");

  console.log(
    `  EQUAL: 1 real dispatch — RAM byte-identical, SP/pc land at ${hx(a.pc)}; ` +
      `${paintedCells.filter((addr) => a.mem.read8(addr) !== entry.mem.read8(addr)).length}/32 cells painted`,
  );
});

// -- 3. TEETH -----------------------------------------------------------------

/** Broken twin: reimplements loc_492a faithfully but corrupts every stored tile by
 *  one bit — a plausible store-path bug the RAM diff MUST catch in the column. */
function brokenLoc492a(m) {
  const { mem, regs } = m;
  for (let i = 0; i < 32; i++) {
    mem.write8(COLUMN_BOTTOM - i * ROW, mem.read8(0x49c7 + i) ^ 1); // BUG: corrupts the tile code
  }
  regs.c = 2;
  regs.a = 25;
  return m.call(0x3e1d);
}

test("TEETH: a corrupted column store is CAUGHT in the painted column", () => {
  const entry = captureEntry(120);
  assert.ok(entry, "need a real dispatch to test the teeth against");

  const { bad } = replay(entry, brokenLoc492a);
  assert.notEqual(bad, null, "the gate FAILED to catch a corrupted column store — it is worthless");
  assert.ok(
    isPaintedCell(bad.addr),
    `expected the caught diff in the painted column, got ${hx(bad.addr)}`,
  );
  console.log(`  TEETH: corrupted store caught at ${hx(bad.addr)} (oracle=${bad.a} broken=${bad.b})`);
});
