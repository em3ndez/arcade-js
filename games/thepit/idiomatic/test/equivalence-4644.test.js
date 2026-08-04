// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loadPlayerState (ROM 0x4644) — copies the selected
 * player's saved five-field state block into the shared live slot the HUD and the
 * difficulty/scoring code read.
 *
 * The block is interleaved as triples [shared cell, player-1 copy, player-2 copy]
 * strided three apart from LEVEL. ACTIVE_PLAYER selects the player: 1 uses the
 * player-1 copies (one byte past each shared cell), anything else the player-2
 * copies (two bytes past). Its declared live-out is MEMORY-ONLY — the five
 * refreshed shared cells — so the gate compares RAM only; the oracle's residual
 * registers/flags are dead ABI (callers overwrite them before reading).
 *
 * WHY A CRAFTED ENTRY. Attract never inserts a coin, so a game never starts and the
 * round-setup / HUD-redraw callers that reach 0x4644 never run — the capture/replay
 * harness cannot hook it directly (verified: 0 dispatches over 1500 attract frames).
 * Per the crafted-entry method the gate instead runs the routine from a REAL captured
 * attract state (cloned at the first dispatch of the unrelated, reached leaf 0x3dae,
 * which gives a valid stack + register file), then pokes the routine's only inputs —
 * ACTIVE_PLAYER and the two players' source blocks — identically on both sides. The
 * player index is swept across 1 / 2 / 0 so both the player-1 and player-2 (and the
 * "not 1" edge) branches are exercised, with distinct source bytes so the branch
 * choice is observable in the shared cells.
 *
 * The routine only reads work RAM and writes the five shared cells; it pushes nothing
 * to the stack (it just returns), so there is no dead stack scratch to exclude — a
 * plain RAM diff is the whole contract. The oracle returns internally (advancing its
 * stack pointer, a register the gate ignores); the stack-free idiomatic routine does
 * not, and neither writes stack memory, so their RAM is identical.
 *
 * Checks:
 *   0. HARNESS — capture a real attract state and confirm the oracle run of 0x4644 is
 *      deterministic (oracle vs oracle -> identical RAM).
 *   1. EQUAL (real entry) — loadPlayerState == oracle over RAM on the captured state
 *      as-is (its natural ACTIVE_PLAYER).
 *   2. EQUAL (player sweep 1/2/0) — with ACTIVE_PLAYER forced to each and distinct
 *      player-1/player-2 source blocks, both copy the SAME selected block into the
 *      shared cells; positive checks confirm which block landed.
 *   3. TEETH (wrong player) — a twin that always reads the player-1 copies is CAUGHT
 *      at the shared cells when player 2 is selected (its block should have landed).
 *   4. TEETH (corrupted field) — a twin that copies correctly but flips one shared
 *      cell is CAUGHT at that cell.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4644.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4644 as oracle } from "../../translated/loc_4644.js";
import { loadPlayerState as idiomatic } from "../loadPlayerState.js";
import { loc_3dae as reachedLeaf } from "../../translated/loc_3dae.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { LEVEL, ACTIVE_PLAYER } from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const CAPTURE_AT = 0x3dae; // a reached attract leaf — gives a real, valid captured state
const SHARED_CELLS = [0, 3, 6, 9, 12].map((off) => LEVEL + off); // the five interleaved shared cells
const PLAYER1 = [0xaa, 0xbb, 0xcc, 0xdd, 0xee]; // distinct player-1 source block (LEVEL+1, stride 3)
const PLAYER2 = [0x11, 0x22, 0x33, 0x44, 0x55]; // distinct player-2 source block (LEVEL+2, stride 3)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook a reached attract leaf and clone the machine at its first dispatch — a real
 * state with a valid stack and register file. The wrapper snapshots, then runs the
 * leaf so attract proceeds undisturbed.
 */
