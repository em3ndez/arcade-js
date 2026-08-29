// SPDX-License-Identifier: GPL-3.0-only
//
// transition — pooyan's whole-game gate for the FORCED BOUNDARY transitions (runbook §5) the
// coin/start/play tape never reaches within its frame budget: the round/board advance and game over.
// The tape settles the game into a live 1-player round (round 0), then at a fixed FORCE frame POKES the
// ROM's own transition trigger IDENTICALLY into BOTH engines and drives through it. The idiomatic layer
// runs under runIdiomaticGame, the pure-translated oracle under runCycleFree at the same main-loop
// boundary (manifest.convergence, 0x021c) — both clock-free and frame-aligned, so the compare is direct.
// Each case asserts (1) the transition ACTUALLY FIRED (ROUND_COUNTER incremented / GAME_ACTIVE_FLAG
// cleared) — a run that never reached play makes no poke and fails the teeth, never vacuously passes;
// and (2) idiomatic == oracle byte-for-byte on every live cell (dead stack scratch excluded) THROUGH and
// past the transition. ROM-guarded (skips without the BYO ROM).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runIdiomaticGame, runCycleFree } from "../../../core/frame-stepped.js";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import manifest from "../manifest.js";
import {
  MAIN_GAME_STATE, GAME_ACTIVE_FLAG, PLAY_STATE_INDEX, ROUND_COUNTER,
  ACTOR_TABLE, LEAD_ACTOR_STATE, LEAD_ACTOR_FRAME_DELAY, PLAYER0_LIVES,
  RESET_SCAN_LATCH, PHASE_TIMER, TWO_PLAYER_FLAG, HUD_INTEGRITY_STRIP_A,
} from "../idiomatic/names.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROM_PATH = join(HERE, "..", "rom", "maincpu.bin");
const HAVE_ROM = existsSync(ROM_PATH);
const ROM = HAVE_ROM ? new Uint8Array(readFileSync(ROM_PATH)) : null;

const PLAY_STATE = 3;         // MAIN_GAME_STATE while in-play
const FORCE_AT = 500;         // a settled in-play frame (play reached ~f370, sub-state settled by ~f450)
const FRAMES = 680;           // 180 frames past the force -> compare through and out the other side
const { pollPCs, stateExclude, idiomatic } = manifest.convergence;
const { nmiReturnPC } = idiomatic;
const [STACK_LO, STACK_HI] = stateExclude.stack;
const hex = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;

const A = manifest.inputs.actions;
function tapeInput(f) {
  const a = {};
  const press = (act) => { a[act.port] = (a[act.port] || 0) | act.bit; };
  if (f >= 300 && f < 306) press(A.coin);
  if (f >= 360 && f < 366) press(A.start1);
  if (f >= 420) {
    if (f % 24 < 4) press(A.fire);
    press(Math.floor(f / 60) % 2 ? A.down : A.up);
  }
  return a;
}

/** Byte offsets of the LIVE state cells — everything outside the dead stack scratch. */
function liveOffsets(bytesPerFrame, probe) {
  const keep = [];
  for (let o = 0; o < bytesPerFrame; o++) {
    const a = probe.stateOffsetToAddr(o);
    if (!(a >= STACK_LO && a < STACK_HI)) keep.push(o);
  }
  return keep;
}

// Drive the tape through BOTH engines with the SAME forcePoke applied pre-NMI at FORCE_AT (once the game
// is a live 1-player round). Returns the per-frame state dumps and the transition witness.
async function drive(useIdiomatic, forcePoke) {
  const frames = [];
  const w = { forced: false, sawPlay: false, roundAtForce: null, activeAtForce: null };
  const onFrame = (m, f) => {
    if (f === 0) return; // power-on sample, before the boot generator runs
    m.io.inputAssert = tapeInput(f);
    if (m.mem.read8(MAIN_GAME_STATE) === PLAY_STATE) w.sawPlay = true;
    if (f === FORCE_AT && m.mem.read8(MAIN_GAME_STATE) === PLAY_STATE) {
      w.roundAtForce = m.mem.read8(ROUND_COUNTER);
      w.activeAtForce = m.mem.read8(GAME_ACTIVE_FLAG);
      forcePoke(m);
      w.forced = true;
    }
    frames.push(Buffer.from(m.dumpState()));
  };
  let m;
  if (useIdiomatic) {
    const overrides = await resolveAllIdiomatic();
    m = new Machine(ROM, { overrides });
    const r = runIdiomaticGame(m, { bootAddr: 0x0000, nmiReturnPC, maxFrames: FRAMES, onFrame });
    assert.equal(r.stopError, null, `idiomatic run errored: ${r.stop}`);
  } else {
    m = new Machine(ROM, {});
    const r = runCycleFree(m, { pollPCs, maxFrames: FRAMES, stepBudget: FRAMES * 200000, onFrame });
    assert.equal(r.stopError, null, `oracle run errored: ${r.stop}`);
  }
  return { frames, m, w };
}

// Byte-for-byte on every live cell (dead stack scratch excluded), through and past the transition.
function assertIdentical(idi, tr, label) {
  assert.equal(idi.frames.length, tr.frames.length, `${label}: frame counts differ`);
  const keep = liveOffsets(tr.frames[0].length, tr.m);
  assert.ok(keep.length > 0, "no live-state bytes selected to compare");
  for (let i = 0; i < idi.frames.length; i++) {
    for (const o of keep) {
      if (idi.frames[i][o] !== tr.frames[i][o]) {
        assert.fail(`${label} frame ${i}: idiomatic diverged from oracle at ` +
          `${hex(tr.m.stateOffsetToAddr(o))} (idiomatic ${idi.frames[i][o]} vs oracle ${tr.frames[i][o]})`);
      }
    }
  }
}

