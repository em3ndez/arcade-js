// SPDX-License-Identifier: GPL-3.0-only
//
// Drift gate for the Time Pilot AUDIO WIRING -- the seam between files owned by different layers that
// must not be edited into disagreement:
//   manifest.js            declares WHERE the map + samples are
//   audio/sounds.js        declares the model shape (a bare "clips" latch) and the latch address
//   boards/timeplt/io.js   taps the 0xC000 sound-latch write and hands it to the player
//   web/player.html        (setupClipAudio) decides, from index.json alone, which command plays
//
// Time Pilot is a bare CLIPS-model game (like The Pit): the main CPU writes a command byte to the
// 0xC000 latch and pulses the 0xC304 attention edge, and a SECOND Z80 + two AY-3-8910s (NOT emulated)
// turn it into sound. We play a recorded clip per command instead. Unlike Frogger, there is NO committed
// per-command table in sounds.js: that table is a MEASUREMENT OF YOUR OWN ROM, so it lives in the
// recorder's (gitignored) audio/samples/index.json, exactly as the WAVs themselves are gitignored.
//
// This test re-derives, from the manifest + sounds.js + the board tap alone, what web/player.html would
// decide to play, and pins it. It needs no ROM, no audio device, and no browser: it cannot prove a clip
// sounds right, only that the wiring still says what it said. The one rule worth stating out loud,
// because getting it wrong ships a lie: a command the recorder measured SILENT MUST NOT be played, even
// when a clip file happens to sit on disk for it (command 0x1F is the live example -- silent, yet a
// cmd_31.wav exists; the player filters it on `!c.silent`, and this test pins that it stays filtered).

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import manifest from "../manifest.js";
import SOUNDS from "../audio/sounds.js";
import { Io } from "../../../boards/timeplt/io.js";

const audio = manifest.audio;
const samplesDir = new URL("../audio/samples/", import.meta.url);
const indexPath = new URL("index.json", samplesDir);

// The exact predicate web/player.html's setupClipAudio() applies to index.json, restated here so a
// change to it has to be made in two places on purpose rather than in one by accident. A command plays
// iff the recorder captured a real (non-silent) clip file for it under an integer command byte.
const playable = (c) => !!c && !!c.file && !c.silent && Number.isInteger(c.command);

const loadIndex = () => JSON.parse(readFileSync(indexPath, "utf-8"));
const fileOnDisk = (name) => existsSync(fileURLToPath(new URL(name, samplesDir)));

test("manifest.audio declares the map + samples the web player needs", () => {
  assert.ok(audio, "timeplt manifest lost its audio block");
  assert.equal(typeof audio.map, "string");
  assert.equal(typeof audio.samples, "string");
  // A bare clips game plays per-command clips keyed by index.json's own `id`/`command`; it needs no
  // clipId templates (those are dkong's dual ls259/latch sweep). Pin that none crept in unnoticed.
  assert.equal(audio.clipIds, undefined, "a clips-model game keys clips by command, not clipId templates");
  for (const p of [audio.map, audio.samples]) {
    assert.ok(!p.startsWith("/") && !p.startsWith("."), `${p} must be game-relative`);
  }
});

test("manifest.audio.map is the module this test loaded", async () => {
  const mod = await import(`../${audio.map}`);
  assert.equal(mod.default, SOUNDS, "manifest.audio.map points somewhere else");
});

test("the map is a BARE clips model on the 0xC000 sound latch", () => {
  assert.equal(SOUNDS.model, "clips");
  assert.equal(SOUNDS.soundLatch, 0xc000);
  assert.equal(typeof SOUNDS.soundLatch, "number");
  // The per-command table is a measurement of your own ROM -> it lives in the gitignored index.json,
  // never in committed source. Pin that no committed table (or control-port block) has been added
  // here without also updating the tests that would then have to validate it.
  assert.deepEqual(Object.keys(SOUNDS).sort(), ["model", "soundLatch"],
    "sounds.js grew a field: a committed command table or ports block needs its own coverage");
  assert.equal(SOUNDS.commands, undefined, "no committed command table -- the measurement is index.json");
  assert.equal(SOUNDS.ports, undefined, "no control-port block -- see the latch-trigger test below");
});

// --- the board tap: what actually reaches web/player.html on a command write ---

