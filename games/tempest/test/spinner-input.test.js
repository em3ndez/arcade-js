// SPDX-License-Identifier: GPL-3.0-only
// Spinner (mouse) input direction. The game reads a 4-bit rotary-encoder knob and forms the per-frame
// rotation by SIGN-EXTENDING the low-nibble delta (serviceHeartbeatInterrupt: `if (a >= 0x08) a |= 0xf0`),
// so a knob step of 8..15 reads as a NEGATIVE rotation. A mouse delivers tens of movementX per frame, so an
// un-clamped step crosses that +-8 boundary as the mouse speed varies and the claw twitches back and forth.
// applyTrackball must clamp the per-frame step to the unambiguous signed range [-7,7] so the rotation always
// tracks the mouse direction (rate-capped, never reversed).
// Run: node --test games/tempest/test/spinner-input.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { Io } from "../../../boards/tempest/io.js";

// The rotation step the game sees for one frame's mouse movement: the knob change from 0, sign-extended
// exactly as serviceHeartbeatInterrupt does. The worker delivers movementX as a signed byte (& 0xff).
function knobStep(mouse) {
  const io = new Io();
  io.knob = 0;
  io.applyTrackball(0, mouse & 0xff);
  let d = io.knob & 0x0f;
  if (d >= 8) d -= 16;
  return d;
}
const clamp7 = (n) => Math.max(-7, Math.min(7, n));

test("spinner: a rightward mouse never reverses to a leftward step (no twitch)", () => {
  for (const mouse of [1, 4, 7, 8, 10, 12, 15, 16, 20, 24, 30, 60, 120]) {
    const step = knobStep(mouse);
    assert.ok(step > 0, `mouse +${mouse} must advance the knob forward, got ${step}`);
    assert.equal(step, clamp7(mouse), `mouse +${mouse}: step should be clamp to ${clamp7(mouse)}, got ${step}`);
  }
});

test("spinner: a leftward mouse never reverses to a rightward step", () => {
  for (const mouse of [-1, -4, -7, -8, -10, -16, -24, -30, -120]) {
    const step = knobStep(mouse);
    assert.ok(step < 0, `mouse ${mouse} must advance the knob backward, got ${step}`);
    assert.equal(step, clamp7(mouse), `mouse ${mouse}: step should be clamp to ${clamp7(mouse)}, got ${step}`);
  }
});

test("spinner: the vertical axis (there is no Y spinner) is ignored", () => {
  const io = new Io();
  io.knob = 5;
  io.applyTrackball(1, 30);
  assert.equal(io.knob, 5, "axis 1 must not move the 1-axis spinner");
});
