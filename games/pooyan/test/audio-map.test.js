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
