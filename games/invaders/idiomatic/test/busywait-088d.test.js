// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for showRoundStartSplash (round-start splash busy-wait generator). The oracle busy-waits on the
// vblank-decremented counter 0x20c0, which no in-isolation cycle clock drives, so it cannot be run as a
// plain function here; the generator makes that wait yield once per displayed frame. This test drives the
// generator directly, decrementing the counter each yield the way the interrupt would, and checks: the
// spin lasts exactly its 0xb0-frame seed, the counter drains to zero, the counter-bit-2 strip-clear pass
// lands (a pre-filled strip is zeroed), and the counter-bit-2-clear pass repaints the active score.
// Run: node --test games/invaders/idiomatic/test/busywait-088d.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { showRoundStartSplash } from "../showRoundStartSplash.js";
import { FRAME_DELAY_TIMER, ACTIVE_PLAYER_PAGE, PLAYER1_OBJ_DESC, PLAYER1_SCORE_STRIP_VRAM, ROUND_START_SPLASH_VRAM } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

// Step the generator to completion, decrementing the vblank counter once per yield (the interrupt's job).
function driveToDone(gen, m, cap = 0x300) {
  let frames = 0;
  let r = gen.next();
  while (!r.done) {
    m.mem.write8(FRAME_DELAY_TIMER, (m.mem.read8(FRAME_DELAY_TIMER) - 1) & 0xff);
    frames += 1;
    if (frames > cap) throw new Error("showRoundStartSplash busy-wait did not terminate");
    r = gen.next();
  }
  return frames;
}

test("round-start splash: 0xb0-frame spin drains the counter and the per-frame draws land", () => {
  const m = new Machine(ROM);
  m.regs.sp = 0x2400;
  m.mem.write8(ACTIVE_PLAYER_PAGE, 0x21); // player-1 select (odd): strip-clear targets the player-1 base

  // Seat a known player-1 score record (value 0x1234 at screen 0x2a01) so the repaint has a fixed target.
  m.mem.write8(PLAYER1_OBJ_DESC, 0x34);
  m.mem.write8(PLAYER1_OBJ_DESC + 1, 0x12);
  m.mem.write8(PLAYER1_OBJ_DESC + 2, 0x01);
  m.mem.write8(PLAYER1_OBJ_DESC + 3, 0x2a);

  // Pre-fill the strip the bit-2 branch blanks, so the clear is observable.
  m.mem.write8(PLAYER1_SCORE_STRIP_VRAM, 0xff);
  m.mem.write8(PLAYER1_SCORE_STRIP_VRAM + 0x20, 0xff);

  const frames = driveToDone(showRoundStartSplash(m), m);

  assert.equal(frames, 0xb0, "spin length is the 0xb0-frame seed");
  assert.equal(m.mem.read8(FRAME_DELAY_TIMER), 0, "counter drained to zero");
  assert.equal(m.mem.read8(PLAYER1_SCORE_STRIP_VRAM), 0, "strip-clear pass zeroed the strip base");
  assert.equal(m.mem.read8(PLAYER1_SCORE_STRIP_VRAM + 0x20), 0, "strip-clear pass zeroed the next strip column");

  // The bit-2-clear pass repaints the seated score; its first glyph lands down the 8-row column at 0x2a01.
  let scoreTouched = false;
  for (let i = 0; i < 8; i++) if (m.mem.read8(0x2a01 + i * 0x20) !== 0) scoreTouched = true;
  assert.ok(scoreTouched, "score-repaint pass wrote glyph pixels");

  // The fixed sprite row was painted at the start.
  let rowTouched = false;
  for (let i = 0; i < 8; i++) if (m.mem.read8(ROUND_START_SPLASH_VRAM + i * 0x20) !== 0) rowTouched = true;
  assert.ok(rowTouched, "opening sprite row was painted");
});

test("TEETH: a spin that never re-checks the counter would never end (cap guards it)", () => {
  // Positive control: with the counter frozen non-zero (no interrupt), the drive must hit the cap.
  const m = new Machine(ROM);
  m.regs.sp = 0x2400;
  m.mem.write8(ACTIVE_PLAYER_PAGE, 0x21);
  const gen = showRoundStartSplash(m);
  let frames = 0;
  let r = gen.next();
  let threw = false;
  try {
    while (!r.done) {
      // NOTE: deliberately do NOT decrement -- models a dead interrupt.
      frames += 1;
      if (frames > 0x40) throw new Error("cap");
      r = gen.next();
    }
  } catch {
    threw = true;
  }
  assert.ok(threw, "an undrained counter never terminates the spin");
});
