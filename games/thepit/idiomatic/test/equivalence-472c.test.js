// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for redrawScoreHud (ROM 0x472c, The Pit) — the score-HUD
 * refresh. It sweeps both player slots (copy the player's saved state into the shared
 * display slot, repaint its four score digits, blank the two cells above the score
 * column), restores the active player, draws the status label from the player count
 * (one/two players -> the in-game panel loc_47e1, otherwise -> the "GAME OVER" label
 * loc_48e5), and tints colour 2 up two HUD colour columns.
 *
 * WHY THE HONEST LIVE-OUT IS MEMORY-ONLY: all three callers (loc_0673, loc_3a6f,
 * loc_3cc1) reload their registers immediately after the call, so the register file
 * the routine leaves behind is dead. Its digit painter (0x46af) and its two label
 * routines (0x47e1 / 0x48e5) are already idiomatic; the state-copy callee (0x4644) is
 * still the frozen oracle, reached through the registry with its stack return slot, so
 * the stack, SP, exit pc and register file all still land identical too. The gate
 * therefore asserts whole RAM + pc + SP.
 *
 * Checks:
 *   1. EQUAL (captured) — the real attract dispatch is the game-over arm (player count
 *      0, "GAME OVER" label); idiomatic == oracle on whole RAM + pc + SP.
 *   2. EQUAL (harness) — the same real dispatch through the shared unitEquivalence gate
 *      (memory + pc EQUAL; the dead residual register file is not part of the contract).
 *   3. EQUAL (crafted) — a player-count-1 entry forces the in-game-panel arm (loc_47e1),
 *      which attract never reaches; idiomatic == oracle there too.
 *   4. IDENTITY — oracle vs oracle is EQUAL (gate wiring sanity).
 *   5. MODEL — a structural re-emit of the routine (correct params) is itself EQUAL, so
 *      the teeth below differ from the oracle by exactly one thing.
 *   6. TEETH — a wrong HUD colour and a wrong blank offset are both CAUGHT, and a
 *      corrupted output through the harness is CAUGHT.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-472c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_472c as oracle } from "../../translated/loc_472c.js";
