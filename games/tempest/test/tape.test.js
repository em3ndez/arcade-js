// SPDX-License-Identifier: GPL-3.0-only
//
// tape -- tempest's standing whole-game GAMEPLAY gate (runbook §5). A coin/start/PLAY tape
// (tapes/coin_start_play.json) is replayed through the shipped clock-free IDIOMATIC engine
// (runIdiomaticIrqGame) and asserts the game RESPONDS non-vacuously at each stage:
//   (1) COIN gates START -- with the coin the run reaches live play; the null-mutant (drop the coin)
//       proves it, because start then NEVER reaches play (tempest's credit cell is unnamed, so the coin
//       is witnessed by its FUNCTIONAL effect -- it is what lets start take -- rather than a raw counter);
//   (2) START leaves the attract demo into a live game: STATUS_FLAGS(0x05) bit7 goes 0->1. (The attract
//       demo runs the same visual modes with bit7 CLEAR, so bit7 is the play discriminator, not the mode.)
//   (3) the spinner ROTATES the Blaster: SPINNER_ACCUM(0x50) rises off 0 and PLAYER_SEGMENT(0x200) sweeps;
//   (4) FIRE launches a shot: PLAYER_SHOT_DEPTH(0x202) leaves its 0x10 rim seed.
// Each witness carries a NULL-MUTANT tooth: dropping that one input class makes the witness fail, so a
// vacuous pass is impossible. Witnesses were derived empirically by driving this tape (both the value
// change AND its disappearance under the drop are asserted). ROM-guarded (skips cleanly without BYO ROM).
//
// Scope note: byte-exact-vs-MAME gameplay is the drift-tolerant reconverge gate (tools/convergence.mjs
// against a MAME golden); this standing test is the input-RESPONSE + non-vacuity guard.
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
const TAPE = JSON.parse(readFileSync(join(HERE, "..", "tapes", "coin_start_play.json"), "utf8"));

const BOOT_ADDR = 0xd93f;                          // manifest convergence.idiomatic.irq.bootAddr (RESET generator)
const IRQ_VBLANK = [0, 0, 0, 0, 0, 0, 0, 0, 0];    // nine IRQ slots per game-update, all 0 (headless golden)
const FRAMES = 400;

const STATUS = 0x05;           // bit7 = play/active (0 in attract demo, 1 in a live game)
const SPINNER_ACCUM = 0x50;    // accumulated spinner delta (rotary encoder)
const PLAYER_SEGMENT = 0x200;  // player Blaster rim segment (driven by the spinner)
const PLAYER_SHOT_DEPTH = 0x202; // player shot depth; 0x10 rim seed, leaves it when a shot is live
const SHOT_SEED = 0x10;
const ATTRACT_F = 60;          // sample attract (bit7==0) here, before start takes at ~f71
const COMBAT_F = 200;          // fire/spinner witnesses sampled from here (real combat is reached ~f160+)

// Fold one frame of the tape into the machine, mirroring render.js/applyInputs semantics. `drop` lets the
// null-mutant harness suppress one input class; the shipped gate calls with drop = {}.
function applyTape(mm, f, drop = {}) {
  const bits = {};
  for (const t of TAPE.inputs) {
    if (!(f >= t.frame && f < t.frame + t.dur)) continue;
    if (drop.coin && t.port === 0 && t.bits === 0x04) continue;
    if (drop.start && t.port === 2 && t.bits === 0x20) continue;
    if (drop.fire && t.port === 2 && t.bits === 0x10) continue;
    bits[t.port] = (bits[t.port] || 0) | t.bits;
  }
  mm.io.inputAssert = bits;
  for (const s of TAPE.spinner || []) {
    if (drop.spinner) continue;
    if (f >= s.frame && f < s.frame + s.dur) mm.io.applyTrackball(0, s.delta & 0xff);
  }
}

