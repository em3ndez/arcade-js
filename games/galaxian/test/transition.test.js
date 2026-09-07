// SPDX-License-Identifier: GPL-3.0-only
//
// transition — galaxian's standing whole-game gate for the FORCED transitions the coin/start/play tape
// never reaches (runbook §5): stage advance, life loss with reserves, and game over. A coin/start tape
// settles a live 1-player round (GAME_STATE 0x4005 == 3, the play sub-state SEQUENCE_STATE 0x400a == 5);
// at FORCE_AT each case pokes the ROM's REAL trigger and lets the play pipeline drive through it. Each case
// asserts the transition FIRED (the teeth) — a run that never reached play fails, never vacuously passes.
// Byte-exact gameplay-vs-MAME correctness lives in the pixel --done gate; this pins the transition logic.
// ROM-guarded (skips without the BYO ROM).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import manifest from "../manifest.js";
import {
  GAME_STATE, SEQUENCE_STATE, OBJ_ACTIVE_FLAG, HIT_EVENT_FLAG,
  loc_421b as STAGE_SELECTOR, loc_421d as LIVES_REMAINING,
  loc_4222 as STAGE_ADVANCE_ENABLE, loc_4223 as STAGE_ADVANCE_COUNTDOWN,
} from "../idiomatic/names.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROM_PATH = join(HERE, "..", "rom", "maincpu.bin");
const HAVE_ROM = existsSync(ROM_PATH);
const ROM = HAVE_ROM ? new Uint8Array(readFileSync(ROM_PATH)) : null;

const PLAY_STATE = 3;    // GAME_STATE for a live 1-player round
const PLAY_SUBSTATE = 5; // SEQUENCE_STATE sub-state where the gameplay pipeline (deaths/stage/hits) runs
const FORCE_AT = 480;    // a settled in-play frame (state 3, sub-state 5, object subsystem live)
const FRAMES = 700;      // past the force: game-over resets ~f530, a life-loss respawn completes ~f600
const { idiomatic } = manifest.convergence;
const { nmiReturnPC } = idiomatic;

// coin/start only — that alone settles a live 1-player round; no fire/move needed to reach the force.
const PMAP = { in0: 0, in1: 1, in2: 2 };
const A = manifest.inputs.actions;
function tapeInput(f) {
  const a = {};
  const press = (act) => { a[PMAP[act.port]] = (a[PMAP[act.port]] || 0) | act.bit; };
  if (f >= 182 && f < 190) press(A.coin);
  if (f >= 240 && f < 248) press(A.start1);
  return a;
}

