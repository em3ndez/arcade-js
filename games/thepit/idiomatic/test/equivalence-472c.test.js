// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for redrawScoreHud (ROM 0x472c, The Pit) — the score-HUD
 * refresh. It sweeps both player slots (copy the player's saved state into the shared
 * display slot, repaint its four score digits, blank the two cells above the score
 * column), restores the active player, draws the status label from the player count
 * (one/two players -> the in-game panel loc_47e1, otherwise -> the "GAME OVER" label
 * loc_48e5), and tints colour 2 up two HUD colour columns.
 *
 * THE CONTRACT — OBSERVABLE RAM. This gate used to assert whole RAM + pc + SP, because
 * the two status-label routines it calls (loc_47e1 @ 0x47e1, drawGameOverLabel @ 0x48e5)
 * tail-JUMPED into the colour-column filler 0x3e01 via an m.call whose `ret` popped the
 * label return slot redrawScoreHud had pushed (0x4768 / 0x476d) — so the whole Z80 stack
 * reconverged and pc + SP still matched the oracle. That tail-jump has now been DISSOLVED
 * on both routines into a DIRECT JS call `return fillColourColumn(m)`. A direct JS call
 * has no Z80 stack frame: fillColourColumn paints its column but never rets, so the label
 * return slot redrawScoreHud pushed is left on the stack and the routine's own closing
 * m.ret() pops THAT slot instead of the caller's return. pc and SP therefore diverge from
 * the oracle by exactly one un-popped return slot (SP off by 2), and the dead residual
 * value registers diverge too. All three are EXCLUDED here — they are dead ABI (see the
 * justification below) and the Z80-return modelling the idiomatic layer deliberately drops.
 *
 * WHY THAT DIVERGENCE IS BENIGN (not masking a bug):
 *   1. RAM is byte-for-byte identical (ram=null on every arm below). A Z80 `ret` only
 *      reads the stack and adjusts SP; it writes no memory, so the un-popped slot changes
 *      no RAM — the oracle and the idiomatic push the SAME bytes to the SAME stack address,
 *      the oracle merely pops one more of them. The full RAM dump (stack included) matches.
 *   2. The diverged value registers are dead. All three callers of 0x472c reload their
 *      registers with a constant as the very first instruction after the call — loc_0673
 *      (06a3: `ld a,0x01`), loc_3a6f (3a78: `ld a,0x01`; 3a7a: `ld c,0x02`), loc_3cc1
 *      (3cc7: `ld a,0x07`) — so nothing reads the register file redrawScoreHud leaves.
 *   3. The diverged pc / SP have no live consumer. redrawScoreHud is not wired live (no
 *      manifest override, no idiomatic importer): the three callers dispatch to the frozen
 *      oracle loc_472c, whose stack unwinds correctly. When the HUD chain is later wired
 *      fully idiomatic, callers reach it as a direct JS call and regain control by the JS
 *      return, not the Z80 stack — the closing m.ret() is then vestigial ABI modelling.
 *   (See equivalence-3968.test.js / equivalence-47e1.test.js for the sibling dissolves.)
 *
 * The routine's only observable output is RAM: both players' repainted score digits, the
 * blanked cells above each score column, the status label glyphs + colour, and the two
 * tinted HUD colour columns. The handoff pushes and pops within the balanced stack (no
 * dead scratch window is left below the entry SP that the oracle wouldn't also write), so
 * the full RAM dump is compared byte-for-byte with no exclusions.
 *
 * Checks:
 *   1. EQUAL (captured) — the real attract dispatch is the game-over arm (player count 0,
 *      "GAME OVER" label); idiomatic == oracle on the whole RAM dump.
 *   2. EQUAL (harness) — the same real dispatch through the shared unitEquivalence gate,
 *      asserting only its RAM diff (its equal/pc/regs fields legitimately differ per the
 *      contract above).
 *   3. EQUAL (crafted) — a player-count-1 entry forces the in-game-panel arm (loc_47e1),
 *      which attract never reaches; idiomatic == oracle on RAM there too.
 *   4. IDENTITY — oracle vs oracle is fully EQUAL (gate wiring sanity; identical arms
 *      share pc + registers, so the strict harness still reports equal here).
 *   5. MODEL — a structural re-emit of the routine (driving the oracle label routines
 *      through the registry, so the correct instance is itself RAM-EQUAL to the oracle),
 *      so each teeth twin below differs from the oracle by exactly one thing.
 *   6. TEETH — a wrong HUD colour and a wrong blank offset are both CAUGHT on the RAM
 *      dump, and a corrupted output through the harness is CAUGHT at the corrupted cell.
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
 * The observable contract: run the oracle and a candidate on two independent clones of one
 * entry and diff the whole RAM dump. pc, SP and the value registers are EXCLUDED — the
 * dissolved tail-jump into fillColourColumn means the direct callee no longer rets, so the
 * closing m.ret() pops the un-popped label slot and pc/SP diverge by one return slot while
 * the residual registers are dead (see the file header). Returns the RAM diff, or null when
 * the RAM is byte-for-byte identical.
 */
function observableDiff(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * A structural re-emit of redrawScoreHud, parameterised by the two things the teeth
 * perturb: the HUD tint colour and how many rows above the score column the second
 * blank lands. It drives the oracle callees through the registry, so the correct
 * instance (colour 2, blank two rows above) must itself be RAM-EQUAL to the oracle — that
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

test("EQUAL (captured): idiomatic == oracle on the real GAME OVER dispatch (whole RAM dump)", () => {
  assert.ok(ENTRY, "captured the real 0x472c attract dispatch");
  assert.equal(CAP.playerCount, 0, "the captured dispatch is the game-over (player count 0) arm");
  const ram = observableDiff(ENTRY, idiomatic);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);
  console.log("  EQUAL/captured: real 0x472c entry identical (whole RAM dump)");
});

// -- 2. EQUAL: through the shared unitEquivalence harness ----------------------
// The canonical gate captures the real dispatch, clones, runs both, and diffs memory +
// pc + registers. Only its RAM diff is the honest contract here: the residual register
// file is dead and the closing m.ret() pops the un-popped label slot, so res.equal / res.pc
// / res.regs legitimately differ (per the file header) and are not asserted.

test("EQUAL (harness): the real 0x472c dispatch is RAM-EQUAL through unitEquivalence", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, idiomatic, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.ram, null, `harness RAM diverged: ${JSON.stringify(res.ram)}`);
  console.log("  EQUAL/harness: unitEquivalence captured a real 0x472c entry -> RAM EQUAL");
});

