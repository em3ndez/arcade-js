// SPDX-License-Identifier: GPL-3.0-only
//
// idiomatic — the STANDING WHOLE-GAME gate for Donkey Kong. It drives the WHOLE idiomatic
// machine (every routine wired live via resolveAllIdiomatic, the exact config web/worker.js
// ships) under the clock-free COROUTINE engine (core/frame-stepped.js runIdiomaticGame — the
// engine that ships), from reset through boot -> attract -> coin -> credit -> start -> in-play,
// and asserts the whole machine GENUINELY RUNS: not "it boots without crashing" but that the
// real state machine advances the way a live cabinet does.
//
// This is NOT the per-routine equivalence suite (games/dkong/idiomatic/test/equivalence-*.test.js,
// which proves each routine matches the translated oracle in isolation). This is the capstone the
// per-routine tests build toward: all routines running together AS the game.
//
// The whole-machine invariants asserted, each with an independent regression that breaks it:
//   • boot completes the full frame budget with NO translation gap (run unwinds clean, no crash);
//   • boot -> attract      (GAME_STATE reaches 1, ATTRACT set);
//   • the coin is accepted (CREDITS increments 0->1, GAME_STATE reaches the credited state 2);
//   • play starts          (GAME_STATE reaches the in-game state 3, ATTRACT clears);
//   • gameplay ADVANCES    (the in-game sub-state dispatcher steps GAME_SUBSTATE through the
//                           opening cutscene, and the per-frame SUBSTATE_TIMER countdown drains).
//
// TEETH (null-mutant proven, see games/dkong/test/idiomatic.test.js commit notes): clamping any
// one driving cell to 0 in a scratch copy trips exactly the matching assertion while the run still
// completes cleanly — e.g. force GAME_STATE (0x6005) to stay 0 and "play starts" fails; force
// GAME_SUBSTATE (0x600A) to stay 0 and "gameplay advances" fails; force CREDITS (0x6001) to stay 0
// and "the coin is accepted" fails. A "boots without crashing" test would pass all three.
//
// ROM-guarded: skips cleanly when the BYO ROM is absent (like games/frogger/test/idiomatic.test.js).

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveAllIdiomatic } from "../machine.js";
import manifest from "../manifest.js";
import { CREDITS, GAME_STATE, ATTRACT, GAME_SUBSTATE, SUBSTATE_TIMER } from "../idiomatic/names.js";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";

const ROM_PATH = new URL("../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const { nmiReturnPC } = manifest.convergence.idiomatic;

// Enough to boot, run attract, take a coin, start a game, and watch the in-game dispatcher step
// through the opening Kong-climb cutscene. On the clock-free engine attract loops fast, so the
// coin/start frames are engine-frame ordinals, not the MAME-tape wall-clock ones.
const FRAMES = 520;
const COIN_FRAME = 200;
const START_FRAME = 300;

// IN2 (0x7D00) active-high: bit7 = Coin 1, bit2 = 1-Player Start (boards/dkong/io.js readIn2).
const IN2 = 0x7d00;
const COIN = 0x80;
const START = 0x04;

// The game states GAME_STATE (0x6005) walks: 0 power-on, 1 attract, 2 credited, 3 in-game.
const STATE_ATTRACT = 1;
const STATE_CREDITED = 2;
const STATE_IN_GAME = 3;

// Drive the whole idiomatic machine once from reset, sampling the state machine at every vblank
// yield. Returns the observed extrema a live cabinet would produce.
async function driveWholeGame() {
  const mi = new Machine(ROM, { overrides: await resolveAllIdiomatic() });
  mi.inputTape = [
    { frame: COIN_FRAME, port: IN2, bits: COIN, dur: 8 }, // MAME's ~6-frame coin hold
    { frame: START_FRAME, port: IN2, bits: START, dur: 8 },
  ];

  const obs = {
    peakCredit: 0,
    sawAttractState: false,
    sawAttractSet: false,
    sawCreditedState: false,
    sawInGameState: false,
    attractClearedInGame: false,
    inGameSubMax: 0,
    timerDrainCount: 0, // frames on which the per-frame countdown actually moved while in-game
  };
  let prevTimer = null;

  const ri = runIdiomaticGame(mi, {
    nmiReturnPC,
    maxFrames: FRAMES,
    onFrame: (m, frame) => {
      m.applyInputs(frame); // assert the coin/start bits for this frame's IN2 reads

      const gs = m.mem.read8(GAME_STATE);
      const credit = m.mem.read8(CREDITS);
      const attract = m.mem.read8(ATTRACT);

      if (credit > obs.peakCredit) obs.peakCredit = credit;
      if (gs === STATE_ATTRACT) obs.sawAttractState = true;
      if (attract !== 0) obs.sawAttractSet = true;
      if (gs === STATE_CREDITED) obs.sawCreditedState = true;
      if (gs === STATE_IN_GAME) {
        obs.sawInGameState = true;
        if (attract === 0) obs.attractClearedInGame = true;
        const sub = m.mem.read8(GAME_SUBSTATE);
        if (sub > obs.inGameSubMax) obs.inGameSubMax = sub;
        const timer = m.mem.read8(SUBSTATE_TIMER);
        if (prevTimer !== null && timer !== prevTimer) obs.timerDrainCount += 1;
        prevTimer = timer;
      }
    },
  });

  return { ri, obs };
}

test("the whole idiomatic game boots, takes a coin, starts, and advances (all routines live)", async () => {
  const { ri, obs } = await driveWholeGame();

  // 1. Boot ran the full frame budget with no translation gap / unmapped access — a missing
  //    routine or a stack-unbalanced tail would surface here as a non-null stopError.
  assert.equal(ri.stopError, null, `whole-game run errored: ${ri.stop}`);
  assert.ok(ri.frames >= FRAMES, `run covered only ${ri.frames}/${FRAMES} frames (${ri.stop})`);

  // 2. Boot reached the attract loop.
  assert.ok(obs.sawAttractState, "boot never reached attract (GAME_STATE 1)");
  assert.ok(obs.sawAttractSet, "the ATTRACT flag (0x6007) was never set during attract");

  // 3. The coin was accepted: a credit banked and the state machine entered the credited state.
  assert.ok(obs.peakCredit >= 1, `no credit banked after the coin (peak CREDITS ${obs.peakCredit})`);
  assert.ok(obs.sawCreditedState, "the coin did not move the machine to the credited state (GAME_STATE 2)");

  // 4. Play started: the credited game ran (GAME_STATE 3) and attract cleared.
  assert.ok(obs.sawInGameState, "start did not begin a game (GAME_STATE never reached the in-game state 3)");
  assert.ok(obs.attractClearedInGame, "ATTRACT (0x6007) did not clear once a credited game was running");

  // 5. Gameplay genuinely ADVANCED: the in-game sub-state dispatcher stepped GAME_SUBSTATE through
  //    the opening cutscene, and the per-frame SUBSTATE_TIMER countdown drained. A frozen game
  //    (in-game state but no dispatch) would leave both of these at zero.
  assert.ok(
    obs.inGameSubMax >= 5,
    `the in-game sub-state dispatcher did not advance (max GAME_SUBSTATE while in-game was ${obs.inGameSubMax})`,
  );
  assert.ok(
    obs.timerDrainCount > 0,
    "the per-frame SUBSTATE_TIMER countdown never moved while in-game (the frame loop is not ticking)",
  );
});
