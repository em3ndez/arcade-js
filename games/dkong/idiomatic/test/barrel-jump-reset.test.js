// SPDX-License-Identifier: GPL-3.0-only
// Regression: jumping OVER a barrel reset Donkey Kong. Clearing a barrel latches the jump-over
// award tier (EFFECT_SELECT bit0, EFFECT_STATE=1); the next frame's state-1 handler tail-jumps into
// translated loc_1e28, whose guest `ret` (ROM 0x1E49) needs the effect state machine's call bracket.
// The idiomatic callers had dissolved it to a plain call, so that `ret` popped a live NMI-frame
// word: +2 guest-SP, SP walked into 0x6C00, "unmapped read" -> reboot to attract. The fix restores
// `m.push16(RET); m.call(0x1dbd)` at the three callers. The pinned-attract SP gate missed it (its
// demo never jumps a barrel); the UNPINNED demo does, at frame 3355 (test 1).

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveAllIdiomatic } from "../../machine.js";
import manifest from "../../manifest.js";
import { runIdiomaticGame } from "../../../../core/frame-stepped.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const { nmiReturnPC } = manifest.convergence.idiomatic;
const hex = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;

const EFFECT_STATE = 0x6340; // 0 idle / 1 arm (a hit or jump-over) / 2 display countdown
const EFFECT_SELECT = 0x6342; // low-bit thermometer; bit0 set == the jump-over award tier path
const IN_PLAY = 0x6200; // non-zero once a credited game is running

// The UNPINNED attract demo first jumps over a barrel at this frame; run a little past it.
const JUMP_OVER_FRAME = 3355;
const ATTRACT_FRAMES = JUMP_OVER_FRAME + 250;

test("the attract demo jumping over a barrel does not reset the game (guest SP stays balanced)", async () => {
  // The shipped config (resolveAllIdiomatic, as web/worker.js wires) with NO entropy pin — the pinned demo never jumps a barrel.
  const mi = new Machine(ROM, { overrides: await resolveAllIdiomatic() });

  let prevSp = null;
  const spFaults = [];
  let jumpOverArmed = false; // positive control: the demo really did reach the state-1 handler
  let prevState = 0;

  const ri = runIdiomaticGame(mi, {
    nmiReturnPC,
    maxFrames: ATTRACT_FRAMES,
    onFrame: (m, frame) => {
      const state = m.mem.read8(EFFECT_STATE);
      // A fresh arm this frame on the jump-over tier (bit0) — what loc_1c05 latches clearing a barrel.
      if (state === 1 && prevState !== 1 && (m.mem.read8(EFFECT_SELECT) & 0x01)) jumpOverArmed = true;
      prevState = state;
      if (frame === 0) return; // power-on sample, SP not yet seated
      const sp = m.regs.sp;
      if (prevSp !== null && sp !== prevSp) spFaults.push(`frame ${frame}: ${hex(prevSp)} -> ${hex(sp)}`);
      prevSp = sp;
    },
  });

  // Positive control FIRST: a "no crash" assertion is vacuous unless the crashing path actually ran.
  assert.ok(
    jumpOverArmed,
    `the attract demo never armed the jump-over effect within ${ATTRACT_FRAMES} frames, so this ` +
      "test did not exercise the bug (loc_1c05 -> armScorePopupAndSelectAward -> loc_1e28)",
  );
  // The bug: loc_1e28's unbracketed guest `ret` walked SP into 0x6C00 and the run died here.
  assert.equal(ri.stopError, null, `game reset while jumping a barrel: ${ri.stop}`);
  assert.equal(
    spFaults.length, 0,
    "guest SP moved across a frame boundary — the effect-dispatch tail's guest ret popped a word " +
      `it did not own: ${spFaults.slice(0, 4).join("; ")}`,
  );
  assert.ok(ri.frames >= ATTRACT_FRAMES, `run covered only ${ri.frames}/${ATTRACT_FRAMES} frames (${ri.stop})`);
});

test("latching the jump-over award mid-game keeps the guest stack balanced (deterministic)", async () => {
  // Deterministic twin of test 1 (no RNG dependence): drive to in-play, then write the exact bytes
  // loc_1c05 latches on a jump-over (EFFECT_SELECT=1, EFFECT_STATE=1). Next frame runs the crashing
  // state-1 handler.
  const IN2 = 0x7d00, COIN = 0x80, START = 0x04;
  const mi = new Machine(ROM, { overrides: await resolveAllIdiomatic() });
  mi.inputTape = [
    { frame: 200, port: IN2, bits: COIN, dur: 8 },
    { frame: 300, port: IN2, bits: START, dur: 8 },
  ];

  let injected = false;
  let sawArmHandlerRun = false; // positive control: EFFECT_STATE advances 1 -> 2 only if the handler ran
  let prevSp = null;
  const spFaults = [];

  const ri = runIdiomaticGame(mi, {
    nmiReturnPC,
    maxFrames: 1600,
    onFrame: (m, frame) => {
      m.applyInputs(frame);
      if (!injected && frame > 1400 && m.mem.read8(IN_PLAY)) {
        m.mem.write8(EFFECT_SELECT, 0x01);
        m.mem.write8(EFFECT_STATE, 0x01);
        injected = true;
      }
      // armScorePopupAndSelectAward unconditionally advances EFFECT_STATE 1 -> 2 when it runs.
      if (injected && m.mem.read8(EFFECT_STATE) === 0x02) sawArmHandlerRun = true;
      if (injected) {
        const sp = m.regs.sp;
        if (prevSp !== null && sp !== prevSp) spFaults.push(`frame ${frame}: ${hex(prevSp)} -> ${hex(sp)}`);
        prevSp = sp;
      }
    },
  });

  assert.ok(injected, "never reached in-play to inject the jump-over latch");
  assert.ok(sawArmHandlerRun, "the state-1 arm handler never ran, so the crashing tail was not exercised");
  assert.equal(ri.stopError, null, `game reset after a jump-over latch: ${ri.stop}`);
  assert.equal(
    spFaults.length, 0,
    `guest SP moved across a frame boundary after the latch: ${spFaults.slice(0, 4).join("; ")}`,
  );
});
