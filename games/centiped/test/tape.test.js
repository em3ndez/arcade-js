// SPDX-License-Identifier: GPL-3.0-only
//
// tape — centiped's standing whole-game GAMEPLAY gate (runbook §5). A coin/start/PLAY tape
// (tapes/coin_start_play.json) is replayed through the clock-free IDIOMATIC engine (runIdiomaticIrqGame,
// the shipped runtime), asserting the game RESPONDS non-vacuously at each stage:
//   (1) a coin banks a credit ($c8 0->1);
//   (2) 1P start LEAVES ATTRACT into a live 1-player game ($89 0->1, $86 0xff->0) and CONSUMES the credit;
//   (3) the analog trackball MOVES the shooter ($62, the player X coord, sweeps off its 0x80 centre);
//   (4) the fire button LAUNCHES a dart (the shot cell $72 leaves its 0x0c seed).
// A companion test replays the SAME tape through the translated ORACLE (cycle-driven) and asserts the two
// layers AGREE on the deterministic coin/start response cells through the sequence.
//
// Scope note (why no byte-exact vs-MAME here): centiped's attract self-play and its trackball integrator
// are RNG- and read-timing-sensitive, so the clock-free idiomatic layer and the cycle-driven oracle only
// stay byte-identical when MAME's $100a POKEY-RANDOM stream is replayed into both under a drift-tolerant
// reconverge — which is exactly what games/centiped/tools/convergence.mjs does against a MAME golden. That
// is the authoritative gameplay-vs-MAME correctness gate; this standing test is the input-RESPONSE +
// non-vacuity guard, and cross-checks the two layers only on the deterministic (input-driven) responses.
// ROM-guarded (skips cleanly without the BYO ROM).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import { runIdiomaticIrqGame } from "../../../core/frame-stepped.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROM_PATH = join(HERE, "..", "rom", "maincpu.bin");
const GFX_PATH = join(HERE, "..", "rom", "gfx1.bin");
const HAVE_ROM = existsSync(ROM_PATH) && existsSync(GFX_PATH);
const ROM = HAVE_ROM ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const GFX = HAVE_ROM ? new Uint8Array(readFileSync(GFX_PATH)) : null;
const TAPE = JSON.parse(readFileSync(join(HERE, "..", "tapes", "coin_start_play.json"), "utf8"));

const IRQ_VBLANK = [0, 0, 0, 1]; // per-slot io.vblank for the four 32V IRQs; only scanline 240 is in vblank
const FRAMES = 720;
const hex = (v) => `0x${(v & 0xff).toString(16).padStart(2, "0")}`;

// Grounded gameplay cells (empirically derived by driving this tape and cross-checked between the two
// layers; see the exploration in the DONE report). All live in low work RAM (in dumpState).
const CREDITS = 0xc8;     // credit counter: +1 per coin, consumed by 1P start
const PLAYER_ACTIVE = 0x89; // 0 in attract, 1 once a live 1-player game is running
const GAME_STATE = 0x86;    // 0xff in attract, 0 during a live round (a wrapping round/life counter)
const PLAYER_X = 0x62;      // shooter X coordinate; 0x80 centre seed, driven by the trackball
const SHOT_CELL = 0x72;     // player-shot start/position; 0x0c seed, leaves it only when a dart is live
const PLAYER_X_SEED = 0x80;
const SHOT_SEED = 0x0c;

// Apply one frame of the tape into the idiomatic machine, mirroring Machine.applyInputs semantics. `drop`
// lets the null-mutant harness suppress one input class; the shipped gate always calls with drop = {}.
function applyTape(mm, f, drop = {}) {
  const bits = {};
  for (const t of TAPE) {
    const due = f >= t.frame && (t.dur == null || f < t.frame + t.dur);
    if (!due) continue;
    if (t.track) {
      if (!drop.track) mm.io.applyTrackball(t.track[0], t.track[1]);
      continue;
    }
    if (drop.coin && t.bits === 0x20) continue;
    if (drop.start && t.bits === 0x01) continue;
    if (drop.fire && t.bits === 0x04) continue;
    bits[t.port] = (bits[t.port] || 0) | t.bits;
  }
  mm.io.inputAssert = bits;
}

// Drive the tape through the idiomatic engine, gathering the response witnesses.
async function driveIdiomatic(drop = {}) {
  const overrides = await resolveAllIdiomatic();
  const m = new Machine(ROM, { gfx1: GFX, overrides });
  const w = {
    peakCredit: 0, sawAttract: false, sawPlay: false,
    finalPlayer: null, finalState: null, finalCredit: null,
    playerXMax: 0, playerXMin: 255, shotValues: new Set(),
  };
  const res = runIdiomaticIrqGame(m, {
    bootAddr: 0x3b04, irqVblank: IRQ_VBLANK, maxFrames: FRAMES,
    onFrame: (mm, f) => {
      if (f === 0) return; // power-on sample, before the boot generator runs
      applyTape(mm, f, drop);
      w.peakCredit = Math.max(w.peakCredit, mm.mem.read8(CREDITS));
      // attract witness must be sampled BEFORE start takes (start window opens at frame 380).
      if (f === 350 && mm.mem.read8(PLAYER_ACTIVE) === 0) w.sawAttract = true;
      if (mm.mem.read8(PLAYER_ACTIVE) === 1) w.sawPlay = true;
      if (f >= 470) {
        const x = mm.mem.read8(PLAYER_X);
        if (x > w.playerXMax) w.playerXMax = x;
        if (x < w.playerXMin) w.playerXMin = x;
        w.shotValues.add(mm.mem.read8(SHOT_CELL));
      }
    },
  });
  w.finalPlayer = m.mem.read8(PLAYER_ACTIVE);
  w.finalState = m.mem.read8(GAME_STATE);
  w.finalCredit = m.mem.read8(CREDITS);
  w.stop = res.stop; w.frames = res.frames; w.stopError = res.stopError;
  return { m, w };
}

