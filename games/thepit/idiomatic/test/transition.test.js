// SPDX-License-Identifier: GPL-3.0-only
//
// transition — the WHOLE-GAME gate for the round/level BOUNDARY tree, the half the coin/dig tapes
// never reach. A board transition is a mid-frame warm restart: a per-frame service deep in the
// plain gameplay tree (dispatchObjectFrameByStateTimer / tickObjectDwellThenTransition) sees its
// countdown expire and, in the frozen oracle, tail-jumps into a fresh never-returning main loop.
// The coroutine engine models that with machine.restartMain (throw RESTART -> the engine abandons
// the frame and swaps the whole main generator); the transition targets (advanceToNextLevel,
// dockManAndDispatchRoundBoundary and its round/game-over subtree) are generators.
//
// The 3 input tapes never clear a level or lose the last life within their frame budget, so this
// gate drives the game to a live in-game state with the dig tape, then FORCES the transition the
// way the ROM does — arm the master transition countdown (TRANSITION_TIMER 0x807c) to expire next
// frame and set its selector (POST_TRANSITION_MODE 0x807d) to advance-a-level (nonzero) or
// lose-a-life (zero). Both engines run the SAME forced input: the idiomatic layer under the
// coroutine engine (the throw path), the translated oracle under the watchdog engine (nested
// m.call into the new main loop). We assert the idiomatic game reproduces the oracle byte-for-byte
// THROUGH the transition and out the other side into the next round, and that the transition
// actually fired (level bumped / man docked). ROM-guarded (skips without the BYO ROM).

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveAllIdiomatic } from "../../machine.js";
import manifest from "../../manifest.js";
import { GAME_STATE, LEVEL, MEN_LEFT, TRANSITION_TIMER, POST_TRANSITION_MODE,
  SCORE_LO, SCORE_HI, INITIALS_REMAINING } from "../ram.js";

// 0x8048 = the rank a submitted score landed at (0 = did not place). A submitPlayerHighScore local,
// deliberately NOT a ram.js export (ram.js's 0x8048 carries a different tentative round-setup name).
const LANDED_RANK = 0x8048;
import { runIdiomaticGame, runGeneratorGame } from "../../../../core/frame-stepped.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const FRAMES = 760;
const FORCE_AT = 620; // a settled in-game frame (dig starts at 480)
const { stateExclude, golive } = manifest.convergence;
const { watchdogPort, nmiReturnPC, gameStateHi } = golive;

// coin @ 402, start @ 462 (IN1 active-high), then hold Down + pulse Dig (IN0, io-inverted).
function tapeInput(fi) {
  let in1 = 0;
  if (fi >= 402 && fi < 410) in1 |= 0x01;
  if (fi >= 462 && fi < 470) in1 |= 0x04;
  let in0 = 0;
  if (fi >= 480) { in0 |= 0x04; if ((fi - 480) % 32 < 6) in0 |= 0x10; }
  return { 0xa000: in0, 0xa800: in1 };
}

// Drive the game, and at FORCE_AT (once it is a live 1-player game) arm the master transition
// countdown to expire next frame with the given selector. `postMode` nonzero => advance a level,
// zero => lose a life / round boundary.
async function play(useIdiomatic, postMode, { lastLife = false } = {}) {
  const overrides = useIdiomatic ? await resolveAllIdiomatic() : null;
  const m = await Machine.create(ROM, overrides ? { overrides } : {});
  const frames = [];
  const onFrame = (mm, fi) => {
    mm.io.inputAssert = tapeInput(fi);
    if (fi === FORCE_AT && mm.mem.read8(GAME_STATE) === 1) {
      // lastLife: drop the working man count to 1 so the round boundary docks it to 0 and routes
      // the game-over teardown (dockMan -> submitHighScoresAndReset) instead of the next round.
      if (lastLife) mm.mem.write8(MEN_LEFT, 1);
      mm.mem.write8(POST_TRANSITION_MODE, postMode);
      mm.mem.write8(TRANSITION_TIMER, 1); // ticks to 0 next frame -> dispatchObjectFrameByStateTimer fires the boundary
    }
    frames.push(Buffer.from(mm.dumpState()));
  };
  const r = useIdiomatic
    ? runGeneratorGame(m, { nmiReturnPC, maxFrames: FRAMES, onFrame })
    : runIdiomaticGame(m, { watchdogPort, nmiReturnPC, maxFrames: FRAMES, onFrame });
  return { frames, r, level: m.mem.read8(LEVEL), men: m.mem.read8(MEN_LEFT), state: m.mem.read8(GAME_STATE) };
}

