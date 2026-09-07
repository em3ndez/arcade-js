// SPDX-License-Identifier: GPL-3.0-only
//
// tape — galaxian's standing whole-game GAMEPLAY gate. A coin/start/fire/move tape driven through the
// generator idiomatic layer (runIdiomaticGame), asserting the in-play seams run LIVE and non-vacuously and
// that the register-free born-live layer never touches the guest stack.
//
// Byte-exact GAMEPLAY-vs-MAME correctness lives in the pixel --done gate (idiomatic layer vs a MAME golden),
// NOT here — this standing test is the non-vacuity + SP-inert guard. SP-inert is load-bearing: the born-live
// object-grid walk once leaked +2 SP/drawn frame via an unmatched terminal ret (real-HW SP stays balanced),
// which this gate would have caught; see games/galaxian/idiomatic/test/objectgrid-sp-inert.test.js.
//
// Asserts: (1) the run reaches real gameplay (banks a credit, GAME_STATE hits the play index 3, the object
// subsystem goes live); (2) the fire input arms the player-shot gate (input reaches the in-play handlers);
// (3) SP stays INERT once in play — the register-free layer never moves the guest stack. ROM-guarded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import manifest from "../manifest.js";
import { loc_4002 as CREDIT_COUNT, GAME_STATE, OBJ_ACTIVE_FLAG, loc_4208 as PLAYER_SHOT_GATE } from "../idiomatic/names.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROM_PATH = join(HERE, "..", "rom", "maincpu.bin");
const HAVE_ROM = existsSync(ROM_PATH);
const ROM = HAVE_ROM ? new Uint8Array(readFileSync(ROM_PATH)) : null;

const FRAMES = 520;      // coin@182, start@240, play from ~247, fire/move from 360 -> exercises the in-play seams
const PLAY_STATE = 3;    // GAME_STATE index for a live 1-player round (0 boot, 1 attract, 2 credit, 3 play)
const { idiomatic } = manifest.convergence;
const { nmiReturnPC } = idiomatic;
const hex = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;
const brief = (xs) => (xs.length <= 6 ? xs.join("; ") : `${xs.slice(0, 6).join("; ")} … (${xs.length} in all)`);

// The tape in PRESSED-BIT form. manifest action ports ARE the io.inputAssert indices (0/1/2, boards/galaxian/io.js).
const A = manifest.inputs.actions;
function tapeInput(f) {
  const a = {};
  const press = (act) => { a[act.port] = (a[act.port] || 0) | act.bit; };
  if (f >= 182 && f < 190) press(A.coin);
  if (f >= 240 && f < 248) press(A.start1);
  if (f >= 360) {
    if (f % 24 < 6) press(A.fire);
    press(Math.floor(f / 40) % 2 ? A.left : A.right);
  }
  return a;
}

test("the coin/start/play tape drives real gameplay live, and the born-live layer keeps SP inert", { skip: !HAVE_ROM }, async () => {
  const overrides = await resolveAllIdiomatic();
  const m = new Machine(ROM, { overrides });

  const w = { peakCredit: 0, sawPlay: false, sawObjActive: false, sawShot: false };
  const spFaults = [];
  let spSeat = null; // seated at the first in-play frame; the register-free layer must hold it from there
  const r = runIdiomaticGame(m, {
    bootAddr: 0x0000, nmiReturnPC, maxFrames: FRAMES,
    onFrame: (mm, f) => {
      if (f === 0) return; // power-on sample, before the boot generator seats SP
      mm.io.inputAssert = tapeInput(f);
      w.peakCredit = Math.max(w.peakCredit, mm.mem.read8(CREDIT_COUNT));
      const inPlay = mm.mem.read8(GAME_STATE) === PLAY_STATE;
      if (inPlay) w.sawPlay = true;
      if (mm.mem.read8(OBJ_ACTIVE_FLAG) & 1) w.sawObjActive = true;
      if (mm.mem.read8(PLAYER_SHOT_GATE) & 1) w.sawShot = true;
      if (inPlay) {
        if (spSeat === null) spSeat = mm.regs.sp;
        else if (mm.regs.sp !== spSeat) spFaults.push(`frame ${f}: ${hex(spSeat)} -> ${hex(mm.regs.sp)}`);
      }
    },
  });

  assert.equal(r.stopError, null, `idiomatic run errored: ${r.stop}`);
  assert.ok(r.frames >= FRAMES, `idiomatic run covered only ${r.frames}/${FRAMES} frames (${r.stop})`);

  // Non-vacuity — the tape actually reached and ran gameplay, or the SP-inert pass is worthless.
  assert.ok(w.peakCredit >= 1, `never banked a credit (peak ${w.peakCredit})`);
  assert.ok(w.sawPlay, `never reached the play state (GAME_STATE never == ${PLAY_STATE})`);
  assert.ok(w.sawObjActive, "the object subsystem never went live (OBJ_ACTIVE_FLAG bit0 stayed 0)");
  assert.ok(w.sawShot, "the fire input never armed the player-shot gate (input did not reach the in-play handlers)");

  // SP inert — the register-free born-live layer must never move the guest stack once in play.
  assert.equal(spFaults.length, 0,
    `SP moved across a frame boundary — the register-free layer must never touch the guest stack: ${brief(spFaults)}`);
});
