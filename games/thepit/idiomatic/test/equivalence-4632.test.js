// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for saveActivePlayerRecord (ROM 0x4632) — the routine that
 * saves the live working game record into the current player's backup slot.
 *
 * The five game-progress fields (level, two round counters, two score bytes) each live
 * as three consecutive bytes [working, player-1 backup, player-2 backup]. The routine
 * copies the working byte of every field into the backup byte of the player named by
 * the index byte ACTIVE_PLAYER (1 -> column 1, anything else -> column 2). Its whole
 * effect is those five stores, so the declared live-out is MEMORY-ONLY — the diff is
 * over RAM (dumpState), excluding pc, SP and the dead value registers/flags the oracle
 * leaves behind. The routine pushes nothing to the stack (a plain copy + ret), so there
 * is no stack scratch to exclude — every RAM byte is compared straight up.
 *
 * WHY A CRAFTED ENTRY. Attract never dispatches 0x4632: its call sites (the round-init
 * priming and the level-advance path) sit behind branches the input-free demo doesn't
 * take. So the gate runs it from a REAL captured entry of its RESTORE sibling 0x4644,
 * which IS reached in attract and shares the exact call convention (both read ACTIVE_PLAYER
 * and operate on the 0x8028 block with a valid return stack). 0x4632 calls nothing, so
 * cloning that entry introduces no registry recursion. The one input that shapes the
 * output — the player-index byte — is then swept over 1 / 2 / 0 / 3 to cover both the
 * player-1 arm and the "everyone else -> column 2" arm.
 *
 * Six checks:
 *   0. HARNESS — capture a real 0x4644 entry and confirm the oracle run of 0x4632 is
 *      deterministic (oracle vs oracle -> identical RAM). Proves the plumbing reaches a
 *      real save/restore entry.
 *   1. EQUAL (real entry) — saveActivePlayerRecord == oracle over RAM from the captured
 *      state.
 *   2. EQUAL (crafted sweep 1/2/0/3) — with the working/backup bytes seeded to distinct
 *      sentinels and ACTIVE_PLAYER forced to each value, both leave identical RAM, and the
 *      selected backup column really holds the working values (the other column untouched).
 *   3. TEETH (wrong column) — a twin that writes the OTHER player's backup column is
 *      CAUGHT at the correct column's first byte (this routine's payload is which column
 *      it targets).
 *   4. TEETH (dropped field) — a twin that copies only four of the five fields is CAUGHT
 *      at the fifth field's backup byte (the payload is also how many fields it copies).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4632.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4632 as oracle } from "../../translated/loc_4632.js";
import { saveActivePlayerRecord as idiomatic } from "../saveActivePlayerRecord.js";
import { loc_4644 as siblingRestore } from "../../translated/loc_4644.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { LEVEL, ACTIVE_PLAYER } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const CAPTURE_AT = 0x4644; // the restore sibling — a real save/restore entry, reached in attract
const FIELDS = 5; // the five game-progress fields
const STRIDE = 3; // each field is [working, player-1 backup, player-2 backup]
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook the restore sibling 0x4644 in a real attract run and clone the machine at its
 * first dispatch — a genuine save/restore entry (valid stack with a return address, an
 * in-play player-index byte). The wrapper snapshots then runs the oracle so attract proceeds.
 */