function assertIdentical(idi, tr, label) {
  const excl = new Set(stateExclude.cells || []);
  const probe = new Machine(ROM);
  const BPF = tr.frames[0].length;
  const keep = [];
  for (let o = 0; o < BPF; o++) { const a = probe.stateOffsetToAddr(o); if (a >= 0x8000 && a <= gameStateHi && !excl.has(a)) keep.push(o); }
  assert.equal(idi.frames.length, tr.frames.length, `${label}: frame counts differ`);
  for (let i = 0; i < idi.frames.length; i++) for (const o of keep) {
    if (idi.frames[i][o] !== tr.frames[i][o]) {
      assert.fail(`${label} frame ${i}: idiomatic diverged from translated at 0x${probe.stateOffsetToAddr(o).toString(16)} (${idi.frames[i][o]} vs ${tr.frames[i][o]})`);
    }
  }
}

test("level-complete transition (advanceToNextLevel): idiomatic coroutine == translated oracle", async () => {
  const idi = await play(true, 1);
  const tr = await play(false, 1);
  // The transition actually fired: the level counter advanced, and the game is still in play.
  assert.ok(idi.level >= 2, `level did not advance (LEVEL=${idi.level})`);
  assert.equal(idi.level, tr.level, "idiomatic and translated ended on different levels");
  assert.equal(idi.state, tr.state, "idiomatic and translated ended in different game states");
  // ...reproducing the oracle byte-for-byte through the mid-frame restart and into the next round.
  assertIdentical(idi, tr, "level-complete");
});

test("round-boundary transition (dockManAndDispatchRoundBoundary): idiomatic coroutine == translated oracle", async () => {
  const idi = await play(true, 0);
  const tr = await play(false, 0);
  // The boundary fired identically on both engines (man docked / round wound down).
  assert.equal(idi.men, tr.men, "idiomatic and translated docked a different man count");
  assert.equal(idi.level, tr.level, "idiomatic and translated ended on different levels");
  assert.equal(idi.state, tr.state, "idiomatic and translated ended in different game states");
  assertIdentical(idi, tr, "round-boundary");
});

test("game-over teardown (submitHighScoresAndReset): idiomatic coroutine == translated oracle", async () => {
  const idi = await play(true, 0, { lastLife: true });
  const tr = await play(false, 0, { lastLife: true });
  // The last life docked to game over: the teardown ran and cleared back toward attract.
  assert.equal(idi.state, tr.state, "idiomatic and translated ended in different game states");
  assertIdentical(idi, tr, "game-over");
});

// The colour-test DIP is a MID-FRAME warm restart of a different flavour: applyDipSwitches (a plain
// leaf reached from within a boot/setup spine generator) sees DIP bit 7 and, in the oracle, tail-jumps
// to the colour-cycle test screen and never returns. The coroutine port does it with
// m.restartMain(() => showColourTestScreen(m)) — the SAME throw-restart the transitions use, but from a
// DIP path. A `function*` returned as a plain value here would silently no-op (the game would ignore the
// DIP), so this gate is what proves the restart actually fires.
async function playColourTest(useIdiomatic) {
  const overrides = useIdiomatic ? await resolveAllIdiomatic() : null;
  const m = await Machine.create(ROM, overrides ? { overrides } : {});
  const frames = [];
  const onFrame = (mm) => {
    mm.io.dsw = 0x80;                     // colour-test DIP (read at 0xb000)
    mm.io.inputAssert = { 0xa000: 0x18 }; // hold both triggers so the sweep runs (IN0 bits 3+4)
    mm.mem.write8(0x8018, mm.mem.read8(0x8018) | 0x18); // pre-seat IN0_DEBOUNCED (the debounce needs
    // NMI frames to settle, which the boot-time entry has not had yet — without this both engines spin
    // the seam-less re-decode loop, a shared model limitation, not the port's).
    frames.push(Buffer.from(mm.dumpState()));
  };
  const r = useIdiomatic
    ? runGeneratorGame(m, { nmiReturnPC, maxFrames: 40, onFrame })
    : runIdiomaticGame(m, { watchdogPort, nmiReturnPC, maxFrames: 40, onFrame });
  return { frames, r, state: m.mem.read8(GAME_STATE) };
}

test("colour-test DIP (applyDipSwitches -> restartMain(showColourTestScreen)): idiomatic coroutine == translated oracle", async () => {
  const idi = await playColourTest(true);
  const tr = await playColourTest(false);
  // The restart actually fired: both engines are in the colour-test screen (GAME_STATE 9)...
  assert.equal(idi.state, 9, `idiomatic did not enter the colour-test screen (GAME_STATE=${idi.state})`);
  assert.equal(idi.state, tr.state, "idiomatic and translated ended in different game states");
  // ...and reproduce the oracle byte-for-byte through the sweep.
  assertIdentical(idi, tr, "colour-test");
});

