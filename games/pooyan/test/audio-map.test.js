// SPDX-License-Identifier: GPL-3.0-only
//
// Coverage + coherence gate for the Pooyan sound map (audio/sounds.js). Pooyan is the CLIP model
// (like Time Pilot, its parent, and The Pit): a single soundlatch takes a COMMAND BYTE and an
// unemulated second Z80 turns it into an effect or tune, so there is no committed per-command
// table -- that table is a MEASUREMENT OF YOUR OWN ROM and lives in the recorder's (gitignored)
// index.json. What IS committed is the SHAPE the web player needs to interpret the recordings, and
// this test pins that shape: the model, the latch the player listens on, and the coherence of any
// declared trigger port. The sample WAVs are gitignored copyright, so this tests the MAP, not audio.
//
// The map is imported and asserted directly -- there is no independent emit-set to scan (unlike
// Frogger's rich per-command map) because the per-command truth is the recording, not source. The
// optional last arm cross-checks the recorded index.json when it is present (absent in a clone).

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import SOUNDS from "../audio/sounds.js";

const h = (v) => "0x" + v.toString(16);

test("the map is a clips model on the 0xA100 sound latch", () => {
  // The two fields setupClipAudio (web/player.html) reads to key playback: the model it branches on
  // and the address it listens for command writes on (boards/pooyan/io.js writeSoundData -> 0xA100).
  assert.equal(SOUNDS.model, "clips");
  assert.equal(SOUNDS.soundLatch, 0xa100);
});

test("the sound latch is a byte-command surface in Pooyan's 0xA1xx I/O page", () => {
  // A single command byte handed to the audio CPU. The latch must be a concrete address in the I/O
  // page the board decodes (0xA100 sound_data_w, pooyan.cpp:306), not a stray or a whole-page mask.
  assert.equal(typeof SOUNDS.soundLatch, "number");
  assert.ok(Number.isInteger(SOUNDS.soundLatch), "soundLatch must be an integer address");
  assert.equal(SOUNDS.soundLatch & 0xff00, 0xa100, `${h(SOUNDS.soundLatch)} is not in the 0xA1xx page`);
});

test("the map is DATA ONLY -- no logic, no engine coupling", () => {
  // The player reads this file; this file reads nothing back. A function value here would be logic
  // smuggled into a data model (the whole reason the per-command table lives in the recorder, not here).
  const map = SOUNDS;
  assert.equal(typeof map, "object");
  assert.ok(map !== null && !Array.isArray(map), "the map must be a plain object");
  for (const [k, v] of Object.entries(map)) {
    assert.notEqual(typeof v, "function", `map.${k} is a function -- the map must be data only`);
  }
});

test("this map keeps Time Pilot's LATCH-TRIGGER path: no half-wired control port", () => {
  // Pooyan's LS259 sh_irqtrigger (bit 1, 0xA181) wakes the audio CPU, but boards/pooyan/io.js
  // forwards ONLY the 0xA100 write to the sound sink -- writeControlLatch never notifies. So the
  // player must key off the latch write itself (setupClipAudio: `ctrlPort == null` keeps the
  // latch-trigger). A declared `ports.control` that the board never emits would silence the game;
  // this pins that the committed map does NOT declare one.
  assert.equal(SOUNDS.ports?.control ?? null, null,
    "ports.control is declared but the board never forwards the control latch -- the game would go silent");
  assert.equal(SOUNDS.ports?.intBit ?? null, null,
    "ports.intBit is declared without a forwarded control port -- it can never fire");
});

test("IF a control port is ever declared it must be a coherent LS259 bit (guards a future switch)", (t) => {
  // Not the current design (see above), but if someone later wires writeControlLatch through to the
  // sink and switches to the control-trigger path, the port they declare must be a real LS259
  // sh_irqtrigger surface: an integer in 0xA180-0xA187, a distinct address from the sound latch, and
  // an intBit inside a byte. This arm skips on the committed latch-trigger map and only bites a change.
  const c = SOUNDS.ports?.control;
  if (c == null) { t.skip("latch-trigger map declares no control port -- nothing to check"); return; }
  assert.ok(Number.isInteger(c), "control port must be an integer address");
  assert.ok(c >= 0xa180 && c <= 0xa187, `${h(c)} is outside the LS259 mainlatch 0xA180-0xA187`);
  assert.notEqual(c, SOUNDS.soundLatch, "the control port must be a distinct surface from the sound latch");
  const b = SOUNDS.ports?.intBit;
  assert.ok(Number.isInteger(b) && b >= 0 && b <= 7, `intBit ${b} is not a bit index 0-7`);
});

