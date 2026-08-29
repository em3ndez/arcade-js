// SPDX-License-Identifier: GPL-3.0-only
//
// tape — pooyan's whole-game GAMEPLAY gate: a coin/start/play input tape driven through the generator
// idiomatic layer (runIdiomaticGame) and the pure-translated oracle (runCycleFree) at the same frame
// boundary (0x021c, manifest.convergence). Attract gates never dispatch the in-play leaves, so this is
// the only standing check that the gameplay seams (fire/climb handlers, the object/HUD leaves reached
// only after START) run live and agree with the oracle. Both engines are clock-free and collapse the
// same idempotent iterations, so they stay frame-aligned — the comparison is direct, no reconverge shift.
// Asserts three things: (1) NON-VACUITY — both arms actually bank a credit, enter play, and move the
// player (a run that never started is a worthless pass); (2) SP stays inert — the register-free idiomatic
// layer never touches the guest stack (the vblank NMI is a direct JS call, not a Z80 push/seam); (3)
// idiomatic == oracle byte-for-byte on every live cell (dead stack scratch excluded). ROM-guarded (skips
// without the BYO ROM).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runIdiomaticGame, runCycleFree } from "../../../core/frame-stepped.js";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import manifest from "../manifest.js";
import { CREDIT_COUNT, MAIN_GAME_STATE, GAME_ACTIVE_FLAG, PLAYER_Y } from "../idiomatic/names.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROM_PATH = join(HERE, "..", "rom", "maincpu.bin");
const HAVE_ROM = existsSync(ROM_PATH);
const ROM = HAVE_ROM ? new Uint8Array(readFileSync(ROM_PATH)) : null;

const FRAMES = 1450; // reaches in-play (~f361) with room for the player to move under the tape
const PLAY_STATE = 3; // MAIN_GAME_STATE while in-play
const { pollPCs, stateExclude, idiomatic } = manifest.convergence;
const { nmiReturnPC } = idiomatic;
const [STACK_LO, STACK_HI] = stateExclude.stack;
const hex = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;
const brief = (xs) => (xs.length <= 6 ? xs.join("; ") : `${xs.slice(0, 6).join("; ")} … (${xs.length} in all)`);

// The tape in PRESSED-BIT form (io folds the active-low polarity), bits from manifest.inputs.actions:
// coin, then 1P start, then in-play shoot (period 24) + climb (up/down oscillate) — periodic, so it is
// immune to a 1-frame drift. Rebuilt each frame, so a press releases itself.
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

/** Non-vacuity witness: did this arm bank a credit, enter play, and move the player? */
function newResp() { return { peakCredit: 0, sawPlay: false, sawActive: false, py: new Set() }; }
function track(r, m, f) {
  const c = m.mem.read8(CREDIT_COUNT);
  if (c > r.peakCredit) r.peakCredit = c;
  if (m.mem.read8(MAIN_GAME_STATE) === PLAY_STATE) r.sawPlay = true;
  if (m.mem.read8(GAME_ACTIVE_FLAG) !== 0) r.sawActive = true;
  if (f >= 420) r.py.add(m.mem.read8(PLAYER_Y)); // in-play window
}
function assertReached(r, who) {
  assert.ok(r.peakCredit >= 1, `${who} never banked a credit (peak ${r.peakCredit})`);
  assert.ok(r.sawPlay, `${who} never reached MAIN_GAME_STATE=${PLAY_STATE} (in-play)`);
  assert.ok(r.sawActive, `${who} never set GAME_ACTIVE_FLAG`);
  assert.ok(r.py.size >= 2, `${who} player never moved (PLAYER_Y stayed ${[...r.py].join("/")})`);
}

test("the coin/start/play tape drives real gameplay and idiomatic == oracle through it", { skip: !HAVE_ROM }, async () => {
  const overrides = await resolveAllIdiomatic();
  assert.ok(overrides.has(0x020f), "mainLoop must be wired at the main-loop entry");

  // Idiomatic arm — the generator layer, wired exactly as the worker ships it.
  const mi = new Machine(ROM, { overrides });
  const nmiFaults = [];
  const realFire = mi.fireNmi.bind(mi);
  mi.fireNmi = function () {
    const before = mi.regs.sp;
    realFire();
    if (mi.regs.sp !== before) nmiFaults.push(`${hex(before)} -> ${hex(mi.regs.sp)}`);
  };
  const idi = [], respI = newResp();
  let prevSp = null;
  const spFaults = [];
  const ri = runIdiomaticGame(mi, {
    bootAddr: 0x0000, nmiReturnPC, maxFrames: FRAMES,
    onFrame: (m, f) => {
      if (f === 0) return; // power-on sample, before the boot generator runs
      m.io.inputAssert = tapeInput(f);
      idi.push(Buffer.from(m.dumpState()));
      track(respI, m, f);
      const sp = m.regs.sp;
      if (prevSp !== null && sp !== prevSp) spFaults.push(`frame ${f}: ${hex(prevSp)} -> ${hex(sp)}`);
      prevSp = sp;
    },
  });
  assert.equal(ri.stopError, null, `idiomatic run errored: ${ri.stop}`);
  assert.ok(ri.frames >= FRAMES, `idiomatic run covered only ${ri.frames}/${FRAMES} frames (${ri.stop})`);
  assert.equal(spFaults.length, 0,
    `SP moved across a frame boundary — the register-free idiomatic layer must never touch the guest stack: ${brief(spFaults)}`);
  assert.equal(nmiFaults.length, 0, `the vblank NMI subtree changed SP: ${brief(nmiFaults)}`);

  // Translated oracle under runCycleFree, same tape at the same main-loop boundary.
  const mt = new Machine(ROM, {});
  const tr = [], respT = newResp();
  const rt = runCycleFree(mt, {
    pollPCs, maxFrames: FRAMES, stepBudget: FRAMES * 200000,
    onFrame: (m, f) => {
      if (f === 0) return;
      m.io.inputAssert = tapeInput(f);
      tr.push(Buffer.from(m.dumpState()));
      track(respT, m, f);
    },
  });
  assert.equal(rt.stopError, null, `translated oracle run errored: ${rt.stop}`);
  assert.equal(idi.length, tr.length, "frame counts differ between the wired layer and the oracle");

  // Non-vacuity: BOTH arms must actually play, or byte-equality is a worthless match on attract.
  assertReached(respI, "idiomatic");
  assertReached(respT, "oracle");

  // Every LIVE cell must match byte-for-byte (identical collapsed sequence, no entropy pin needed).
  const keep = liveOffsets(tr[0].length, mt);
  assert.ok(keep.length > 0, "no live-state bytes selected to compare");
  for (let i = 0; i < idi.length; i++) {
    for (const o of keep) {
      if (idi[i][o] !== tr[i][o]) {
        assert.fail(`frame ${i}: wired layer diverged from oracle at ${hex(mt.stateOffsetToAddr(o))} ` +
          `(idiomatic ${idi[i][o]} vs oracle ${tr[i][o]})`);
      }
    }
  }
});
