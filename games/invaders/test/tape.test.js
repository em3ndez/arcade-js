// SPDX-License-Identifier: GPL-3.0-only
//
// tape — invaders' standing whole-game GAMEPLAY gate. A coin/start/fire/move tape driven through the
// generator idiomatic layer (runIdiomaticGame), asserting the in-play seams run LIVE and non-vacuously
// and that the register-free layer never touches the guest stack.
//
// Why this differs from pooyan's tape.test.js (idiomatic == oracle byte-compare): invaders is a runbook
// model-(b) game — the vblank ISR (loc_0010) TAIL-DISPATCHES the game logic itself, which contains
// vblank-paced draw-waits (loc_088d spins on FRAME_DELAY_TIMER 0x20c0). So the frozen translated oracle
// CANNOT run clock-free gameplay under runCycleFree (the game logic runs inside the ISR, which can't nest
// to drain the timer — it deadlocks); only the idiomatic generator layer (function*/yield) plays through.
// The byte-exact GAMEPLAY-vs-MAME correctness check therefore lives in the pixel --done gate (idiomatic
// layer vs a MAME golden), NOT here — this standing test is the non-vacuity + SP-inert guard.
//
// Asserts: (1) the run reaches real gameplay (banks a credit, GAME_IN_PROGRESS set, the alien field is
// live); (2) the fire input drives a player shot (input reaches the in-play handlers); (3) SP stays INERT
// — the register-free idiomatic layer never moves the guest stack (the vblank NMI is a direct JS call,
// not a Z80 push/seam), including across the NMI subtree. ROM-guarded (skips without the BYO ROM).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import manifest from "../manifest.js";
import { CREDIT_COUNT, GAME_IN_PROGRESS, ALIEN_DRAW_PENDING, PLAYER_SHOT_STATUS } from "../idiomatic/names.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROM_PATH = join(HERE, "..", "rom", "maincpu.bin");
const HAVE_ROM = existsSync(ROM_PATH);
const ROM = HAVE_ROM ? new Uint8Array(readFileSync(ROM_PATH)) : null;

const FRAMES = 700; // coin@300, start@360, play from ~361, fire/move from 500 -> exercises the in-play seams
const { idiomatic } = manifest.convergence;
const { nmiReturnPC } = idiomatic;
const hex = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;
const brief = (xs) => (xs.length <= 6 ? xs.join("; ") : `${xs.slice(0, 6).join("; ")} … (${xs.length} in all)`);

// The tape in PRESSED-BIT form (io folds the active-low coin polarity), bits from manifest.inputs.actions.
// Periodic fire/move (immune to a 1-frame drift); each press releases itself (the assert is rebuilt/frame).
const A = manifest.inputs.actions;
function tapeInput(f) {
  const a = {};
  const press = (act) => { a[act.port] = (a[act.port] || 0) | act.bit; };
  if (f >= 300 && f < 306) press(A.coin);
  if (f >= 360 && f < 366) press(A.start1);
  if (f >= 500) {
    if (f % 24 < 4) press(A.fire);
    press(Math.floor(f / 40) % 2 ? A.left : A.right);
  }
  return a;
}

test("the coin/start/play tape drives real gameplay live, and the idiomatic layer keeps SP inert", { skip: !HAVE_ROM }, async () => {
  const overrides = await resolveAllIdiomatic();
  const m = new Machine(ROM, { overrides });

  // The register-free layer must never touch the guest stack — assert across the whole vblank NMI subtree.
  const nmiFaults = [];
  const realFire = m.fireNmi.bind(m);
  m.fireNmi = function () {
    const before = m.regs.sp;
    realFire();
    if (m.regs.sp !== before) nmiFaults.push(`${hex(before)} -> ${hex(m.regs.sp)}`);
  };

  const w = { peakCredit: 0, sawPlay: false, sawAliens: false, sawShot: false };
  const spFaults = [];
  let spSeat = null;
  const r = runIdiomaticGame(m, {
    bootAddr: 0x0000, nmiReturnPC, maxFrames: FRAMES,
    onFrame: (mm, f) => {
      if (f === 0) { spSeat = mm.regs.sp; return; } // power-on SP, before the boot generator runs
      mm.io.inputAssert = tapeInput(f);
      w.peakCredit = Math.max(w.peakCredit, mm.mem.read8(CREDIT_COUNT));
      if (mm.mem.read8(GAME_IN_PROGRESS) !== 0) w.sawPlay = true;
      if (mm.mem.read8(ALIEN_DRAW_PENDING) !== 0) w.sawAliens = true;
      if (mm.mem.read8(PLAYER_SHOT_STATUS) !== 0) w.sawShot = true;
      if (mm.regs.sp !== spSeat) spFaults.push(`frame ${f}: ${hex(spSeat)} -> ${hex(mm.regs.sp)}`);
    },
  });

  assert.equal(r.stopError, null, `idiomatic run errored: ${r.stop}`);
  assert.ok(r.frames >= FRAMES, `idiomatic run covered only ${r.frames}/${FRAMES} frames (${r.stop})`);

  // Non-vacuity — the tape actually reached and ran gameplay, or the SP-inert pass is worthless.
  assert.ok(w.peakCredit >= 1, `never banked a credit (peak ${w.peakCredit})`);
  assert.ok(w.sawPlay, "never set GAME_IN_PROGRESS (never reached in-play)");
  assert.ok(w.sawAliens, "the alien field never went live (ALIEN_DRAW_PENDING stayed 0)");
  assert.ok(w.sawShot, "the fire input never produced a player shot (input did not reach the in-play handlers)");

  // SP inert — the register-free idiomatic layer must never move the guest stack.
  assert.equal(spFaults.length, 0,
    `SP moved across a frame boundary — the register-free idiomatic layer must never touch the guest stack: ${brief(spFaults)}`);
  assert.equal(nmiFaults.length, 0, `the vblank NMI subtree changed SP: ${brief(nmiFaults)}`);
});
