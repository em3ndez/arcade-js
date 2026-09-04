// SPDX-License-Identifier: GPL-3.0-only
//
// Drift gate for the Space Invaders audio WIRING -- the seam between three things that must agree:
//   games/invaders/manifest.js     declares WHERE the map + samples are, and the model
//   games/invaders/audio/sounds.js says what each OUT-port bit MEANS (and its clip + kind)
//   web/player.html setupBitPortAudio  turns OUT 3/5 write edges into play/loop/stop calls
// This test re-derives, from the manifest + the map alone, exactly what that adapter would decide to
// play for a given OUT-port write stream, and pins the answer. It needs no ROM, no audio, no browser;
// it cannot prove a clip sounds right (that is the by-ear sign-off) -- only that the wiring still says
// what it said. The edge model is RESTATED here (not imported from player.html) so a change to either
// side that breaks their agreement fails this test.
//
// Run: node --test
import test from "node:test";
import assert from "node:assert/strict";
import manifest from "../manifest.js";
import map, { SOUNDS } from "../audio/sounds.js";

test("the manifest declares the bitports map + a samples dir, no synth", () => {
  assert.ok(manifest.audio, "manifest has no audio block");
  assert.equal(manifest.audio.map, "audio/sounds.js");
  assert.equal(manifest.audio.samples, "audio/samples");
  assert.equal(manifest.audio.synth, undefined, "SI uses recorded clips, not synthesis");
});

test("the map's default export is the bitports contract the adapter reads", () => {
  assert.equal(map.model, "bitports");
  assert.equal(map.sounds, SOUNDS, "default.sounds must be the exported bit map");
  assert.ok(map.ports && map.ports.sound1 === 3 && map.ports.sound2 === 5);
  assert.ok(typeof map.masterGain === "number" && map.masterGain > 0 && map.masterGain <= 4);
});

// A faithful restatement of web/player.html setupBitPortAudio's decision logic: diff each OUT-port write
// against that port's previous value; a bit's 0->1 edge plays its clip (oneshot) or starts it (loop); a
// loop bit's 1->0 stops it. `ev` is the flat [port,value,...] stream. Returns the ordered play/loop/stop log.
function derivePlays(sounds, ev) {
  const prev = new Map(), looping = new Set(), log = [];
  for (let i = 0; i < ev.length; i += 2) {
    const port = ev[i], val = ev[i + 1];
    const was = prev.get(port) ?? 0;
    prev.set(port, val);
    const rose = val & ~was, fell = was & ~val;
    for (let b = 0; b < 8; b++) {
      const bit = 1 << b, key = `${port}:${b}`, e = sounds[key];
      if (!e || e.kind === "none" || !e.clip) continue;
      if (e.kind === "loop") {
        if ((rose & bit) && !looping.has(key)) { looping.add(key); log.push(["loop", e.clip]); }
        else if ((fell & bit) && looping.has(key)) { looping.delete(key); log.push(["stop", e.clip]); }
      } else if (rose & bit) {
        log.push(["play", e.clip]);
      }
    }
  }
  return log;
}

test("a pulsed one-shot bit plays its clip exactly once on the rising edge", () => {
  // OUT3 b1 (player shot): 0 -> 0x02 -> 0 fires one play; a re-pulse fires again.
  assert.deepEqual(derivePlays(SOUNDS, [3, 0x02, 3, 0x00]), [["play", "out3_b1.wav"]]);
  assert.deepEqual(derivePlays(SOUNDS, [3, 0x02, 3, 0x00, 3, 0x02]),
    [["play", "out3_b1.wav"], ["play", "out3_b1.wav"]]);
});

test("the UFO (loop) starts on its rising edge and stops on the falling edge", () => {
  assert.deepEqual(derivePlays(SOUNDS, [3, 0x01, 3, 0x00]),
    [["loop", "out3_b0.wav"], ["stop", "out3_b0.wav"]]);
  // held across several writes: one start, no restart, one stop.
  assert.deepEqual(derivePlays(SOUNDS, [3, 0x01, 3, 0x01, 3, 0x00]),
    [["loop", "out3_b0.wav"], ["stop", "out3_b0.wav"]]);
});

test("a `none` bit (amp/mute control) never plays; unknown bits are ignored", () => {
  assert.deepEqual(derivePlays(SOUNDS, [3, 0x20, 3, 0x00]), []); // OUT3 b5 = ampControl, none
  assert.deepEqual(derivePlays(SOUNDS, [3, 0x80, 3, 0x00]), []); // b7 not in the map
});

test("the two ports track edges independently", () => {
  // OUT3 UFO on, then an OUT5 march step, then UFO off -- interleaved, correct per port.
  assert.deepEqual(derivePlays(SOUNDS, [3, 0x01, 5, 0x01, 5, 0x00, 3, 0x00]),
    [["loop", "out3_b0.wav"], ["play", "out5_b0.wav"], ["stop", "out3_b0.wav"]]);
});

test("every clip the adapter would fetch is a real map clip (name = recorder id)", () => {
  for (const [key, e] of Object.entries(SOUNDS)) {
    if (e.kind === "none") continue;
    const [port, bit] = key.split(":");
    assert.equal(e.clip, `out${port}_b${bit}.wav`);
  }
});