test("the background-music beds map is a coherent multi-context declaration", () => {
  // Pooyan loops one MUSIC-ONLY bed per context UNDER the effects (samples/bed_*.wav, gitignored) because its
  // melody is sequenced by the unemulated 2nd Z80, not carried by a per-command clip. setupClipAudio
  // (web/player.html) loads each bed, selects by the music-select latch value (a beds key), and crossfades on a
  // change; a `stop` value fades out. Pin the shape + the grounded rules: stop includes 0x00 (game-over silence),
  // 0x82 (a per-kill accent) is NEVER a bed key, and bedGain cancels the SFX masterGain so the music stays quiet.
  const bg = SOUNDS.backgroundMusic;
  if (bg == null) return; // a game may ship no music; only check the declaration when it is present
  assert.ok(bg.beds && typeof bg.beds === "object" && !Array.isArray(bg.beds), "backgroundMusic.beds must be a value->bed map");
  const keys = Object.keys(bg.beds).map(Number);
  assert.ok(keys.length > 0, "backgroundMusic.beds is empty");
  for (const k of keys) {
    assert.ok(Number.isInteger(k) && k >= 0 && k <= 0xff, `bed key ${k} is not a latch byte`);
    assert.ok(typeof bg.beds[k] === "string" && bg.beds[k].length > 0, `bed key ${h(k)} has no bed file name`);
  }
  assert.ok(!keys.includes(0x82), "0x82 is a per-kill accent, not music -- it must not select a bed");
  assert.ok(Array.isArray(bg.stop) && bg.stop.includes(0x00), "backgroundMusic.stop must include 0x00 (the silence selector)");
  const overlap = keys.filter((k) => bg.stop.includes(k));
  assert.equal(overlap.length, 0, `a value both selects and stops the bed: ${overlap.map(h)}`);
  assert.ok(Number.isFinite(bg.bedGain) && bg.bedGain > 0, "backgroundMusic.bedGain must be a positive number");
  // The faithful balance: bedGain x masterGain ~= 1, so the beds (which go through the SFX-boosted master)
  // play back at their natural captured (MAME) music level rather than the SFX boost.
  const master = SOUNDS.masterGain ?? 0.7;
  assert.ok(Math.abs(bg.bedGain * master - 1) < 0.15,
    `bedGain (${bg.bedGain}) x masterGain (${master}) should be ~1 (music at natural level), got ${(bg.bedGain * master).toFixed(2)}`);
});

test("SOUNDS.masterGain, when declared, is a sane per-game SFX gain", () => {
  // A per-game SFX level the web player passes to the SamplePlayer master (default 0.7 for the frozen clips
  // games). Must be a positive number within clampGain's ceiling so a game cannot silence or blow out its SFX.
  const m = SOUNDS.masterGain;
  if (m == null) return; // absent -> the player's 0.7 default
  assert.ok(Number.isFinite(m) && m > 0 && m <= 4, `masterGain ${m} must be in (0, 4] (clampGain's ceiling)`);
});

// --- optional: cross-check the recorded clips when present (gitignored copyright, so absent in a clone) ---

test("the recorded index.json, when present, is the clip shape the player + latch model expect", (t) => {
  const idxPath = new URL("../audio/samples/index.json", import.meta.url);
  if (!existsSync(idxPath)) {
    t.skip("samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = JSON.parse(readFileSync(idxPath, "utf-8"));
  assert.ok(Array.isArray(index.clips), "index.json has no clips array");
  assert.ok(index.clips.length > 0, "index.json records no clips");
  const commands = new Set();
  for (const c of index.clips) {
    const where = c && c.id != null ? `clip ${c.id}` : "a clip";
    // Every clip is keyed by a single-byte command (the soundLatch carries one byte) and an id the
    // player loads it under; setupClipAudio does `Number.isInteger(c.command)` and `player.loadSample(c.id...)`.
    assert.ok(Number.isInteger(c.command), `${where} has a non-integer command`);
    assert.ok(c.command >= 0 && c.command <= 0xff, `${where} command ${c.command} is not a byte`);
    assert.ok(typeof c.id === "string" && c.id.length > 0, `${where} has no id to load its clip under`);
    assert.equal(typeof c.silent, "boolean", `${where} has no silent flag`);
    // A sounding clip has a file; a silent one is allowed a null file (the player skips it).
    if (!c.silent) assert.ok(typeof c.file === "string" && c.file.length > 0, `${where} sounds but has no file`);
    assert.ok(!commands.has(c.command), `${where}: duplicate command ${c.command} in the index`);
    commands.add(c.command);
  }
});

test("background-music bed keys are NOT sounding command clips (they select the sequencer)", (t) => {
  // A music-run lead selects the audio CPU's tune and sounds NOTHING in isolation (it is not in the
  // recorder's sweep of sounding commands). If a bed key were also a sounding clip, the effect clip and the
  // looping bed would both fire on that write and collide. Cross-check the bed keys against the recording.
  const bg = SOUNDS.backgroundMusic;
  if (bg?.beds == null) { t.skip("no music beds declared"); return; }
  const idxPath = new URL("../audio/samples/index.json", import.meta.url);
  if (!existsSync(idxPath)) { t.skip("samples/index.json absent (recorded clips are gitignored, BYO)"); return; }
  const index = JSON.parse(readFileSync(idxPath, "utf-8"));
  const sounding = new Set((index.clips ?? []).filter((c) => c && !c.silent).map((c) => c.command));
  for (const k of Object.keys(bg.beds).map(Number)) {
    assert.ok(!sounding.has(k), `bed key ${h(k)} is a SOUNDING clip -- a music-select command must sound nothing in isolation`);
  }
});
