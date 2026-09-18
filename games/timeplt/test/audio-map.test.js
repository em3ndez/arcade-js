// SPDX-License-Identifier: GPL-3.0-only
//
// Coverage + coherence gate for the Time Pilot sound "map". Time Pilot commits no per-command table --
// that table is a MEASUREMENT OF YOUR OWN ROM (the second Z80 + two AY-3-8910s are not emulated), so it
// lives in the recorder's gitignored audio/samples/index.json, exactly as the WAVs do. What IS committed
// is the model SHAPE the player needs (audio/sounds.js: model + soundLatch). This test pins that shape,
// and -- when the local recording is present -- checks the measurement is internally coherent: the
// commands are the swept range, every audible one carries a real clip file, no audible request code is a
// >=0x80 control byte, and the recorder agrees with sounds.js on the latch address.
//
// It cannot prove a clip SOUNDS right -- there is no oracle. It stops the wiring from drifting incoherent
// or the measurement from silently contradicting itself. Needs no ROM and no audio device: the index arm
// skips on any clone where the gitignored recording is absent (a 404 on index.json is the normal path).

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import manifest from "../manifest.js";
import SOUNDS from "../audio/sounds.js";

const indexPath = new URL("../audio/samples/index.json", import.meta.url);
const hasIndex = () => existsSync(fileURLToPath(indexPath));
const loadIndex = () => JSON.parse(readFileSync(fileURLToPath(indexPath), "utf-8"));

test("the committed model is the bare clips shape the player interprets", () => {
  assert.equal(SOUNDS.model, "clips");
  assert.equal(SOUNDS.soundLatch, 0xc000);
  assert.equal(typeof SOUNDS.soundLatch, "number");
  // No committed per-command table: the measurement is index.json, never source.
  assert.equal(SOUNDS.commands, undefined);
  assert.equal(manifest.audio?.samples, "audio/samples", "the recorder writes clips + index.json here");
});

test("index.json is a coherent per-command measurement", (t) => {
  if (!hasIndex()) {
    t.skip("audio/samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  assert.ok(Array.isArray(index.clips), "index.json has no clips array");
  // Positive control: a broken scan returning nothing must not pass by matching an empty expectation.
  assert.ok(index.clips.length >= 20, `only ${index.clips.length} clips -- the recorder/index is broken`);

  const seen = new Set();
  for (const c of index.clips) {
    const where = `0x${Number(c.command).toString(16)}`;
    assert.ok(Number.isInteger(c.command) && c.command >= 0 && c.command <= 0xff, `${where} bad command byte`);
    assert.ok(!seen.has(c.command), `duplicate command ${where}`);
    seen.add(c.command);
    assert.equal(typeof c.silent, "boolean", `${where} silent is not a boolean`);
    assert.ok(c.file === null || typeof c.file === "string", `${where} file is neither a name nor null`);
    // A command the recorder judged AUDIBLE must carry a real clip file, named in decimal by
    // record_samples.py; a file present at all must follow that convention (a silent 0x1F may keep one).
    if (!c.silent) assert.ok(c.file, `${where} is not silent but has no clip file`);
    if (c.file) assert.equal(c.file, `cmd_${c.command}.wav`, `${where} clip name is not cmd_<decimal>.wav`);
  }
});

test("the swept command space is contiguous from 0, and every AUDIBLE code is < 0x80", (t) => {
  if (!hasIndex()) {
    t.skip("audio/samples/index.json absent (gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  const cmds = index.clips.map((c) => c.command).sort((a, b) => a - b);
  // The default sweep is a contiguous byte range from 0 (README-samples.md: 0x00-0x1F). Pin no gaps, so a
  // clip dropped out of the index -- not just off disk -- is caught.
  for (let i = 0; i < cmds.length; i++) {
    assert.equal(cmds[i], i, `the swept range has a gap at 0x${i.toString(16)} (command ${cmds[i]} out of place)`);
  }
  // README: every audible REQUEST code is < 0x80; >=0x80 are audio-CPU control bytes that sound nothing.
  // So no clip the player would play may sit at a control code.
  const audible = index.clips.filter((c) => c.file && !c.silent && Number.isInteger(c.command));
  for (const c of audible) {
    assert.ok(c.command < 0x80, `0x${c.command.toString(16)} is an audible clip at a >=0x80 control code`);
  }
});

test("the recorder records the two sound addresses, and agrees with sounds.js on the latch", (t) => {
  if (!hasIndex()) {
    t.skip("audio/samples/index.json absent (gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  // The command latch the player listens on, and the attention edge that wakes the real audio CPU. The
  // player keys off the latch (0xC000); the attention line (0xC304) is recorded for provenance.
  assert.equal(String(index.sound_latch).toLowerCase(), "0x" + SOUNDS.soundLatch.toString(16),
    "index.json sound_latch disagrees with sounds.js soundLatch -- the player would key off the wrong address");
  assert.equal(String(index.audio_attention).toLowerCase(), "0xc304",
    "index.json lost the 0xC304 attention line the recorder pulses to deliver a command");
});