test("the coin/start/play tape drives real gameplay: credit, into-play, move, fire — all respond", { skip: !HAVE_ROM }, async () => {
  const { w } = await driveIdiomatic();
  assert.equal(w.stopError, null, `idiomatic run errored: ${w.stop}`);
  assert.ok(w.frames >= FRAMES, `idiomatic run covered only ${w.frames}/${FRAMES} frames (${w.stop})`);

  // (1) COIN RESPONSE — a credit was banked.
  assert.ok(w.peakCredit >= 1, `coin never banked a credit ($${CREDITS.toString(16)} peaked at ${w.peakCredit})`);

  // (2) START RESPONSE — the run was in attract, then start took it into a live 1-player game, and the
  //     credit was consumed. sawAttract proves the transition is non-vacuous (it started from attract).
  assert.ok(w.sawAttract, "never observed attract before start ($89 was not 0 at frame 350) — start would be vacuous");
  assert.ok(w.sawPlay, "start never took the game into play ($89 never became 1)");
  assert.equal(w.finalPlayer, 1, `not in a 1-player game at the end ($89=${w.finalPlayer})`);
  assert.equal(w.finalState, 0, `game state not the in-play value at the end ($86=${hex(w.finalState)}, want 0x00)`);
  assert.equal(w.finalCredit, 0, `start did not consume the banked credit ($${CREDITS.toString(16)}=${w.finalCredit})`);

  // (3) PLAY RESPONSE — the trackball swept the shooter well off its centre seed.
  assert.ok(w.playerXMax - PLAYER_X_SEED >= 40,
    `the trackball never moved the shooter ($62 peaked at ${hex(w.playerXMax)}, seed ${hex(PLAYER_X_SEED)})`);

  // (4) FIRE RESPONSE — the fire button launched a dart (the shot cell left its seed value).
  assert.ok(w.shotValues.size > 1 || !w.shotValues.has(SHOT_SEED),
    `the fire input never launched a shot ($72 held only its ${hex(SHOT_SEED)} seed)`);
});

// Cross-layer: the SAME tape through the translated oracle (cycle-driven). The two layers agree on the
// deterministic, input-driven response cells through the sequence (credit banked in attract, then a live
// 1-player game). RNG/trackball-timing-sensitive cells (e.g. $62) are NOT compared here — that is the
// drift-tolerant, RNG-pinned job of convergence.mjs.
test("idiomatic and translated-oracle layers agree on the coin/start response through the tape", { skip: !HAVE_ROM }, async () => {
  const { w } = await driveIdiomatic();
  assert.ok(w.sawPlay, "idiomatic layer never reached play — cross-check would be vacuous");

  const om = new Machine(ROM, { gfx1: GFX });
  om.inputTape = TAPE;
  const oframes = om.runFrames(FRAMES);
  assert.equal(om.stoppedBy, null, `oracle did not run clean: ${om.stoppedBy && (om.stoppedBy.message || om.stoppedBy)}`);
  assert.ok(oframes.length >= FRAMES, `oracle produced only ${oframes.length}/${FRAMES} frames`);

  // Re-run the idiomatic layer capturing the same checkpoints, so we compare frame-for-frame.
  const overrides = await resolveAllIdiomatic();
  const im = new Machine(ROM, { gfx1: GFX, overrides });
  const isnap = {};
  const CHECKS = [350, 450, 500];
  runIdiomaticIrqGame(im, {
    bootAddr: 0x3b04, irqVblank: IRQ_VBLANK, maxFrames: FRAMES,
    onFrame: (mm, f) => { if (f === 0) return; applyTape(mm, f); if (CHECKS.includes(f)) isnap[f] = mm.mem.dumpState(); },
  });

  const CELLS = [CREDITS, PLAYER_ACTIVE, GAME_STATE];
  for (const f of CHECKS) {
    for (const a of CELLS) {
      const iv = isnap[f][a], ov = oframes[f][a];
      assert.equal(iv, ov, `layers disagree at frame ${f}, cell ${hex(a)}: idiomatic=${hex(iv)} oracle=${hex(ov)}`);
    }
  }
  // Non-vacuity: the checkpoints actually straddle the transition (attract at 350, play at 450+).
  assert.equal(oframes[350][PLAYER_ACTIVE], 0, "oracle was not in attract at frame 350 — cross-check is vacuous");
  assert.equal(oframes[450][PLAYER_ACTIVE], 1, "oracle was not in play at frame 450 — cross-check is vacuous");
  assert.ok(oframes[350][CREDITS] >= 1, "oracle had no banked credit at frame 350 — cross-check is vacuous");
});