function captureRealSiblingEntry(maxFrames) {
  let entry = null;
  const snapshot = new Map([[CAPTURE_AT, (mm) => {
    if (entry === null) entry = mm.clone();
    return siblingRestore(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entry;
}

/** First differing RAM byte between two machines over the whole state dump, or null. */
function ramDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * Seed the record block with distinct sentinels so the copy is observable: working
 * bytes 0x91.. , player-1 backups 0x40.. , player-2 backups 0x50.. (all disjoint), and
 * force ACTIVE_PLAYER to the given player index. Makes EQUAL non-trivial (the values
 * differ per column) and the teeth reliable.
 */
function craftDistinctEntry(seed, playerIndex) {
  const e = seed.clone();
  e.mem.write8(ACTIVE_PLAYER, playerIndex);
  for (let f = 0; f < FIELDS; f++) {
    const base = LEVEL + f * STRIDE;
    e.mem.write8(base, 0x91 + f); // working
    e.mem.write8(base + 1, 0x40 + f); // player-1 backup
    e.mem.write8(base + 2, 0x50 + f); // player-2 backup
  }
  return e;
}

/** The backup column the routine should target for a given player index. */
const columnFor = (playerIndex) => (playerIndex === 1 ? 1 : 2);

// -- teeth twins --------------------------------------------------------------

/** BUG: writes the OTHER player's backup column. */
function twinWrongColumn(m) {
  const { mem8 } = m;
  const wrong = mem8[ACTIVE_PLAYER] === 1 ? 2 : 1;
  for (let f = 0; f < FIELDS; f++) {
    const base = LEVEL + f * STRIDE;
    mem8[base + wrong] = mem8[base];
  }
}

/** BUG: copies only four of the five fields (the fifth backup is left stale). */
function twinDroppedField(m) {
  const { mem8 } = m;
  const col = columnFor(mem8[ACTIVE_PLAYER]);
  for (let f = 0; f < FIELDS - 1; f++) {
    const base = LEVEL + f * STRIDE;
    mem8[base + col] = mem8[base];
  }
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: a real 0x4644 entry is captured and the oracle run of 0x4632 is deterministic", () => {
  const entry = captureRealSiblingEntry(1500);
  assert.ok(entry, "expected the restore sibling 0x4644 to be dispatched during attract");

  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  oracle(b);
  const d = ramDiff(a, b);
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(
    `  HARNESS: captured a real 0x4644 entry (SP=${hx(entry.regs.sp)}, ` +
      `ACTIVE_PLAYER=${entry.mem.read8(ACTIVE_PLAYER)}); oracle run of 0x4632 deterministic`,
  );
});

// -- 1. EQUAL on the real captured entry -------------------------------------

test("EQUAL (real entry): saveActivePlayerRecord == oracle over RAM", () => {
  const entry = captureRealSiblingEntry(1500);
  assert.ok(entry, "need a captured 0x4644 entry");

  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  idiomatic(c);
  const d = ramDiff(o, c);
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);
  console.log("  EQUAL/real: identical RAM from the real captured save/restore entry");
});

// -- 2. EQUAL across a crafted sweep of the player index ---------------------

test("EQUAL (player-index sweep 1/2/0/3): both write the selected backup column, identical", () => {
  const seed = captureRealSiblingEntry(1500);
  assert.ok(seed, "need a captured 0x4644 entry to craft the sweep from");

  for (const playerIndex of [1, 2, 0, 3]) {
    const entry = craftDistinctEntry(seed, playerIndex);
    const col = columnFor(playerIndex);
    const other = col === 1 ? 2 : 1;

    const o = entry.clone();
    oracle(o);
    const c = entry.clone();
    idiomatic(c);
    const d = ramDiff(o, c);
    assert.equal(d, null, `playerIndex=${playerIndex}: RAM diff at ${d ? hx(d.addr ?? 0) : "(none)"}`);

    // Positive checks: the selected column holds the working values; the other is untouched.
    for (let f = 0; f < FIELDS; f++) {
      const base = LEVEL + f * STRIDE;
      assert.equal(
        c.mem.read8(base + col),
        0x91 + f,
        `playerIndex=${playerIndex}: field ${f} not saved into column ${col}`,
      );
      assert.equal(
        c.mem.read8(base + other),
        (other === 1 ? 0x40 : 0x50) + f,
        `playerIndex=${playerIndex}: field ${f} clobbered the untouched column ${other}`,
      );
    }
  }
  console.log("  EQUAL/sweep: player index 1 -> column 1, {2,0,3} -> column 2, identical to the oracle");
});

// -- 3. TEETH: a wrong-column twin is caught ---------------------------------

test("TEETH (wrong column): a twin that writes the other player's column is CAUGHT", () => {
  const seed = captureRealSiblingEntry(1500);
  assert.ok(seed, "need a captured 0x4644 entry to seed the teeth check");
  const entry = craftDistinctEntry(seed, 1); // player 1 -> correct column is 1

  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  twinWrongColumn(c);
  const d = ramDiff(o, c);
  assert.ok(d, "the gate FAILED to catch the wrong-column twin — it proves nothing");
  assert.equal(
    d.addr,
    LEVEL + 1, // field 0's player-1 backup byte
    `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(LEVEL + 1)})`,
  );
  console.log(`  TEETH/column: wrong-column twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 4. TEETH: a dropped-field twin is caught --------------------------------

test("TEETH (dropped field): a twin that copies only four fields is CAUGHT at the fifth", () => {
  const seed = captureRealSiblingEntry(1500);
  assert.ok(seed, "need a captured 0x4644 entry to seed the teeth check");
  const entry = craftDistinctEntry(seed, 1); // player 1 -> column 1

  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  twinDroppedField(c);
  const d = ramDiff(o, c);
  assert.ok(d, "the gate FAILED to catch the dropped-field twin — it proves nothing");
  assert.equal(
    d.addr,
    LEVEL + (FIELDS - 1) * STRIDE + 1, // the fifth field's player-1 backup byte (0x8035)
    `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(LEVEL + (FIELDS - 1) * STRIDE + 1)})`,
  );
  console.log(`  TEETH/field: dropped-field twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