// Drive the coin/start tape through the idiomatic engine, applying forcePoke once at FORCE_AT (in settled
// play). Captures the pre-force witnesses and post-force observations, returns the machine + witness.
async function drive(forcePoke) {
  const w = {
    forced: false, sawPlay: false,
    stageAtForce: null, livesAtForce: null, objActiveAtForce: null,
    sawObjCleared: false, sawRespawn: false, sawStateLeavePlay: false,
  };
  const overrides = await resolveAllIdiomatic();
  const m = new Machine(ROM, { overrides });
  const R = (a) => m.mem.read8(a);
  runIdiomaticGame(m, {
    bootAddr: 0x0000, nmiReturnPC, maxFrames: FRAMES,
    onFrame: (mm, f) => {
      if (f === 0) return;
      mm.io.inputAssert = tapeInput(f);
      const inPlay = R(GAME_STATE) === PLAY_STATE && R(SEQUENCE_STATE) === PLAY_SUBSTATE;
      if (inPlay) w.sawPlay = true;
      if (f === FORCE_AT && inPlay) {
        w.stageAtForce = R(STAGE_SELECTOR);
        w.objActiveAtForce = R(OBJ_ACTIVE_FLAG) & 1;
        forcePoke(mm);
        w.livesAtForce = R(LIVES_REMAINING); // read AFTER the poke (cases seat lives themselves)
        w.forced = true;
      }
      if (f > FORCE_AT) {
        if ((R(OBJ_ACTIVE_FLAG) & 1) === 0) w.sawObjCleared = true;
        if (w.sawObjCleared && (R(OBJ_ACTIVE_FLAG) & 1) && R(GAME_STATE) === PLAY_STATE) w.sawRespawn = true;
        if (R(GAME_STATE) !== PLAY_STATE) w.sawStateLeavePlay = true;
      }
    },
  });
  return { m, w, R };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────
// CASE 1 — STAGE ADVANCE. The board-clear one-shot: advanceStageAndReseedFormation fires when the enable
// (0x4222 bit0) is set and the countdown (0x4223) decrements to zero this tick, stepping the stage selector
// (0x421b, saturating at 7) and reseeding the formation. Arm it (enable=1, countdown=1 -> hits 0 next tick).
function forceStageAdvance(m) {
  m.mem.write8(STAGE_ADVANCE_ENABLE, 1);
  m.mem.write8(STAGE_ADVANCE_COUNTDOWN, 1);
}

test("stage advance: the one-shot steps the stage selector", { skip: !HAVE_ROM }, async () => {
  const { m, w, R } = await drive(forceStageAdvance);
  assert.ok(w.sawPlay, "the tape never reached a live play sub-state");
  assert.ok(w.forced, "the stage-advance force never fired (not in play at FORCE_AT)");
  // TEETH: the stage selector advanced past its value at the force (a fresh, harder formation).
  assert.ok(R(STAGE_SELECTOR) > w.stageAtForce,
    `the stage selector did not advance (${w.stageAtForce} -> ${R(STAGE_SELECTOR)})`);
  // The game stayed live across the stage advance (not game over).
  assert.equal(R(GAME_STATE), PLAY_STATE, "the game left play across the stage advance");
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────
// CASE 2 — LIFE LOSS WITH RESERVES. handlePlayerHitEvent consumes HIT_EVENT_FLAG (0x4204, an enemy shot
// overlapping the player): it clears OBJ_ACTIVE_FLAG (the player dies), decrements the life counter (0x421d),
// and — with lives left — the flow respawns the ship and play continues (NOT game over). Seat two lives so
// the drop is non-vacuous, then raise the hit.
function forceLifeLoss(m) {
  m.mem.write8(LIVES_REMAINING, 2); // two lives -> a life loss, not the last life
  m.mem.write8(HIT_EVENT_FLAG, 1);
}

test("life loss (reserves remain): the player dies, a life is spent, and the ship respawns in play", { skip: !HAVE_ROM }, async () => {
  const { m, w, R } = await drive(forceLifeLoss);
  assert.ok(w.sawPlay, "the tape never reached a live play sub-state");
  assert.ok(w.forced, "the life-loss force never fired (not in play at FORCE_AT)");
  assert.equal(w.objActiveAtForce, 1, "the ship was not live at the force — the death would be vacuous");
  assert.equal(w.livesAtForce, 2, "the seated life count did not take");

  // TEETH: the ship died (OBJ_ACTIVE_FLAG cleared)...
  assert.ok(w.sawObjCleared, "the player never died (OBJ_ACTIVE_FLAG never cleared after the hit)");
  // ...a life was spent...
  assert.equal(R(LIVES_REMAINING), 1, `a life was not spent (${w.livesAtForce} -> ${R(LIVES_REMAINING)})`);
  // ...and it was a RESPAWN, not a teardown: the ship came back and the game stayed in play.
  assert.ok(w.sawRespawn, "the ship never respawned (OBJ_ACTIVE_FLAG never re-set in play)");
  assert.equal(R(GAME_STATE), PLAY_STATE, "the game went to game over on a life loss with reserves left");
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────
// CASE 3 — GAME OVER (LAST LIFE). The same death, but with the last life: the counter (0x421d) reaches 0 and
// the round machine ends the game — GAME_STATE resets to 1 (attract), the ship does NOT respawn. Seat one
// life, then raise the hit.
function forceGameOver(m) {
  m.mem.write8(LIVES_REMAINING, 1); // last life -> the death ends the game
  m.mem.write8(HIT_EVENT_FLAG, 1);
}

test("game over (last life): the game ends and returns to attract", { skip: !HAVE_ROM }, async () => {
  const { m, w, R } = await drive(forceGameOver);
  assert.ok(w.sawPlay, "the tape never reached a live play sub-state");
  assert.ok(w.forced, "the game-over force never fired (not in play at FORCE_AT)");
  assert.equal(w.livesAtForce, 1, "the seated last-life count did not take");

  // TEETH: the death on the last life ended the game — GAME_STATE left play and landed in attract (1)...
  assert.ok(w.sawStateLeavePlay, "the game never left play after the last-life death (no game over)");
  assert.equal(R(GAME_STATE), 1, `the game did not return to attract (GAME_STATE ${R(GAME_STATE)})`);
  // ...and the ship did NOT respawn (a teardown, not a life loss).
  assert.equal(R(OBJ_ACTIVE_FLAG) & 1, 0, "the ship respawned on the last life — that should be game over");
});
