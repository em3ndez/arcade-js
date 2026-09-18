// SPDX-License-Identifier: GPL-3.0-only
//
// STANDING WHOLE-GAME GATE for The Pit (the file done_gate.check_wholegame globs for at
// games/thepit/test/*.test.js). Modelled on games/frogger/test/idiomatic.test.js (a whole-MACHINE
// gate, NOT the per-routine equivalence suite in games/thepit/idiomatic/test/), but driving the
// IDIOMATIC layer through the clock-free generator engine (core/frame-stepped.js runIdiomaticGame),
// the same engine the browser go-live path uses. It runs the WHOLE idiomatic game once, from reset,
// under the pinned coin_start + dig input contract, and asserts whole-machine invariants a real
// regression would break (documented at each numbered assert below + the teeth note at the foot):
// this file). It is NOT an idiomatic-vs-oracle equivalence test — that half lives in idiomatic/test/.
// ROM-guarded: skips cleanly (BYO) when games/thepit/rom/maincpu.bin is absent, like frogger.

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveAllIdiomatic } from "../machine.js";
import manifest from "../manifest.js";
import { GAME_STATE, CREDIT_COUNT, PLAYER_X } from "../idiomatic/names.js";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";

const ROM_PATH = new URL("../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

// boot -> attract -> coin(402) -> start(462) -> in-game -> dig(480+). Same budget as the tape gate.
const FRAMES = 900;
const IN_PLAY = 1;          // GAME_STATE in-play value (attract demo is 4)
const START_CONTRACT = 464; // the pinned frame the game leaves attract for play under this tape
const { nmiReturnPC } = manifest.convergence.idiomatic;

// The pinned input contract (coin_start.lua, JS +2 mirror). IN1 @ 0xa800 ACTIVE HIGH: b0=Coin1,
// b2=Start1. IN0 @ 0xa000: physical bits the io layer inverts — b2=Down, b4=Dig.
function tapeInput(fi) {
  let in1 = 0;
  if (fi >= 402 && fi < 410) in1 |= 0x01; // Coin1
  if (fi >= 462 && fi < 470) in1 |= 0x04; // Start1
  let in0 = 0;
  if (fi >= 480) {
    in0 |= 0x04;                          // hold Down continuously
    if ((fi - 480) % 32 < 6) in0 |= 0x10; // pulse Dig every 32 frames, hold 6
  }
  return { 0xa000: in0, 0xa800: in1 };
}

// Drive the WHOLE idiomatic game once, from reset, under the tape. Sample the whole-machine telemetry
// the invariants need. An installGuard hook (used only by the teeth scratch, never in the repo run)
// can perturb the machine to prove the assertions can fail.
async function driveIdiomaticGame(installGuard) {
  const overrides = await resolveAllIdiomatic();
  const m = await Machine.create(ROM, { overrides });
  if (installGuard) installGuard(m);
  const t = { peakCredit: 0, startedAt: -1, minPX: 256, maxPX: -1 };
  const onFrame = (mm, fi) => {
    mm.io.inputAssert = tapeInput(fi);
    const credit = mm.mem.read8(CREDIT_COUNT);
    if (credit > t.peakCredit) t.peakCredit = credit;
    if (mm.mem.read8(GAME_STATE) === IN_PLAY && t.startedAt < 0) t.startedAt = fi;
    if (t.startedAt >= 0) {
      const px = mm.mem.read8(PLAYER_X);
      if (px < t.minPX) t.minPX = px;
      if (px > t.maxPX) t.maxPX = px;
    }
  };
  const r = runIdiomaticGame(m, { nmiReturnPC, maxFrames: FRAMES, onFrame });
  return { r, t };
}

test("the whole idiomatic game boots, takes a coin, starts, and plays (no translation gap)", async () => {
  const { r, t } = await driveIdiomaticGame(null);

  // (1) BOOT: the run reached the frame budget with no crash and no un-translated routine. A boot gap
  // surfaces as a NotImplemented stopError whose message carries the address to register (Step 3).
  assert.equal(
    r.stopError,
    null,
    `idiomatic run did not complete cleanly (stop=${r.stop}) — a translation gap or JS/board bug`,
  );
  assert.equal(r.stop, "reached maxFrames", `expected a full ${FRAMES}-frame run, got stop=${r.stop}`);
  assert.equal(r.frames, FRAMES, `expected ${FRAMES} frames, got ${r.frames}`);

  // (2) COIN accepted: a credit banked under the coin pulse (this is what a broken coin/input path fails).
  assert.ok(t.peakCredit >= 1, `no credit banked under the coin pulse (peak CREDIT_COUNT=${t.peakCredit})`);

  // (3) PLAY started: GAME_STATE left attract for the in-play value at the pinned contract frame.
  assert.equal(
    t.startedAt,
    START_CONTRACT,
    `game did not start (GAME_STATE never reached ${IN_PLAY} at the contract frame ${START_CONTRACT}; got ${t.startedAt})`,
  );

  // (4) GAMEPLAY advanced: under the dig tape the player tunnels — PLAYER_X moves. A title-screen-only
  // "boots but does nothing" regression leaves this at 0.
  const advance = t.maxPX - t.minPX;
  assert.ok(advance >= 4, `player did not tunnel under the dig tape (PLAYER_X moved ${advance})`);
});

// ── TEETH (null-mutant proof) ──────────────────────────────────────────────────────────────────
// This gate is proven falsifiable in games/thepit/test/scratch-teeth (a scratch copy, run out of tree
// — the repo idiomatic layer is never touched). driveIdiomaticGame's installGuard hook clamps a single
// cell and every named invariant trips:
//   • clamp CREDIT_COUNT writes to 0  -> invariant (2) FAILS: "no credit banked ... (peak CREDIT_COUNT=0)"
//   • clamp GAME_STATE writes of 1->0 -> invariant (3) FAILS: "game did not start ... got -1"
//   • freeze the PLAYER_X read to a const -> invariant (4) FAILS: "player did not tunnel ... (PLAYER_X moved 0)"
// A test that cannot fail under such a mutation is worse than none; this one does.