// ROUND / BOARD ADVANCE — the game's own board-clear trigger (grounded in games/pooyan/out/grounding/
// deep-boardclear.lua): keep the lead-actor record active (ACTOR_TABLE=1), set its secondary state to 7
// and its frame-delay to 1 so it dispatches now, and point the in-play sub-state at stepGameplayFrame
// (5) which runs advanceLeadActorSecondaryState. At the settled round-0 (even) state that driver forces
// the play sub-state to the round-reseed handler (reseedSpawnCountersAndArmPlayMode), which bumps
// ROUND_COUNTER 0->1 — the genuine round advance. Both engines take the same poked path.
function forceRoundAdvance(m) {
  m.mem.write8(ACTOR_TABLE, 0x01);
  m.mem.write8(LEAD_ACTOR_STATE, 0x07);
  m.mem.write8(LEAD_ACTOR_FRAME_DELAY, 0x01);
  m.mem.write8(PLAY_STATE_INDEX, 0x05);
}

test("round/board advance: ROUND_COUNTER bumps and idiomatic == oracle through it", { skip: !HAVE_ROM }, async () => {
  const idi = await drive(true, forceRoundAdvance);
  const tr = await drive(false, forceRoundAdvance);

  // The force actually landed on a live round, on both engines.
  assert.ok(idi.w.sawPlay && tr.w.sawPlay, "a run never reached in-play — the tape must settle a round");
  assert.ok(idi.w.forced && tr.w.forced, "the round-advance force never fired (game was not in play at FORCE_AT)");

  // TEETH: the transition FIRED — ROUND_COUNTER advanced past its value at the force, on BOTH sides.
  const idiRound = idi.m.mem.read8(ROUND_COUNTER);
  const trRound = tr.m.mem.read8(ROUND_COUNTER);
  assert.ok(idiRound > idi.w.roundAtForce, `idiomatic round did not advance (${idi.w.roundAtForce} -> ${idiRound})`);
  assert.ok(trRound > tr.w.roundAtForce, `oracle round did not advance (${tr.w.roundAtForce} -> ${trRound})`);
  assert.equal(idiRound, trRound, "idiomatic and oracle ended on different rounds");

  assertIdentical(idi, tr, "round-advance");
});

// GAME OVER — force the round-end / game-over master (in-play sub-state 14, dispatchRoundEndElseWipeColumn,
// grounded in deep-gameover.lua): drain the last life (PLAYER0_LIVES=0), select the one-player branch
// (TWO_PLAYER_FLAG=0), arm the reset latch (RESET_SCAN_LATCH), expire the phase timer (PHASE_TIMER=1 ->
// dec to 0), and satisfy the HUD integrity checksum (the 10-cell strip at stride -0x20 must sum to 0xaa).
// One-player with no credit left tails clearActorsAndEnterContinueState -> resetGameToAttractState, which
// clears GAME_ACTIVE_FLAG 1->0 (full game over back to attract). Both engines take the same poked path.
const CKSUM_ROWS = 0x0a, ROW_STRIDE = 0x20, CKSUM_MAGIC = 0xaa;
function forceGameOver(m) {
  m.mem.write8(PLAYER0_LIVES, 0x00);
  m.mem.write8(TWO_PLAYER_FLAG, 0x00);
  m.mem.write8(RESET_SCAN_LATCH, 0xff);
  m.mem.write8(PHASE_TIMER, 0x01);
  for (let i = 0; i < CKSUM_ROWS; i++) m.mem.write8((HUD_INTEGRITY_STRIP_A - i * ROW_STRIDE) & 0xffff, 0x00);
  m.mem.write8(HUD_INTEGRITY_STRIP_A, CKSUM_MAGIC); // strip sums to 0xaa -> integrity check passes
  m.mem.write8(PLAY_STATE_INDEX, 14);
}

test("game over: GAME_ACTIVE_FLAG clears and idiomatic == oracle through the teardown", { skip: !HAVE_ROM }, async () => {
  const idi = await drive(true, forceGameOver);
  const tr = await drive(false, forceGameOver);

  assert.ok(idi.w.sawPlay && tr.w.sawPlay, "a run never reached in-play — the tape must settle a round");
  assert.ok(idi.w.forced && tr.w.forced, "the game-over force never fired (game was not in play at FORCE_AT)");
  // The flag was set going in, or "cleared" would be vacuous.
  assert.equal(idi.w.activeAtForce, 1, "GAME_ACTIVE_FLAG was not set at the force — the run was not live");
  assert.equal(tr.w.activeAtForce, 1, "oracle GAME_ACTIVE_FLAG was not set at the force");

  // TEETH: the teardown FIRED — the in-play gate cleared 1->0 on BOTH sides.
  const idiActive = idi.m.mem.read8(GAME_ACTIVE_FLAG);
  const trActive = tr.m.mem.read8(GAME_ACTIVE_FLAG);
  assert.equal(idiActive, 0, `idiomatic GAME_ACTIVE_FLAG did not clear (still ${idiActive})`);
  assert.equal(trActive, 0, `oracle GAME_ACTIVE_FLAG did not clear (still ${trActive})`);

  assertIdentical(idi, tr, "game-over");
});
