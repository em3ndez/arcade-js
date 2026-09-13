// SPDX-License-Identifier: GPL-3.0-only
/**
 * Tempest input wiring (boards/tempest/io.js): the digital tape (Machine.applyInputs sets io.inputAssert)
 * folds into the direct IN0 read (coins) and the pokey2 pot bits (start/fire/superzapper). Idle values are
 * the driver defaults; the pressed folds are grounded vs MAME -- START1 pressed makes pokey2 report ALLPOT
 * 0x20 (bit5), which this io model reproduces because pokey2PotBits clears bit5 (that pot then ramps and the
 * pokey ALLPOT, inverted under SK_RESET, sets bit5). Run: node --test boards/tempest/test/io-input.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Io } from "../io.js";

test("idle (no input asserted): coins high, pokey pots at their attract-idle bytes", () => {
  const io = new Io();
  assert.equal(io.readIn0(0) & 0x3f, 0x3f, "IN0 b0-5 idle high (active-low, nothing pressed)");
  assert.equal(io.pokey2PotBits(), 0xff, "pokey2 idle: all IN2 bits set (start/fire/zap inactive)");
  assert.equal(io.pokey1PotBits(), io.cabinet | 0xe0, "pokey1 idle: knob 0 | cabinet | unknowns");
});

test("coin (IN0 0x04) is active-low: a pressed coin clears its bit", () => {
  const io = new Io();
  io.inputAssert = { 0: 0x04 };
  assert.equal(io.readIn0(0) & 0x04, 0, "coin bit clears when pressed");
  assert.equal(io.readIn0(0) & 0x3b, 0x3b, "the other IN0 switch bits stay idle high");
});

test("IN2 start/fire/superzapper fold into the pokey2 pots (active-low: pressed clears)", () => {
  const io = new Io();
  io.inputAssert = { 2: 0x20 }; // START1
  assert.equal(io.pokey2PotBits(), 0xdf, "start1 clears bit5 -> grounded ALLPOT 0x20");
  io.inputAssert = { 2: 0x10 }; // FIRE (BUTTON1)
  assert.equal(io.pokey2PotBits(), 0xef, "fire clears bit4");
  io.inputAssert = { 2: 0x08 }; // SUPERZAPPER (BUTTON2)
  assert.equal(io.pokey2PotBits(), 0xf7, "superzapper clears bit3");
  io.inputAssert = { 2: 0x30 }; // start1 + fire together
  assert.equal(io.pokey2PotBits(), 0xcf, "combined presses clear both bits");
});

test("input folding is scoped by port: an IN0 press does not touch the pokey2 pots and vice-versa", () => {
  const io = new Io();
  io.inputAssert = { 0: 0x04 };
  assert.equal(io.pokey2PotBits(), 0xff, "coin (port 0) leaves the pokey2 pots idle");
  io.inputAssert = { 2: 0x20 };
  assert.equal(io.readIn0(0) & 0x3f, 0x3f, "start1 (port 2) leaves IN0 idle");
});

test("spinner (analog): applyTrackball folds the 4-bit knob into the pokey1 pots, wrapping mod 16", () => {
  const io = new Io();
  assert.equal(io.pokey1PotBits() & 0x0f, 0, "idle knob = 0");
  io.applyTrackball(0, 3);
  assert.equal(io.pokey1PotBits() & 0x0f, 3, "rotate +3 -> knob 3");
  io.applyTrackball(0, 0xff); // -1 as a signed byte
  assert.equal(io.pokey1PotBits() & 0x0f, 2, "rotate -1 -> knob 2");
  io.knob = 15;
  io.applyTrackball(0, 1);
  assert.equal(io.pokey1PotBits() & 0x0f, 0, "wraps mod 16");
  io.knob = 5;
  io.applyTrackball(1, 9); // the vertical axis is ignored -- the spinner is one axis
  assert.equal(io.pokey1PotBits() & 0x0f, 5, "axis 1 leaves the knob unchanged");
  assert.equal(io.pokey1PotBits() & 0xf0, 0xf0, "the high bits (cabinet | unknowns) stay set");
});