import { redrawScoreHud as idiomatic } from "../redrawScoreHud.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x472c;
const GAME_MODE = 0x8001; // player count -> which status label is drawn
const GAME_STATE2 = 0x8002; // active player index (swept 1,2 then restored)
const ROW = 32; // one screen row across the 32-wide map
const FIRST_COLUMN_BOTTOM = 0x8ba1; // first tinted HUD colour column
const CAPTURE_FRAMES = 240; // 0x472c dispatches early in attract (its 0x48e5 arm ~frame 61)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** Capture the pristine machine state at 0x472c's genuine attract dispatch. */
function captureRealEntry() {
  let entry = null;
  let playerCount = null;
  const overrides = new Map([
    [TARGET, (mm) => {
      if (entry === null) {
        entry = mm.clone();
        playerCount = mm.mem.read8(GAME_MODE);
      }
      return oracle(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return { entry, playerCount };
}

const CAP = ROM_PRESENT ? captureRealEntry() : { entry: null, playerCount: null };
const ENTRY = CAP.entry;

/**
 * Run the oracle and a candidate on two independent clones of one entry and diff the
 * honest contract: whole RAM + exit pc + SP. (The residual register file is a dead
 * live-out here — every caller reloads it — so it is not compared.)
 */
function runPair(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    pc: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
    sp: (a.regs.sp & 0xffff) === (b.regs.sp & 0xffff) ? null : { a: a.regs.sp, b: b.regs.sp },
  };
}

/**
 * A structural re-emit of redrawScoreHud, parameterised by the two things the teeth
 * perturb: the HUD tint colour and how many rows above the score column the second
 * blank lands. It drives the oracle callees through the registry, so the correct
 * instance (colour 2, blank two rows above) must itself be EQUAL to the oracle — that
 * cross-check is what makes each twin's only divergence its own bug.
 */
function emitHud({ colour, blankRowsAbove }) {
  return function (m) {
    const { mem } = m;
    const activePlayer = mem.read8(GAME_STATE2);
    for (const [player, copyRet, drawRet] of [[1, 0x4738, 0x473b], [2, 0x474b, 0x474e]]) {
      mem.write8(GAME_STATE2, player);
      m.push16(copyRet); m.call(0x4644); // copy player state into the shared slot
      m.push16(drawRet); m.call(0x46af); // repaint the digits; base returned in ix
      const base = m.regs.ix;
      mem.write8(base - ROW, 0);
      mem.write8(base - blankRowsAbove * ROW, 0);
    }
    mem.write8(GAME_STATE2, activePlayer);
    m.push16(0x475d); m.call(0x4644);
    const players = mem.read8(GAME_MODE);
    if (players === 1 || players === 2) { m.push16(0x4768); m.call(0x47e1); }
    else { m.push16(0x476d); m.call(0x48e5); }
    let cell = 0x8ba1; for (let i = 0; i < 9; i++) { mem.write8(cell, colour); cell -= ROW; }
    cell = 0x8961; for (let i = 0; i < 10; i++) { mem.write8(cell, colour); cell -= ROW; }
    m.ret();
  };
}

const correctModel = emitHud({ colour: 2, blankRowsAbove: 2 });
const brokenColour = emitHud({ colour: 3, blankRowsAbove: 2 }); // BUG: HUD tint 3, not 2
const brokenBlank = emitHud({ colour: 2, blankRowsAbove: 3 }); // BUG: blanks the wrong cell

// -- 1. EQUAL: the real captured attract dispatch -----------------------------

test("EQUAL (captured): idiomatic == oracle on the real GAME OVER dispatch (RAM + pc + SP)", () => {
  assert.ok(ENTRY, "captured the real 0x472c attract dispatch");
  assert.equal(CAP.playerCount, 0, "the captured dispatch is the game-over (player count 0) arm");
  const r = runPair(ENTRY, idiomatic);
  assert.equal(r.ram, null, r.ram && `RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
  assert.equal(r.pc, null, r.pc && `exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
  assert.equal(r.sp, null, r.sp && `SP diverged (oracle=${hx(r.sp?.a)} idiomatic=${hx(r.sp?.b)})`);
  console.log("  EQUAL/captured: real 0x472c entry identical (whole RAM + pc + SP)");
});

// -- 2. EQUAL: through the shared unitEquivalence harness ----------------------
// The canonical gate captures the real dispatch, clones, runs both, and diffs memory +
// pc + registers. Memory + pc are the honest contract here; the residual register file
// is dead (every caller reloads it), so res.equal is not asserted — only memory + pc.

test("EQUAL (harness): the real 0x472c dispatch is memory + pc EQUAL through unitEquivalence", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, idiomatic, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.ram, null, `harness RAM diverged: ${JSON.stringify(res.ram)}`);
  assert.equal(res.pc, null, `harness exit pc diverged: ${JSON.stringify(res.pc)}`);
  console.log("  EQUAL/harness: unitEquivalence captured a real 0x472c entry -> memory + pc EQUAL");
});

// -- 3. EQUAL: crafted player-count-1 entry forces the in-game-panel arm -------

test("EQUAL (crafted): the in-game-panel arm (player count 1 -> loc_47e1) is EQUAL", () => {
  const seed = ENTRY.clone();
  seed.mem.write8(GAME_MODE, 1); // force the one/two-player branch attract never reaches
  const r = runPair(seed, idiomatic);
  assert.equal(r.ram, null, r.ram && `RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
  assert.equal(r.pc, null, r.pc && `exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
  assert.equal(r.sp, null, r.sp && `SP diverged (oracle=${hx(r.sp?.a)} idiomatic=${hx(r.sp?.b)})`);
  console.log("  EQUAL/crafted: player-count-1 (in-game panel) entry identical (whole RAM + pc + SP)");
});

// -- 4. IDENTITY: oracle vs oracle must be EQUAL (proves the gate wiring) ------

test("IDENTITY: oracle vs oracle reports EQUAL (gate wiring sanity)", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, true, `gate reported a diff for identical arms: ${JSON.stringify(res)}`);
  console.log("  IDENTITY: oracle vs oracle -> EQUAL");
});

// -- 5. MODEL: the correct structural re-emit is itself EQUAL -----------------

test("MODEL: the correct structural re-emit matches the oracle (so each twin isolates its bug)", () => {
  const r = runPair(ENTRY, correctModel);
  assert.equal(r.ram, null, r.ram && `model RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} model=${r.ram.b})`);
  assert.equal(r.pc, null, "model exit pc must match");
  assert.equal(r.sp, null, "model SP must match");
  console.log("  MODEL: correct re-emit identical to the oracle");
});

// -- 6. TEETH: broken twins the gate MUST catch -------------------------------

test("TEETH: a wrong HUD colour is CAUGHT (in a tinted colour cell)", () => {
  const r = runPair(ENTRY, brokenColour);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong HUD colour — it is worthless");
  // The first diff is the lowest-address tinted cell; assert the perturbation itself:
  // the oracle paints colour 2, the twin colour 3.
  assert.equal(r.ram.a, 2, `expected the oracle's tint colour 2 at ${hx(r.ram.addr ?? 0)}`);
  assert.equal(r.ram.b, 3, `expected the twin's wrong tint colour 3 at ${hx(r.ram.addr ?? 0)}`);
  assert.ok(r.ram.addr >= 0x8800, `expected a colour cell (>= 0x8800), got ${hx(r.ram.addr ?? 0)}`);
  console.log(`  TEETH/colour: wrong tint caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a wrong blank offset is CAUGHT (corrupts a written cell)", () => {
  const r = runPair(ENTRY, brokenBlank);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong blank offset — it is worthless");
  console.log(`  TEETH/blank: wrong blank caught at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

/** Broken twin for the harness: the correct routine, then one wrong store to a tinted cell. */
function brokenHarness(m) {
  idiomatic(m);
  m.mem.write8(FIRST_COLUMN_BOTTOM, m.mem.read8(FIRST_COLUMN_BOTTOM) ^ 0xff); // BUG: corrupt a tinted cell
}

test("TEETH (harness): a corrupted output is CAUGHT by unitEquivalence", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, brokenHarness, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, false, "unitEquivalence FAILED to catch the corrupted twin — it is worthless");
  assert.notEqual(res.ram, null, "the diff must include a RAM difference");
  assert.equal(res.ram.addr, FIRST_COLUMN_BOTTOM, `harness caught ${hx(res.ram?.addr ?? 0)} (expected ${hx(FIRST_COLUMN_BOTTOM)})`);
  console.log(`  TEETH/harness: corrupted tinted cell caught at ${hx(res.ram.addr)} (oracle=${res.ram.a} broken=${res.ram.b})`);
});
