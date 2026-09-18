// SPDX-License-Identifier: GPL-3.0-only
//
// Drift gate for The Pit AUDIO WIRING -- the seam between files owned by different layers that must not be
// edited into disagreement:
//   manifest.js            declares WHERE the map + the recorded samples live (and, crucially, that this is
//                          a pure CLIPS game -- no synth, no clip-id template)
//   audio/sounds.js        says the model is "clips" and names the one latch the player listens on
//   boards/thepit/io.js    taps that latch write and hands the command byte to the player
//
// web/player.html (setupClipAudio) reads those, then reads the recorder's index.json to learn which command
// sounds and what file it landed in. This test re-derives, from the SAME inputs, exactly what that page would
// decide to play, and pins it. It needs no ROM, no audio device, and no browser: it cannot prove a clip
// sounds right, only that the wiring still says what it said.
//
// The one rule worth stating out loud, because getting it wrong ships a lie: an entry the recorder measured
// SILENT (`silent: true`) MUST NOT be given a sample (`file` must be null), and every entry it measured
// sounding (`silent: false`) MUST carry a real clip file that is actually present. The Pit has no committed
// per-command map (sounds.js is model + latch only -- the table is a measurement of YOUR OWN ROM, so it
// lives in the gitignored index.json alongside the gitignored WAVs). So the honesty rule is enforced where
// the wiring actually lives: against index.json + the sample files, which are present in a working checkout
// and absent in a clean clone (the clip arms t.skip there, exactly as frogger's clip cross-check does).
//
// Run: node --test games/thepit/test/audio-wiring.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import manifest from "../manifest.js";
import SOUNDS from "../audio/sounds.js";
import { Io } from "../../../boards/thepit/io.js";

const audio = manifest.audio;
const samplesDir = new URL("../audio/samples/", import.meta.url);
const indexUrl = new URL("index.json", samplesDir);

// The predicate web/player.html applies in setupClipAudio, restated here so a change to it has to be made in
// two places on purpose rather than in one by accident: a command is loaded and playable iff the recorder
// wrote a non-silent clip file for it under an integer command byte.
const playable = (c) => !!c && !!c.file && !c.silent && Number.isInteger(c.command);

const loadIndex = () => JSON.parse(readFileSync(indexUrl, "utf-8"));

// -- the committed seam (always runs; no ROM, no clips) ---------------------

test("manifest.audio declares the map + samples the web player needs", () => {
  assert.ok(audio, "The Pit manifest lost its audio block");
  assert.equal(typeof audio.map, "string");
  assert.equal(typeof audio.samples, "string");
  for (const p of [audio.map, audio.samples]) {
    assert.ok(!p.startsWith("/") && !p.startsWith("."), `${p} must be game-relative`);
  }
});

test("The Pit is a PURE clips game: no synth, no clip-id template", () => {
  // dkong declares audio.synth (procedural circuits) and audio.clipIds (filename templates); The Pit has
  // neither -- the audio CPU is unemulated with nothing procedural to fall back on, and the clip filenames
  // come from index.json's own `file` field, not a template the player fills in. Pin their absence so a
  // future edit cannot quietly bolt a synth arm onto a game that has no synth to render.
  assert.equal(audio.synth, undefined, "The Pit has no procedural synth -- audio.synth must not appear");
  assert.equal(audio.clipIds, undefined, "The Pit reads filenames from index.json.file, not a template");
});

test("manifest.audio.map is the module this test loaded", async () => {
  const mod = await import(`../${audio.map}`);
  assert.equal(mod.default, SOUNDS, "manifest.audio.map points somewhere else");
});

test("the map is a clips model on the single 0xB800 soundlatch", () => {
  assert.equal(SOUNDS.model, "clips");
  assert.equal(SOUNDS.soundLatch, 0xb800);
});

// -- the board tap: what actually reaches web/player.html on a command write --

test("a write to the sound latch notifies onSoundWrite at 0xB800 with the command byte", () => {
  const io = new Io();
  const events = [];
  io.onSoundWrite = (addr, val) => events.push([addr, val]);
  io.writeSoundLatch(130);
  assert.deepEqual(events, [[0xb800, 130]], "the command must reach the player at 0xB800");
  assert.equal(io.soundLatch, 130, "the latched command must be held for the audio CPU to poll");
  // The address the board taps IS the address the map tells the player to listen on -- the seam is closed.
  assert.equal(io.soundLatch, 130 & 0xff);
  assert.equal(SOUNDS.soundLatch, 0xb800);
});

test("the sound tap is inert offline: no onSoundWrite handler means no throw, just the held latch", () => {
  const io = new Io(); // onSoundWrite defaults to null (the offline engine never sets it)
  assert.doesNotThrow(() => io.writeSoundLatch(0x94));
  assert.equal(io.soundLatch, 0x94, "the command is still latched even with nothing listening");
});

// -- the player's playback set, derived from index.json (present in a checkout, gitignored in a clone) --

test("the player would load exactly the commands the recorder measured sounding", (t) => {
  if (!existsSync(indexUrl)) {
    t.skip("audio/samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  assert.ok(Array.isArray(index.clips), "index.json has no clips array");
  const loaded = index.clips.filter(playable).map((c) => c.command).sort((a, b) => a - b);
  // The Pit's audio CPU plays nothing for the low control bytes (0x00-0x1f) and 0x80/0x81; every command
  // from 0x82 up is a sounding effect or tune. The recorder's per-command sweep is the evidence for this.
  assert.deepEqual(loaded, [
    0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d,
    0x8e, 0x8f, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98,
  ]);
});

test("HONESTY: a silent command carries no sample; a sounding command carries a present clip", (t) => {
  // The teeth. This is the rule that, gotten wrong, ships a lie -- and the only place it can be enforced,
  // because The Pit commits no per-command map: the wiring lives entirely in index.json + the WAVs.
  //   * a `silent: true` entry MUST have file === null  -> giving a silent entry a sample FAILS here
  //   * a `silent: false` entry MUST have a file string that EXISTS on disk -> dropping a clip FAILS here
  if (!existsSync(indexUrl)) {
    t.skip("audio/samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  let silent = 0, sounding = 0;
  for (const c of index.clips) {
    const where = `cmd 0x${Number(c.command).toString(16)}`;
    assert.ok(Number.isInteger(c.command), `${where}: command is not an integer`);
    assert.equal(typeof c.silent, "boolean", `${where}: silent is not a boolean`);
    if (c.silent) {
      assert.equal(c.file, null, `${where}: measured silent but was GIVEN A SAMPLE (${c.file}) -- a lie`);
      silent++;
    } else {
      assert.ok(typeof c.file === "string" && c.file.length > 0,
        `${where}: measured sounding but has NO clip file -- the sound would be dropped`);
      assert.ok(existsSync(new URL(c.file, samplesDir)),
        `${where}: sounding clip file ${c.file} is missing from audio/samples/ -- dropped clip`);
      sounding++;
    }
  }
  // Positive control: a broken/empty read must not pass by finding nothing to check.
  assert.ok(silent >= 30 && sounding >= 20,
    `too few clips inspected (silent=${silent}, sounding=${sounding}) -- the index read is broken`);
});

test("every playable command has a unique clip id to load its sample under", (t) => {
  if (!existsSync(indexUrl)) {
    t.skip("audio/samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  const ids = index.clips.filter(playable).map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "a clip-id collision would drop a sound");
  const cmds = index.clips.map((c) => c.command);
  assert.equal(new Set(cmds).size, cmds.length, "a duplicate command byte would make playback ambiguous");
});
