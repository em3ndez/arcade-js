// SPDX-License-Identifier: GPL-3.0-only
//
// Drift gate for the Pooyan AUDIO WIRING -- the seam between files owned by different layers that
// must not be edited into disagreement:
//   manifest.js          declares WHERE the map + samples are
//   audio/sounds.js      says the model + the latch the player listens on
//   boards/pooyan/io.js  taps the 0xA100 sound-command write and hands it to the player
//   web/player.html      setupClipAudio consumes the map's shape and plays a clip per command
// It re-derives, from those alone, what setupClipAudio would decide to play, and pins it. No ROM,
// no audio device: it cannot prove a clip sounds right, only that the wiring still says what it said.
//
// NB Pooyan is the CLIP model (like Time Pilot / The Pit), NOT Frogger's rich per-command map, so
// there are no KINDS/measured/commands to check -- the per-command truth is the gitignored index.json.
// The committed map keeps Time Pilot's LATCH-TRIGGER path (no ports.control): the board forwards only
// the 0xA100 write, so the player fires on that write. This test pins that latch-trigger contract.

import test from "node:test";
import assert from "node:assert/strict";

import manifest from "../manifest.js";
import SOUNDS from "../audio/sounds.js";
import { Io } from "../../../boards/pooyan/io.js";

const audio = manifest.audio;

// The dispatch web/player.html applies inside setupClipAudio, restated here so a change to the map's
// trigger shape has to be made in two places on purpose. Given a flat [addr,val,...] event stream, it
// tracks the last soundlatch value and, WHEN THE MAP DECLARES NO CONTROL PORT, fires that command on
// each latch write (the `ctrlPort == null` branch). When a control port IS declared it would instead
// fire on the control bit's falling edge -- included so the pin is honest about both branches.
function drivePlayer(SOUNDS, events) {
  const LATCH = SOUNDS.soundLatch;
  const ctrlPort = SOUNDS.ports?.control;
  const intMask = 1 << (SOUNDS.ports?.intBit ?? 3);
  let latched = null;
  let ctrlPrev = intMask; // control bit idles high
  const fired = [];
  for (let i = 0; i < events.length; i += 2) {
    const addr = events[i], val = events[i + 1];
    if (addr === LATCH) {
      latched = val;
      if (ctrlPort == null) fired.push(val); // latch-trigger: play on the write itself
      continue;
    }
    if (addr !== ctrlPort) continue;
    const fell = (ctrlPrev & intMask) && !(val & intMask);
    ctrlPrev = val;
    if (fell && latched != null) fired.push(latched);
  }
  return fired;
}

test("manifest.audio declares the map + samples the web player needs", () => {
  assert.ok(audio, "pooyan manifest lost its audio block");
  assert.equal(typeof audio.map, "string");
  assert.equal(typeof audio.samples, "string");
  // Relative to the game directory: the player joins them onto ../games/<id>/.
  for (const p of [audio.map, audio.samples]) {
    assert.ok(!p.startsWith("/") && !p.startsWith("."), `${p} must be game-relative`);
  }
});

test("manifest.audio.map is the module this test loaded", async () => {
  const mod = await import(`../${audio.map}`);
  assert.equal(mod.default, SOUNDS, "manifest.audio.map points somewhere else");
});

test("the map is the clips model setupClipAudio consumes", () => {
  // web/player.html: `if (SOUNDS?.model === "clips") return setupClipAudio(...)`, which then reads
  // `SOUNDS.soundLatch` as the address it listens on. Pin both.
  assert.equal(SOUNDS.model, "clips");
  assert.equal(SOUNDS.soundLatch, 0xa100);
});

// --- the board tap: what actually reaches the player on a sound-command write ---

test("a sound-command write reaches the player at exactly the map's soundLatch", () => {
  const io = new Io();
  const events = [];
  io.onSoundWrite = (addr, val) => events.push([addr, val]);

  io.writeSoundData(0x42);
  assert.deepEqual(events, [[0xa100, 0x42]], "the sound command must reach the player at 0xA100");
  assert.equal(events[0][0], SOUNDS.soundLatch, "the board taps a different address than the map declares");
  assert.equal(io.soundData, 0x42, "the latched command byte must be held");
});

test("with no sink armed a sound write is inert (headless/default runs stay silent, no throw)", () => {
  const io = new Io();
  io.onSoundWrite = null;
  assert.doesNotThrow(() => io.writeSoundData(0x99));
  assert.equal(io.soundData, 0x99, "the byte is still latched even with no audio sink");
});

// --- the player's dispatch, derived from the map alone ---

test("the map keeps the latch-trigger path: the player fires a command on each latch write", () => {
  // The committed map declares no control port, so setupClipAudio takes the `ctrlPort == null`
  // branch and plays on the latch write itself -- the same path Time Pilot uses.
  assert.equal(SOUNDS.ports?.control ?? null, null,
    "a declared control port the board never forwards would silence the game");
  const fired = drivePlayer(SOUNDS, [SOUNDS.soundLatch, 0x82, SOUNDS.soundLatch, 0x40]);
  assert.deepEqual(fired, [0x82, 0x40], "each latch write must fire its command on the latch-trigger path");
});

test("board tap -> player dispatch, end to end: real board writes drive the player", () => {
  // Feed the actual board's emitted events through the player's dispatch. The board emits at
  // SOUNDS.soundLatch and the player (null control) fires on each -- the whole wire in one assertion.
  // Distinct commands, because the worker's emitSound dedups an unchanged latch value before it ever
  // reaches setupClipAudio: on the latch-trigger path a repeated identical command sounds only once.
  const io = new Io();
  const events = [];
  io.onSoundWrite = (addr, val) => events.push(addr, val);
  io.writeSoundData(0x0c);
  io.writeSoundData(0x40);
  const fired = drivePlayer(SOUNDS, events);
  assert.deepEqual(fired, [0x0c, 0x40], "the board's writes must drive the player's dispatch");
});
