// SPDX-License-Identifier: GPL-3.0-only
//
// Coverage + coherence gate for The Pit sound-command map. The Pit is a CLIPS game whose per-command table
// is a MEASUREMENT of your own ROM: it lives in the recorder's index.json (gitignored copyright), not in
// committed source (audio/sounds.js is model + latch only). This test CANNOT prove a clip sounds right --
// there is no oracle -- but it stops the recorded map from drifting incoherent or falling out of shape:
// every swept command is classified, the silent/sounding partition matches what the recorder + README
// measured, and the `silent <=> no file` invariant holds for every entry.
//
// The swept command set and the silent/sounding partition are RESTATED here (from tools/README-samples.md's
// "Measured results"), not imported from index.json, on purpose -- importing would validate the map against
// its own opinion. Needs no ROM and no audio device; the clip arms run only where the recordings are present.
//
// Run: node --test games/thepit/test/audio-map.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import SOUNDS from "../audio/sounds.js";

const samplesDir = new URL("../audio/samples/", import.meta.url);
const indexUrl = new URL("index.json", samplesDir);
const loadIndex = () => JSON.parse(readFileSync(indexUrl, "utf-8"));
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

// Independent restatement of the recorder's DEFAULT SWEEP (README-samples.md "Usage": commands
// 0x00-0x1f and 0x80-0x98) and its MEASURED partition ("Measured results": silent = 0x00-0x1f + 0x80/0x81;
// sounding = 0x82-0x98). Deriving these from the docs -- not a hand-copy of index.json -- is what lets the
// coverage test catch a re-record that quietly changes which commands were swept or which ones sound.
const SWEPT = [...range(0x00, 0x1f), ...range(0x80, 0x98)].sort((a, b) => a - b);
const SILENT = [...range(0x00, 0x1f), 0x80, 0x81].sort((a, b) => a - b);
const SOUNDING = range(0x82, 0x98);
const h = (v) => "0x" + Number(v).toString(16).padStart(2, "0");

// -- committed shape (always runs) ------------------------------------------

test("the map is a clips model on the 0xB800 soundlatch", () => {
  assert.equal(SOUNDS.model, "clips");
  assert.equal(SOUNDS.soundLatch, 0xb800);
});

// -- the recorded sweep's coverage + coherence (present in a checkout, gitignored in a clone) --

test("index.json is a well-formed recorder report", (t) => {
  if (!existsSync(indexUrl)) {
    t.skip("audio/samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  assert.equal(index.sound_latch, "0xB800", "the recorder swept a different latch than the map declares");
  assert.equal(typeof index.sample_rate, "number");
  assert.ok(Array.isArray(index.clips) && index.clips.length > 0, "index.json has no clips");
  for (const c of index.clips) {
    const where = `cmd ${h(c.command)}`;
    assert.ok(Number.isInteger(c.command), `${where}: command is not an integer`);
    assert.equal(typeof c.silent, "boolean", `${where}: silent is not a boolean`);
    assert.ok(c.file === null || (typeof c.file === "string" && c.file.length > 0),
      `${where}: file must be a filename or null, got ${JSON.stringify(c.file)}`);
    assert.ok(typeof c.id === "string" && c.id.length > 0, `${where}: has no id`);
  }
});

test("the sweep covers exactly the documented command set -- no gaps, no invented commands", (t) => {
  if (!existsSync(indexUrl)) {
    t.skip("audio/samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  // Positive control: a broken scan returning nothing must not pass by matching an empty expectation.
  assert.ok(index.clips.length >= 40, `only ${index.clips.length} clips -- the index read looks broken`);
  const swept = index.clips.map((c) => c.command).sort((a, b) => a - b);
  assert.deepEqual(swept.map(h), SWEPT.map(h),
    "the swept command set drifted from the documented 0x00-0x1f + 0x80-0x98 default sweep");
});

test("the silent/sounding partition matches what the recorder measured", (t) => {
  if (!existsSync(indexUrl)) {
    t.skip("audio/samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  const silent = index.clips.filter((c) => c.silent).map((c) => c.command).sort((a, b) => a - b);
  const sounding = index.clips.filter((c) => !c.silent).map((c) => c.command).sort((a, b) => a - b);
  assert.deepEqual(silent.map(h), SILENT.map(h),
    "the SILENT set drifted -- a command that used to be silent now sounds, or vice versa (re-review)");
  assert.deepEqual(sounding.map(h), SOUNDING.map(h),
    "the SOUNDING set drifted -- re-review the recording before pinning");
});

test("COHERENCE: silent <=> no file, and every sounding clip's file is present", (t) => {
  // The same load-bearing invariant the wiring test enforces, restated independently here so the coverage
  // gate is self-sufficient: a silent entry must not carry a sample, and a sounding entry's clip must exist.
  if (!existsSync(indexUrl)) {
    t.skip("audio/samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = loadIndex();
  const files = [];
  for (const c of index.clips) {
    const where = `cmd ${h(c.command)}`;
    if (c.silent) {
      assert.equal(c.file, null, `${where}: measured silent but was given a sample (${c.file})`);
    } else {
      assert.ok(c.file, `${where}: sounding but has no clip file`);
      assert.ok(existsSync(new URL(c.file, samplesDir)), `${where}: clip file ${c.file} is missing on disk`);
      files.push(c.file);
    }
  }
  assert.equal(new Set(files).size, files.length, "two sounding commands share a clip file");
});
