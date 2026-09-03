// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0a3c (player-switch handoff wait generator). Like the other vblank busy-waits, the
// oracle spins on the counter 0x20c0 (and re-polls the arm-trigger cell) with no in-isolation clock, so it
// runs only as a generator that yields once per displayed frame. This test drives the generator directly:
// with the trigger armed it holds its 0x30-frame delay then returns; with the trigger idle it spins until
// the trigger becomes armed. The counter is decremented each yield the way the interrupt would.
// Run: node --test games/invaders/idiomatic/test/busywait-0a3c.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { loc_0a3c } from "../loc_0a3c.js";
import { FRAME_DELAY_TIMER, loc_2015 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

test("armed trigger: holds the 0x30-frame delay, draining the counter, then returns", () => {
  const m = new Machine(ROM);
  m.regs.sp = 0x2400;
  m.mem.write8(loc_2015, 0xff); // armed and stays armed

  const gen = loc_0a3c(m);
  let frames = 0;
  let r = gen.next();
  while (!r.done) {
    m.mem.write8(FRAME_DELAY_TIMER, (m.mem.read8(FRAME_DELAY_TIMER) - 1) & 0xff);
    frames += 1;
    if (frames > 0x200) throw new Error("loc_0a3c delay did not terminate");
    r = gen.next();
  }
  assert.equal(frames, 0x30, "delay length is the 0x30-frame seed");
  assert.equal(m.mem.read8(FRAME_DELAY_TIMER), 0, "counter drained to zero");
});

test("idle trigger: spins until the trigger becomes armed, then returns", () => {
  const m = new Machine(ROM);
  m.regs.sp = 0x2400;
  m.mem.write8(loc_2015, 0x00); // not armed

  const gen = loc_0a3c(m);
  let frames = 0;
  let r = gen.next();
  while (!r.done) {
    frames += 1;
    if (frames === 5) m.mem.write8(loc_2015, 0xff); // arm it on the fifth frame
    if (frames > 100) throw new Error("loc_0a3c wait did not terminate");
    r = gen.next();
  }
  assert.equal(frames, 5, "returns on the first poll after the trigger is armed");
});