async function driveIdiomatic(drop = {}) {
  const overrides = await resolveAllIdiomatic();
  const m = new Machine(rom("maincpu.bin"), { overrides, vectorrom: rom("vectorrom.bin"), avgprom: rom("avgprom.bin") });
  const w = { sawAttract: false, sawPlay: false, spinMax: 0, segMin: 255, segMax: 0, shotLeftSeed: false };
  const res = runIdiomaticIrqGame(m, {
    bootAddr: BOOT_ADDR, irqVblank: IRQ_VBLANK, maxFrames: FRAMES,
    onFrame: (mm, f) => {
      if (f === 0) return;               // power-on sample, before the boot generator runs
      applyTape(mm, f, drop);
      const playing = (mm.mem.read8(STATUS) & 0x80) !== 0;
      if (f === ATTRACT_F && !playing) w.sawAttract = true;
      if (playing) w.sawPlay = true;
      if (f >= COMBAT_F) {
        w.spinMax = Math.max(w.spinMax, mm.mem.read8(SPINNER_ACCUM));
        const seg = mm.mem.read8(PLAYER_SEGMENT);
        w.segMin = Math.min(w.segMin, seg); w.segMax = Math.max(w.segMax, seg);
        if (mm.mem.read8(PLAYER_SHOT_DEPTH) !== SHOT_SEED) w.shotLeftSeed = true;
      }
    },
  });
  w.finalPlaying = (m.mem.read8(STATUS) & 0x80) !== 0;
  w.stop = res.stop; w.frames = res.frames; w.stopError = res.stopError;
  return w;
}

const hex = (v) => `0x${(v & 0xff).toString(16).padStart(2, "0")}`;

test("coin/start/play tape drives real gameplay: into-play, spinner, fire all respond", { skip: !HAVE_ROM }, async () => {
  const w = await driveIdiomatic();
  assert.equal(w.stopError, null, `idiomatic run errored: ${w.stop}`);
  assert.ok(w.frames >= FRAMES, `idiomatic run covered only ${w.frames}/${FRAMES} frames (${w.stop})`);

  // (2) START RESPONSE -- was in the attract demo, then start took it into a live game (bit7 0->1).
  assert.ok(w.sawAttract, `never observed the attract demo (STATUS bit7 not 0 at f${ATTRACT_F}) -- start would be vacuous`);
  assert.ok(w.sawPlay, "start never took the game into play (STATUS bit7 never set)");
  assert.ok(w.finalPlaying, "not in a live game at the end (STATUS bit7 clear)");

  // (3) SPINNER RESPONSE -- the dial raised the accumulator and swept the Blaster segment.
  assert.ok(w.spinMax > 0, `spinner never accumulated (SPINNER_ACCUM stayed 0)`);
  assert.ok(w.segMax - w.segMin >= 4, `spinner never swept the Blaster (PLAYER_SEGMENT ${hex(w.segMin)}..${hex(w.segMax)})`);

  // (4) FIRE RESPONSE -- a shot went live (depth left its rim seed).
  assert.ok(w.shotLeftSeed, `fire never launched a shot (PLAYER_SHOT_DEPTH stayed at the ${hex(SHOT_SEED)} seed)`);
});

// NULL-MUTANT TEETH -- dropping one input class must make its witness FAIL. A check never seen failing is
// decoration; these prove each assertion above is load-bearing (and that the tape is non-vacuous).
test("null-mutant: drop the COIN -> start can no longer reach play (coin gates start)", { skip: !HAVE_ROM }, async () => {
  const w = await driveIdiomatic({ coin: true });
  assert.equal(w.stopError, null, `run errored: ${w.stop}`);
  assert.ok(!w.sawPlay, "with no coin the game still reached play -- the coin witness is vacuous");
});

test("null-mutant: drop START -> the game never leaves the attract demo", { skip: !HAVE_ROM }, async () => {
  const w = await driveIdiomatic({ start: true });
  assert.equal(w.stopError, null, `run errored: ${w.stop}`);
  assert.ok(!w.sawPlay, "with no start the game still reached play -- the start witness is vacuous");
});

test("null-mutant: drop the SPINNER -> the Blaster does not rotate", { skip: !HAVE_ROM }, async () => {
  const w = await driveIdiomatic({ spinner: true });
  assert.equal(w.stopError, null, `run errored: ${w.stop}`);
  assert.ok(w.spinMax === 0 && w.segMax - w.segMin < 4,
    `with no spinner the Blaster still moved (SPINNER_ACCUM ${hex(w.spinMax)}, PLAYER_SEGMENT ${hex(w.segMin)}..${hex(w.segMax)}) -- the spinner witness is vacuous`);
});

test("null-mutant: drop FIRE -> no shot is launched", { skip: !HAVE_ROM }, async () => {
  const w = await driveIdiomatic({ fire: true });
  assert.equal(w.stopError, null, `run errored: ${w.stop}`);
  assert.ok(!w.shotLeftSeed, "with no fire a shot still went live -- the fire witness is vacuous");
});