function captureRealEntry(maxFrames) {
  let entry = null;
  const snapshot = new Map([[CAPTURE_AT, (mm) => {
    if (entry === null) entry = mm.clone();
    return reachedLeaf(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entry;
}

/** Poke the routine's inputs: the selected-player index and both players' source blocks. */
function seedInputs(m, playerIndex) {
  m.mem.write8(ACTIVE_PLAYER, playerIndex);
  for (let i = 0; i < 5; i++) {
    m.mem.write8(SHARED_CELLS[i] + 1, PLAYER1[i]); // player-1 copy, one byte past the shared cell
    m.mem.write8(SHARED_CELLS[i] + 2, PLAYER2[i]); // player-2 copy, two bytes past
  }
}

/** First differing RAM byte between oracle and candidate runs of one entry, or null. */
function ramDiff(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);
  return firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off));
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: a real attract entry is captured and the oracle run of 0x4644 is deterministic", () => {
  const entry = captureRealEntry(240);
  assert.ok(entry, "expected the reached leaf 0x3dae to be dispatched during attract");

  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  oracle(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(
    `  HARNESS: captured a real attract state (SP=${hx(entry.regs.sp)}, ` +
      `ACTIVE_PLAYER=${entry.mem.read8(ACTIVE_PLAYER)}); oracle run of 0x4644 deterministic`,
  );
});

// -- 1. EQUAL on the real captured entry as-is -------------------------------

test("EQUAL (real entry): loadPlayerState == oracle over RAM", () => {
  const entry = captureRealEntry(240);
  assert.ok(entry, "need a captured entry");

  const d = ramDiff(entry, idiomatic);
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)} (oracle=${d.a} cand=${d.b})`);
  console.log("  EQUAL/real: identical RAM on the captured state's natural ACTIVE_PLAYER");
});

// -- 2. EQUAL across a crafted sweep of the selected player -------------------

test("EQUAL (player sweep 1/2/0): the selected player's block lands, identical to the oracle", () => {
  const seed = captureRealEntry(240);
  assert.ok(seed, "need a captured entry to craft the sweep from");

  // index 1 selects player 1; anything else (2, and the 0 edge) selects player 2.
  for (const [playerIndex, expected] of [[1, PLAYER1], [2, PLAYER2], [0, PLAYER2]]) {
    const entry = seed.clone();
    seedInputs(entry, playerIndex);

    const d = ramDiff(entry, idiomatic);
    assert.equal(d, null, d && `index ${playerIndex}: RAM diff at ${hx(d.addr ?? 0)} (oracle=${d.a} cand=${d.b})`);

    // Positive check: the expected player's block really landed in the shared cells.
    const c = entry.clone();
    idiomatic(c);
    for (let i = 0; i < 5; i++) {
      assert.equal(
        c.mem.read8(SHARED_CELLS[i]),
        expected[i],
        `index ${playerIndex}: shared cell ${hx(SHARED_CELLS[i])} did not get the selected block`,
      );
    }
  }
  console.log("  EQUAL/sweep: player 1 -> player-1 block, players 2 and 0 -> player-2 block, identical to the oracle");
});

// -- 3. TEETH: a wrong-player twin is caught ---------------------------------

/** Broken twin: always reads the player-1 copies, ignoring the selected player. */
function twinAlwaysPlayer1(m) {
  const { mem8 } = m;
  for (let i = 0; i < 5; i++) mem8[SHARED_CELLS[i]] = mem8[SHARED_CELLS[i] + 1];
}

test("TEETH (wrong player): a twin that ignores the selection is CAUGHT when player 2 is selected", () => {
  const entry = captureRealEntry(240);
  assert.ok(entry, "need a captured entry to seed the teeth check");
  seedInputs(entry, 2); // player 2 selected -> player-2 block should land

  const d = ramDiff(entry, twinAlwaysPlayer1);
  assert.ok(d, "the gate FAILED to catch the wrong-player twin — it proves nothing");
  assert.equal(
    d.addr,
    SHARED_CELLS[0],
    `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(SHARED_CELLS[0])})`,
  );
  console.log(`  TEETH/player: wrong-player twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 4. TEETH: a corrupted-field twin is caught ------------------------------

/** Broken twin: copies the selected block correctly, then flips one shared cell. */
function twinCorruptField(m) {
  idiomatic(m);
  const { mem8 } = m;
  mem8[SHARED_CELLS[3]] = mem8[SHARED_CELLS[3]] ^ 0xff;
}

test("TEETH (corrupted field): a twin that flips one shared cell is CAUGHT at that cell", () => {
  const entry = captureRealEntry(240);
  assert.ok(entry, "need a captured entry to seed the teeth check");
  seedInputs(entry, 1);

  const d = ramDiff(entry, twinCorruptField);
  assert.ok(d, "the gate FAILED to catch the corrupted-field twin — it proves nothing");
  assert.equal(
    d.addr,
    SHARED_CELLS[3],
    `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(SHARED_CELLS[3])})`,
  );
  console.log(`  TEETH/field: corrupted-field twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
