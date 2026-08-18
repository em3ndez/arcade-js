// SPDX-License-Identifier: GPL-3.0-only
//
// Drift gate for the Frogger AUDIO WIRING -- the seam between files owned by different layers that must
// not be edited into disagreement:
//   manifest.js            declares WHERE the map + samples are
//   audio/sounds.js        says what each command MEANS and the latch it rides
//   boards/frogger/io.js   taps the latch write and hands it to the player
//   idiomatic/names.js     owns SOUND_CMD_LATCH
// It re-derives, from those alone, what web/player.html would decide to play, and pins it. No ROM, no
// audio device: it cannot prove a clip sounds right, only that the wiring still says what it said.

import test from "node:test";
import assert from "node:assert/strict";

import manifest from "../manifest.js";
import SOUNDS, { PORTS } from "../audio/sounds.js";
import { SOUND_CMD_LATCH, SOUND_CTRL_PORT } from "../idiomatic/names.js";
import { Io } from "../../../boards/frogger/io.js";

const audio = manifest.audio;

// The predicate web/player.html applies: a command plays iff it has a recorded clip, and the recorder
// writes a clip only for an audible command. Restated here so a change is made in two places on purpose.
const playable = (e) => !!e && e.measured?.audible === true;

test("manifest.audio declares the map + samples the web player needs", () => {
  assert.ok(audio, "frogger manifest lost its audio block");
  assert.equal(typeof audio.map, "string");
  assert.equal(typeof audio.samples, "string");
  for (const p of [audio.map, audio.samples]) {
    assert.ok(!p.startsWith("/") && !p.startsWith("."), `${p} must be game-relative`);
  }
});

test("manifest.audio.map is the module this test loaded", async () => {
  const mod = await import(`../${audio.map}`);
  assert.equal(mod.default, SOUNDS, "manifest.audio.map points somewhere else");
});

test("the map's latch is PPI1 port A and matches names.js SOUND_CMD_LATCH", () => {
  assert.equal(SOUNDS.soundLatch, 0xd000);
  assert.equal(SOUNDS.soundLatch, SOUND_CMD_LATCH); // audio_gate checks this; pin it here too
  assert.equal(PORTS.latch, 0xd000);
  assert.equal(PORTS.control, SOUND_CTRL_PORT);
  assert.equal(PORTS.control, 0xd002);
  assert.equal(PORTS.intBit, 3);
  assert.equal(PORTS.muteBit, 4);
});

// --- the board tap: what actually reaches web/player.html on a command write ---

test("a command write to PPI1.A notifies onSoundWrite at the latch address", () => {
  const io = new Io();
  const events = [];
  io.onSoundWrite = (addr, val) => events.push([addr, val]);

  // Reset control (0x9B) leaves port A an INPUT, so the write is dropped -- nothing to play yet.
  io.ppiWrite(1, 0, 0x04);
  assert.equal(events.length, 0, "an input-direction write must not fire the tap");

  // The ROM programs PPI1 control = 0x88 to make ports A/B outputs; then a command write reaches the tap.
  io.ppiWrite(1, 3, 0x88);
  events.length = 0;
  io.ppiWrite(1, 0, 0x04);
  assert.deepEqual(events, [[0xd000, 0x04]], "the hop command must reach the player at 0xd000");
  assert.equal(io.soundData, 0x04);
});

test("the control port's bit-3 falling edge is the /INT the sound CPU wakes on", () => {
  const io = new Io();
  io.ppiWrite(1, 3, 0x88); // ports A/B outputs
  const before = io.soundTriggers;
  io.ppiWrite(1, 1, 0x08); // bit3 high (idle)
  io.ppiWrite(1, 1, 0x00); // bit3 1->0: the falling edge
  io.ppiWrite(1, 1, 0x08); // re-arm high
  assert.equal(io.soundTriggers - before, 1, "exactly one falling edge fires /INT");
});

test("control bit 4 is the sound mute", () => {
  const io = new Io();
  io.ppiWrite(1, 3, 0x88);
  io.ppiWrite(1, 1, 0x10);
  assert.equal(io.mute, 1);
  io.ppiWrite(1, 1, 0x00);
  assert.equal(io.mute, 0);
});

// --- the player's playback set, derived from the map alone ---

test("the player would ask for exactly the commands the map measured audible", () => {
  const audible = Object.entries(SOUNDS.commands)
    .filter(([, e]) => playable(e))
    .map(([k]) => Number(k))
    .sort((a, b) => a - b);
  // The commands the recorder captured a clip for. The silent control bytes (0x00/0xff) and the
  // intended-but-silent sequence tails (0x0e/0x30/0x80/0xb0) get no clip, so the player plays nothing.
  assert.deepEqual(
    audible,
    [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0f, 0x10, 0x18, 0x90, 0xd0, 0xf0],
  );
});

test("every playable command has a unique name to load its clip under", () => {
  const names = Object.values(SOUNDS.commands).filter(playable).map((e) => e.name);
  assert.equal(new Set(names).size, names.length, "a name collision would drop a sound");
});