// The credit-watchdog cold-reset is a TOP-OF-FRAME warm restart (NOT a throw): the NMI handler
// serviceVblankNmi runs at the engine's top level, so when the three redundant credit copies
// disagree it hands off with m.nextMain = () => coldBootInit(m) (a throw here would escape the inner
// catch). coldBootInit is a generator; returning it as a plain value would silently no-op the reset.
async function playColdReset(useIdiomatic) {
  const overrides = useIdiomatic ? await resolveAllIdiomatic() : null;
  const m = await Machine.create(ROM, overrides ? { overrides } : {});
  const frames = [];
  const CREDIT_MIRROR_A = 0x801c;
  const onFrame = (mm, fi) => {
    if (fi === 200) mm.mem.write8(CREDIT_MIRROR_A, mm.mem.read8(CREDIT_MIRROR_A) ^ 0xff); // corrupt a mirror
    frames.push(Buffer.from(mm.dumpState()));
  };
  const r = useIdiomatic
    ? runGeneratorGame(m, { nmiReturnPC, maxFrames: 360, onFrame })
    : runIdiomaticGame(m, { watchdogPort, nmiReturnPC, maxFrames: 360, onFrame });
  return { frames, r };
}

test("credit-corruption cold-reset (serviceVblankNmi -> nextMain=coldBootInit): idiomatic coroutine == translated oracle", async () => {
  const idi = await playColdReset(true);
  const tr = await playColdReset(false);
  // Both engines detect the mirror mismatch and cold-reset through the whole boot, byte-for-byte.
  assertIdentical(idi, tr, "cold-reset");
});

// The HIGH-SCORE INITIALS ENTRY is the one converted spine screen the coin/dig/transition tapes
// never reach — it only runs when a finishing score PLACES on the table. Drive a game to the last
// life with a poked-high score so dockMan -> submitHighScoresAndReset -> submitPlayerHighScore places
// (LANDED_RANK != 0) -> runHighScoreInitialsEntry runs, then HOLD the commit input (IN0 bit 4; the
// debounce at serviceVblankNmi is a 2-frame-stable LEVEL, so holding settles it) to enter all three
// initials -- which exercises stepHighScoreInitialsEntry's commit arm (its `yield* waitFrames`) and
// runHighScoreInitialsEntry's completion. Asserts idiomatic coroutine == translated oracle throughout.
async function playHighScore(useIdiomatic) {
  const overrides = useIdiomatic ? await resolveAllIdiomatic() : null;
  const m = await Machine.create(ROM, overrides ? { overrides } : {});
  const frames = [];
  let placedRank = 0, minInitials = 9;
  const onFrame = (mm, fi) => {
    let in1 = 0; if (fi >= 402 && fi < 410) in1 |= 0x01; if (fi >= 462 && fi < 470) in1 |= 0x04;
    let in0 = 0;
    if (fi >= 480 && fi < 660) { in0 |= 0x04; if ((fi - 480) % 32 < 6) in0 |= 0x10; } // dig to the transition
    else if (fi >= 660) in0 |= 0x10;                                                   // then HOLD commit
    mm.io.inputAssert = { 0xa000: in0, 0xa800: in1 };
    if (fi === FORCE_AT && mm.mem.read8(GAME_STATE) === 1) {
      for (const a of [SCORE_LO, SCORE_LO + 1, SCORE_LO + 2, SCORE_HI]) mm.mem.write8(a, 0x99); // placing score
      mm.mem.write8(MEN_LEFT, 1);             // last life
      mm.mem.write8(POST_TRANSITION_MODE, 0); // lose-a-life path
      mm.mem.write8(TRANSITION_TIMER, 1);
    }
    const lr = mm.mem.read8(LANDED_RANK); if (lr !== 0) placedRank = lr;
    if (placedRank) { const ir = mm.mem.read8(INITIALS_REMAINING); if (ir < minInitials) minInitials = ir; }
    frames.push(Buffer.from(mm.dumpState()));
  };
  const r = useIdiomatic
    ? runGeneratorGame(m, { nmiReturnPC, maxFrames: 880, onFrame })
    : runIdiomaticGame(m, { watchdogPort, nmiReturnPC, maxFrames: 880, onFrame });
  return { frames, r, placedRank, minInitials };
}

test("high-score initials entry (runHighScoreInitialsEntry / stepHighScoreInitialsEntry): idiomatic coroutine == translated oracle", async () => {
  const idi = await playHighScore(true);
  const tr = await playHighScore(false);
  // The placing score reached the entry, and all three initials were committed (the commit arm ran).
  assert.equal(idi.placedRank, 1, `idiomatic score did not place at rank 1 (got ${idi.placedRank})`);
  assert.equal(idi.placedRank, tr.placedRank, "idiomatic and translated placed at different ranks");
  assert.equal(idi.minInitials, 0, `idiomatic did not commit all three initials (min INITIALS_REMAINING=${idi.minInitials})`);
  assert.equal(idi.minInitials, tr.minInitials, "idiomatic and translated committed a different number of initials");
  assertIdentical(idi, tr, "high-score");
});
