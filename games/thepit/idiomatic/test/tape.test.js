// SPDX-License-Identifier: GPL-3.0-only
//
// tape — replay the INPUT TAPES through the whole idiomatic game and gate them against the
// translated oracle. This is the half the attract gates (golive) never exercised: real input.
// The attract/demo run takes no input, so a broken input path (or a coin/warm-restart flow that
// freezes the frame-stepped engine) passes golive but fails the moment a player inserts a coin.
//
// tapes/coin_start.lua is the pinned contract (coin IN1 bit0 @ lua frame 400, start IN1 bit2 @
// 460; the JS io.inputAssert mirror presses the same bits +2 frames later — coin@402, start@462).
// Both modes run under runIdiomaticGame (the browser's go-live engine); the translated layer runs
// under the SAME engine with no overrides, as the oracle. We assert (a) the game actually RESPONDS
// — a credit banks, the game starts (GAME_STATE 3->1 at the contract frame 464), and in dig mode
// the player tunnels (PLAYER_X advances) — and (b) the idiomatic game reproduces the translated
// oracle byte-for-byte over game state, all the way through coin -> start -> in-game -> dig.
// ROM-guarded (skips without the BYO ROM).

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveAllIdiomatic } from "../../machine.js";
import manifest from "../../manifest.js";
import { GAME_STATE, CREDIT_COUNT, PLAYER_X } from "../ram.js";
import { runIdiomaticGame } from "../../../../core/frame-stepped.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const FRAMES = 900; // boot -> attract -> coin(402) -> start(462) -> in-game -> dig(480+)
const { stateExclude, golive } = manifest.convergence;
const { watchdogPort, nmiReturnPC, gameStateHi } = golive;

// coin_start.lua, JS +2 mirror. IN1 @ 0xa800 ACTIVE HIGH: b0=Coin1, b2=Start1. IN0 @ 0xa000: the
// worker's "press these physical bits" contract — b2=Down, b4=Dig (io inverts the active-low port).
function tapeInput(fi, mode) {
  let in1 = 0;
  if (fi >= 402 && fi < 410) in1 |= 0x01; // Coin1
  if (fi >= 462 && fi < 470) in1 |= 0x04; // Start1
  let in0 = 0;
  if (mode === "dig" && fi >= 480) {
    in0 |= 0x04;                          // hold Down continuously
    if ((fi - 480) % 32 < 6) in0 |= 0x10; // pulse Dig every 32 frames, hold 6
  }
  return { 0xa000: in0, 0xa800: in1 };
}

async function play(overrides, mode) {
  const m = await Machine.create(ROM, overrides ? { overrides } : {});
  const frames = [];
  const t = { peakCredit: 0, startedAt: -1, minPX: 256, maxPX: -1 };
  const r = runIdiomaticGame(m, {
    watchdogPort, nmiReturnPC, maxFrames: FRAMES,
    onFrame: (mm, fi) => {
      mm.io.inputAssert = tapeInput(fi, mode);
      frames.push(Buffer.from(mm.dumpState()));
      const credit = mm.mem.read8(CREDIT_COUNT);
      if (credit > t.peakCredit) t.peakCredit = credit;
      if (mm.mem.read8(GAME_STATE) === 1 && t.startedAt < 0) t.startedAt = fi;
      if (t.startedAt >= 0) { const px = mm.mem.read8(PLAYER_X); if (px < t.minPX) t.minPX = px; if (px > t.maxPX) t.maxPX = px; }
    },
  });
  assert.equal(r.stopError, null, `${mode} run errored: ${r.stop}`);
  return { frames, t };
}

// Byte-diff the used game-state region [0x8000, gameStateHi] minus the cycle-proxy cells.
function assertGameStateIdentical(idi, tr, label) {
  const excl = new Set(stateExclude.cells || []);
  const probe = new Machine(ROM);
  const BPF = tr[0].length;
  const keep = [];
  for (let o = 0; o < BPF; o++) { const a = probe.stateOffsetToAddr(o); if (a >= 0x8000 && a <= gameStateHi && !excl.has(a)) keep.push(o); }
  const n = Math.min(idi.length, tr.length);
  assert.equal(idi.length, tr.length, `${label}: frame counts differ (${idi.length} vs ${tr.length})`);
  for (let i = 0; i < n; i++) for (const o of keep) {
    if (idi[i][o] !== tr[i][o]) {
      assert.fail(`${label} frame ${i}: idiomatic diverged from translated at 0x${probe.stateOffsetToAddr(o).toString(16)} (${idi[i][o]} vs ${tr[i][o]})`);
    }
  }
}

test("coin+start tape: the game takes a credit and starts, idiomatic == translated", async () => {
  const overrides = await resolveAllIdiomatic();
  const idi = await play(overrides, "idle");
  const tr = await play(null, "idle");

  // The game RESPONDED to input (this is what a broken input path fails).
  assert.ok(idi.t.peakCredit >= 1, `no credit banked (peak ${idi.t.peakCredit})`);
  assert.equal(idi.t.startedAt, 464, `game did not start at the contract frame 464 (got ${idi.t.startedAt})`);
  assert.equal(idi.t.startedAt, tr.t.startedAt, "idiomatic and translated start the game on different frames");
  assert.equal(idi.t.peakCredit, tr.t.peakCredit, "credit count differs between idiomatic and translated");

  // ...and idiomatic reproduces the translated oracle through coin -> credit -> start -> in-game.
  assertGameStateIdentical(idi.frames, tr.frames, "coin+start");
});

test("dig tape: the player tunnels (PLAYER_X advances), idiomatic == translated", async () => {
  const overrides = await resolveAllIdiomatic();
  const idi = await play(overrides, "dig");
  const tr = await play(null, "dig");

  assert.equal(idi.t.startedAt, 464, `game did not start (got ${idi.t.startedAt})`);
  // Digging drives PLAYER_X forward — a real gameplay effect, not just a title screen.
  const advance = idi.t.maxPX - idi.t.minPX;
  assert.ok(advance >= 4, `player did not tunnel under the dig tape (PLAYER_X moved ${advance})`);
  assert.equal(idi.t.maxPX, tr.t.maxPX, "player reached a different PLAYER_X in idiomatic vs translated");

  assertGameStateIdentical(idi.frames, tr.frames, "dig");
});
