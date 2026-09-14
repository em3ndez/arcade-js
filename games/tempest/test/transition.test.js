// SPDX-License-Identifier: GPL-3.0-only
//
// transition -- tempest's standing whole-game TRANSITION gate (runbook §5): a forced state transition the
// base tapes never reach. Here: ATTRACT -> live PLAY -> GAME-OVER -> back to ATTRACT, the full arc. A
// coin/start drops the game into a live 1-player game (STATUS_FLAGS 0x05 bit7 0->1); then a PASSIVE player
// (no aim, no fire after the entry) is overrun -- lives drain and the game returns to attract (bit7 1->0).
// This exercises the life-loss/respawn and game-over paths, which the coin/start/play tape (test/tape.test.js)
// does not reach. The transition is driven by the ROM's own logic (lives running out), not a poked state --
// poking LEVEL_ID/GAME_MODE mid-play hangs the handler (it needs valid setup), so the natural death path is
// the honest trigger.
//
// NULL-MUTANT tooth: with NO coin the game never enters play, so the play->game-over arc cannot happen --
// proving the arc is a real driven transition, not the attract demo cycling on its own. ROM-guarded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import { runIdiomaticIrqGame } from "../../../core/frame-stepped.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROMDIR = join(HERE, "..", "rom");
const HAVE_ROM = ["maincpu.bin", "vectorrom.bin", "avgprom.bin"].every((f) => existsSync(join(ROMDIR, f)));
const rom = (f) => new Uint8Array(readFileSync(join(ROMDIR, f)));

const BOOT_ADDR = 0xd93f;
const IRQ_VBLANK = [0, 0, 0, 0, 0, 0, 0, 0, 0];
const FRAMES = 900;              // game-over is reached ~f627 from a passive death; leave margin
const STATUS = 0x05;             // bit7 = play/active

// coin + start + two skill-select fires to commit the wave; then NO further input (passive player dies).
const INPUTS = [
  { port: 0, bits: 0x04, frame: 30, dur: 15 },
  { port: 2, bits: 0x20, frame: 70, dur: 20 },
  { port: 2, bits: 0x10, frame: 150, dur: 12 },
  { port: 2, bits: 0x10, frame: 180, dur: 12 },
];

function applyInputs(mm, f, drop = {}) {
  const bits = {};
  for (const t of INPUTS) {
    if (!(f >= t.frame && f < t.frame + t.dur)) continue;
    if (drop.coin && t.port === 0 && t.bits === 0x04) continue;
    bits[t.port] = (bits[t.port] || 0) | t.bits;
  }
  mm.io.inputAssert = bits;
}

async function drive(drop = {}) {
  const overrides = await resolveAllIdiomatic();
  const m = new Machine(rom("maincpu.bin"), { overrides, vectorrom: rom("vectorrom.bin"), avgprom: rom("avgprom.bin") });
  const w = { enteredPlayF: -1, gameOverF: -1 };
  let wasPlaying = false;
  const res = runIdiomaticIrqGame(m, {
    bootAddr: BOOT_ADDR, irqVblank: IRQ_VBLANK, maxFrames: FRAMES,
    onFrame: (mm, f) => {
      if (f === 0) return;
      applyInputs(mm, f, drop);
      const playing = (mm.mem.read8(STATUS) & 0x80) !== 0;
      if (playing && !wasPlaying && w.enteredPlayF < 0) w.enteredPlayF = f;
      // game-over = leaving play at least 30f after entering it (not the pre-start attract sample).
      if (!playing && wasPlaying && w.enteredPlayF > 0 && f > w.enteredPlayF + 30 && w.gameOverF < 0) w.gameOverF = f;
      wasPlaying = playing;
    },
  });
  w.stop = res.stop; w.frames = res.frames; w.stopError = res.stopError;
  return w;
}

test("forced transition: attract -> play -> game-over (lives drain, returns to attract)", { skip: !HAVE_ROM }, async () => {
  const w = await drive();
  assert.equal(w.stopError, null, `idiomatic run errored: ${w.stop}`);
  assert.ok(w.enteredPlayF > 0, "coin/start never entered a live game (STATUS bit7 never set)");
  assert.ok(w.gameOverF > 0, `the passive player never game-overed within ${FRAMES} frames (entered play at f${w.enteredPlayF})`);
  assert.ok(w.gameOverF > w.enteredPlayF, `game-over (f${w.gameOverF}) not after play entry (f${w.enteredPlayF})`);
});

// NULL-MUTANT: drop the coin -> the game never enters play, so the play->game-over transition cannot occur.
// Proves the transition is a real driven arc, not the attract demo cycling on its own.
test("null-mutant: drop the coin -> no play, hence no play->game-over transition", { skip: !HAVE_ROM }, async () => {
  const w = await drive({ coin: true });
  assert.equal(w.stopError, null, `run errored: ${w.stop}`);
  assert.equal(w.enteredPlayF, -1, "with no coin the game still entered play -- the transition is vacuous");
  assert.equal(w.gameOverF, -1, "with no coin a play->game-over transition still occurred -- vacuous");
});