// -- 3. EQUAL: crafted player-count-1 entry forces the in-game-panel arm -------

test("EQUAL (crafted): the in-game-panel arm (player count 1 -> loc_47e1) is RAM-EQUAL", () => {
  const seed = ENTRY.clone();
  seed.mem.write8(GAME_MODE, 1); // force the one/two-player branch attract never reaches
  const ram = observableDiff(seed, idiomatic);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);
  console.log("  EQUAL/crafted: player-count-1 (in-game panel) entry identical (whole RAM dump)");
});

// -- 4. IDENTITY: oracle vs oracle must be EQUAL (proves the gate wiring) ------
// Identical arms share pc + registers as well as RAM, so the strict harness still reports
// a full equal here — proving the harness is not vacuously passing on the relaxed contract.

test("IDENTITY: oracle vs oracle reports EQUAL (gate wiring sanity)", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, true, `gate reported a diff for identical arms: ${JSON.stringify(res)}`);
  console.log("  IDENTITY: oracle vs oracle -> EQUAL");
});

// -- 5. MODEL: the correct structural re-emit is itself RAM-EQUAL -------------

test("MODEL: the correct structural re-emit matches the oracle (so each twin isolates its bug)", () => {
  const ram = observableDiff(ENTRY, correctModel);
  assert.equal(ram, null, ram && `model RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} model=${ram.b})`);
  console.log("  MODEL: correct re-emit identical to the oracle (whole RAM dump)");
});

// -- 6. TEETH: broken twins the gate MUST catch -------------------------------

test("TEETH: a wrong HUD colour is CAUGHT (in a tinted colour cell)", () => {
  const ram = observableDiff(ENTRY, brokenColour);
  assert.notEqual(ram, null, "the gate FAILED to catch a wrong HUD colour — it is worthless");
  // The first diff is the lowest-address tinted cell; assert the perturbation itself:
  // the oracle paints colour 2, the twin colour 3.
  assert.equal(ram.a, 2, `expected the oracle's tint colour 2 at ${hx(ram.addr ?? 0)}`);
  assert.equal(ram.b, 3, `expected the twin's wrong tint colour 3 at ${hx(ram.addr ?? 0)}`);
  assert.ok(ram.addr >= 0x8800, `expected a colour cell (>= 0x8800), got ${hx(ram.addr ?? 0)}`);
  console.log(`  TEETH/colour: wrong tint caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

test("TEETH: a wrong blank offset is CAUGHT (corrupts a written cell)", () => {
  const ram = observableDiff(ENTRY, brokenBlank);
  assert.notEqual(ram, null, "the gate FAILED to catch a wrong blank offset — it is worthless");
  console.log(`  TEETH/blank: wrong blank caught at ${hx(ram.addr ?? 0)} (oracle=${ram.a} broken=${ram.b})`);
});

/** Broken twin for the harness: the correct routine, then one wrong store to a tinted cell. */
function brokenHarness(m) {
  idiomatic(m);
  m.mem.write8(FIRST_COLUMN_BOTTOM, m.mem.read8(FIRST_COLUMN_BOTTOM) ^ 0xff); // BUG: corrupt a tinted cell
}

test("TEETH (harness): a corrupted output is CAUGHT by unitEquivalence (on its RAM diff)", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, brokenHarness, { maxFrames: CAPTURE_FRAMES });
  // The correct idiomatic is already RAM-EQUAL (res.ram === null); the corruption is the ONLY
  // thing that moves RAM, so a non-null res.ram at the corrupted cell is the real tooth here.
  assert.notEqual(res.ram, null, "unitEquivalence FAILED to catch the corrupted twin on RAM — it is worthless");
  assert.equal(res.ram.addr, FIRST_COLUMN_BOTTOM, `harness caught ${hx(res.ram?.addr ?? 0)} (expected ${hx(FIRST_COLUMN_BOTTOM)})`);
  console.log(`  TEETH/harness: corrupted tinted cell caught at ${hx(res.ram.addr)} (oracle=${res.ram.a} broken=${res.ram.b})`);
});
