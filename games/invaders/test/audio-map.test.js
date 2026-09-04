// SPDX-License-Identifier: GPL-3.0-only
//
// Consistency gate for the Space Invaders sound-command map (games/invaders/audio/sounds.js).
// The map is DATA the web audio adapter reads to decide what to play on each OUT 3/5 write; this test
// pins its shape and its one honesty rule -- a line the recorder measured SILENT (kind "none") gets NO
// clip -- so the map can never quietly claim a sound the hardware does not make. No ROM, no audio, no
// browser needed. The allowed vocabularies are RESTATED here (not imported from the map) so an edit to
// the map's own enum can't silently redefine what "valid" means.
//
// Run: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { SOUNDS, PORTS, KINDS, SOURCES } from "../audio/sounds.js";

const ALLOWED_KIND = ["oneshot", "loop", "none"];
const ALLOWED_SOURCE = ["discrete", "none"];

test("the exported vocabularies match this test's independent restatement", () => {
  assert.deepEqual([...KINDS].sort(), [...ALLOWED_KIND].sort());
  assert.deepEqual([...SOURCES].sort(), [...ALLOWED_SOURCE].sort());
});

test("ports name the two OUT sound lines (OUT 3 / OUT 5)", () => {
  assert.equal(PORTS.sound1, 3);
  assert.equal(PORTS.sound2, 5);
});

test("every key is <port>:<bit> with port in {3,5} and bit 0..7", () => {
  for (const key of Object.keys(SOUNDS)) {
    const m = /^(\d+):(\d+)$/.exec(key);
    assert.ok(m, `key ${key} is not <port>:<bit>`);
    const port = Number(m[1]), bit = Number(m[2]);
    assert.ok(port === 3 || port === 5, `key ${key}: port must be 3 or 5`);
    assert.ok(bit >= 0 && bit <= 7, `key ${key}: bit out of range`);
  }
});

test("every entry has a name, a valid kind and source", () => {
  const entries = Object.entries(SOUNDS);
  assert.ok(entries.length > 0, "the map is empty");
  for (const [where, e] of entries) {
    assert.equal(typeof e, "object", `${where} is not an object`);
    assert.ok(typeof e.name === "string" && e.name.length > 0, `${where}: empty name`);
    assert.ok(ALLOWED_KIND.includes(e.kind), `${where}: bad kind ${e.kind}`);
    assert.ok(ALLOWED_SOURCE.includes(e.source), `${where}: bad source ${e.source}`);
  }
});

test("the honesty rule: a sounding line has a clip; a `none` line has none", () => {
  for (const [where, e] of Object.entries(SOUNDS)) {
    if (e.kind === "none") {
      assert.equal(e.clip, undefined, `${where}: a none line must not claim a clip`);
      assert.equal(e.source, "none", `${where}: a none line's source must be none`);
    } else {
      assert.ok(typeof e.clip === "string" && e.clip.endsWith(".wav"),
        `${where}: a ${e.kind} line needs a .wav clip`);
      assert.equal(e.source, "discrete", `${where}: SI sounds are discrete-analogue`);
    }
  }
});

test("exactly one looped sound (the UFO tone) -- everything else is one-shot or none", () => {
  const loops = Object.entries(SOUNDS).filter(([, e]) => e.kind === "loop");
  assert.equal(loops.length, 1, "SI's only continuous/looped sound is the UFO");
  assert.equal(loops[0][0], "3:0", "the UFO is OUT 3 bit 0");
  assert.equal(loops[0][1].name, "ufo");
});

test("the documented SI sound lines are all present (OUT3 b0-b5, OUT5 b0-b4)", () => {
  for (let b = 0; b <= 5; b++) assert.ok(SOUNDS[`3:${b}`], `missing OUT3 bit ${b}`);
  for (let b = 0; b <= 4; b++) assert.ok(SOUNDS[`5:${b}`], `missing OUT5 bit ${b}`);
});

test("clip ids are unique and match the record_samples.py naming (out<port>_b<bit>.wav)", () => {
  const seen = new Set();
  for (const [key, e] of Object.entries(SOUNDS)) {
    if (!e.clip) continue;
    assert.ok(!seen.has(e.clip), `duplicate clip ${e.clip}`);
    seen.add(e.clip);
    const [port, bit] = key.split(":");
    assert.equal(e.clip, `out${port}_b${bit}.wav`, `${key}: clip name must match the recorder id`);
  }
});