test("a write to the sound latch notifies onSoundWrite at SOUNDS.soundLatch", () => {
  const io = new Io();
  const events = [];
  io.onSoundWrite = (addr, val) => events.push([addr, val]);

  io.writeSoundData(0x07); // the player shot
  assert.deepEqual(events, [[SOUNDS.soundLatch, 0x07]], "the command must reach the player at 0xC000");
  assert.equal(events[0][0], 0xc000);
  assert.equal(io.soundData, 0x07);

  // The board masks the byte, so a wide write still delivers a clean command.
  io.writeSoundData(0x1ff);
  assert.deepEqual(events[1], [SOUNDS.soundLatch, 0xff]);
  assert.equal(io.soundData, 0xff);
});

test("offline (no audio sink wired) a latch write is inert -- just a store", () => {
  const io = new Io();
  assert.equal(io.onSoundWrite, null);
  io.writeSoundData(0x0c); // must not throw with no sink
  assert.equal(io.soundData, 0x0c);
});

test("the clips player fires on the latch write itself, because the map declares no control port", () => {
  // setupClipAudio: `if (ctrlPort == null) fire(val)` on a LATCH write. Time Pilot's sounds.js declares
  // no `ports`, so ctrlPort is null and the 0xC000 write IS the trigger -- the board comment says the
  // paired 0xC304 attention edge is not needed on this path. Pin the premise that keeps that branch live.
  assert.equal(SOUNDS.ports?.control, undefined,
    "a control port would move the trigger to its /INT edge and change what plays");
});

// --- the player's playback set, derived from the recorder's index.json (the TEETH) ---
// index.json + the WAVs are gitignored copyright (your own ROM), so they are ABSENT in a clone: the arm
// skips, exactly as Frogger's clip cross-check does. When present it is the real enforcement.

test("no SILENT command is ever played, and every played command has its clip on disk", (t) => {
  if (!existsSync(fileURLToPath(indexPath))) {
    t.skip("audio/samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  assert.ok(Array.isArray(index.clips), "index.json has no clips array");
  // Positive control: a broken/empty index must not pass vacuously (the default sweep is 0x00-0x1F = 32).
  assert.ok(index.clips.length >= 20, `only ${index.clips.length} clips -- the index is broken/empty`);

  const play = index.clips.filter(playable);
  assert.ok(play.length >= 20, `only ${play.length} playable clips -- a clip drop or a broken filter`);

  // THE TEETH (silent-with-sample). The dataset must actually EXERCISE the silent filter, or the rule is
  // untested: command 0x1F is measured silent yet a cmd_31.wav sits on disk. That is the positive control.
  const silentWithFile = index.clips.filter((c) => c.silent === true && c.file);
  assert.ok(silentWithFile.length >= 1,
    "no silent-but-has-a-file clip -> the silent filter is untested; keep the 0x1F fixture or note it pending");
  // ...and NONE of them (nor any silent clip) may reach the play set. A future edit that drops the
  // `!c.silent` guard from `playable` puts cmd_31 into `play`, and this line goes RED.
  assert.ok(play.every((c) => c.silent !== true), "a SILENT command reached the play set -- it would sound a lie");
  for (const c of silentWithFile) {
    assert.equal(playable(c), false, `0x${c.command.toString(16)} is silent but was judged playable`);
  }

  // THE TEETH (dropped clip). Every command the player would ask for must have its named clip present,
  // under record_samples.py's decimal `cmd_<n>.wav` convention. Delete a WAV and this goes RED.
  for (const c of play) {
    assert.equal(c.file, `cmd_${c.command}.wav`, `0x${c.command.toString(16)} clip name drifted from cmd_<decimal>.wav`);
    assert.ok(fileOnDisk(c.file), `${c.file} is in the play set but missing from audio/samples/`);
  }

  // The recorder and the player must agree on the address the command rides.
  assert.equal(String(index.sound_latch).toLowerCase(), "0x" + SOUNDS.soundLatch.toString(16),
    "index.json's sound_latch disagrees with sounds.js soundLatch");
});

test("every played command loads under a unique clip id (a collision would drop a sound)", (t) => {
  if (!existsSync(fileURLToPath(indexPath))) {
    t.skip("audio/samples/index.json absent (gitignored copyright, BYO)");
    return;
  }
  const play = loadIndex().clips.filter(playable);
  const ids = play.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "a clip id collision would overwrite a loaded sample");
  const cmds = play.map((c) => c.command);
  assert.equal(new Set(cmds).size, cmds.length, "two clips claim the same command byte");
});
