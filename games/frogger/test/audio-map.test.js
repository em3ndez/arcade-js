// SPDX-License-Identifier: GPL-3.0-only
//
// Coverage + coherence gate for the Frogger sound-command map (audio/sounds.js). It CANNOT prove a clip
// sounds right -- there is no oracle -- but it stops the map from drifting incoherent or falling behind
// the code: every command the ROM actually sends must be mapped, the vocabularies must stay closed, and
// a command a routine treats as a sound but the hardware plays silent must carry an explicit conflict.
//
// The emit set and the vocabularies are RESTATED here, not imported from the map, on purpose: importing
// would validate the module against its own opinion. Needs no ROM and no audio device -- runs on any
// clone; the optional last arm additionally cross-checks the recorded clips when they are present.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import SOUNDS, { KINDS, SOURCES, CONFIDENCE } from "../audio/sounds.js";

// Independent restatement of the allowed vocabularies (see header).
const ALLOWED_KIND = ["oneshot", "sustained", "control"];
const ALLOWED_SOURCE = ["ay8910", "none"];
const ALLOWED_CONFIDENCE = ["confirmed", "inferred", "unknown"];

// The commands the ROM emits, enumerated MECHANICALLY by scanning every enqueue/issueSoundCommand call
// site in the idiomatic layer and resolving each argument (a hex/decimal literal, or a local `const NAME
// = 0xHH`). Deriving this from source -- not a hand-list that could share the map's blind spots -- is what
// lets the coverage test actually catch a new emit site the map forgot. The dynamic drainer (mem8[...])
// and the two primitive definitions (cmd = m.regs.a) resolve to no literal and are correctly skipped.
function scanEmitSet() {
  const dir = new URL("../idiomatic/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".js") && f !== "names.js");
  const CALL = /\b(?:enqueue|issue)SoundCommand\s*\(\s*m\s*,\s*([^)]+?)\s*\)/g;
  const set = new Set();
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), "utf-8");
    const consts = new Map();
    for (const m of src.matchAll(/\b([A-Z][A-Z0-9_]+)\s*=\s*(0x[0-9a-fA-F]+|\d+)/g)) {
      if (!consts.has(m[1])) consts.set(m[1], parseInt(m[2]));
    }
    for (const m of src.matchAll(CALL)) {
      const a = m[1].trim();
      let v = null;
      if (/^0x[0-9a-fA-F]+$/.test(a)) v = parseInt(a, 16);
      else if (/^\d+$/.test(a)) v = parseInt(a, 10);
      else if (consts.has(a)) v = consts.get(a);
      if (v !== null) set.add(v);
    }
  }
  return [...set].sort((a, b) => a - b);
}

const h = (v) => "0x" + v.toString(16).padStart(2, "0");
const entries = () => Object.entries(SOUNDS.commands).map(([k, v]) => [Number(k), v]);

test("the exported vocabularies match this test's independent restatement", () => {
  assert.deepEqual([...KINDS].sort(), [...ALLOWED_KIND].sort());
  assert.deepEqual([...SOURCES].sort(), [...ALLOWED_SOURCE].sort());
  assert.deepEqual([...CONFIDENCE].sort(), [...ALLOWED_CONFIDENCE].sort());
});

test("the map is a clips model on the PPI1.A latch", () => {
  assert.equal(SOUNDS.model, "clips");
  assert.equal(SOUNDS.soundLatch, 0xd000);
});

test("every entry has a name and the four classification fields", () => {
  const es = entries();
  assert.ok(es.length > 0, "the map is empty");
  for (const [k, e] of es) {
    const where = `0x${k.toString(16)}`;
    assert.equal(typeof e.name, "string", `${where} has no name`);
    assert.ok(e.name.length > 0, `${where} has an empty name`);
    assert.ok(ALLOWED_KIND.includes(e.kind), `${where} kind=${e.kind}`);
    assert.ok(ALLOWED_SOURCE.includes(e.source), `${where} source=${e.source}`);
    assert.ok(ALLOWED_CONFIDENCE.includes(e.confidence), `${where} confidence=${e.confidence}`);
  }
});

test("every entry carries provenance: a fires string and a non-empty evidence array", () => {
  for (const [k, e] of entries()) {
    const where = `0x${k.toString(16)}`;
    assert.ok(typeof e.fires === "string" && e.fires.length > 0, `${where} does not say when it fires`);
    assert.ok(Array.isArray(e.evidence) && e.evidence.length > 0, `${where} has no evidence`);
    for (const c of e.evidence) assert.ok(typeof c === "string" && c.length > 0, `${where} bad citation`);
  }
});

test("every entry carries a measured block distinct from its ROM-usage kind", () => {
  for (const [k, e] of entries()) {
    const where = `0x${k.toString(16)}`;
    assert.equal(typeof e.measured, "object", `${where} has no measured block`);
    // true = audible, false = silent, null = context-dependent (a pair tail not measurable in isolation).
    assert.ok([true, false, null].includes(e.measured.audible), `${where} measured.audible=${e.measured.audible} (true|false|null)`);
    assert.equal(typeof e.measured.durationSec, "number", `${where} measured.durationSec not a number`);
    // audible <=> a real duration; silent/context-dependent <=> zero.
    if (e.measured.audible !== true) assert.equal(e.measured.durationSec, 0, `${where} not audible-true but non-zero`);
    if (e.measured.audible === true) assert.ok(e.measured.durationSec > 0, `${where} audible but zero-length`);
  }
});

test("names are unique across all commands", () => {
  const seen = new Map();
  for (const [k, e] of entries()) {
    assert.ok(!seen.has(e.name), `duplicate name '${e.name}': 0x${seen.get(e.name)} and 0x${k.toString(16)}`);
    seen.set(e.name, k.toString(16));
  }
});

test("a pure control byte (source none) makes no sound; an intended sound not measured audible flags it", () => {
  for (const [k, e] of entries()) {
    const where = `0x${k.toString(16)}`;
    if (e.source === "none") {
      assert.equal(e.measured.audible, false, `${where} has no source but was measured audible`);
    }
    // A byte a routine sends AS a sound (source ay8910) that the hardware did NOT clearly play (silent, or
    // context-dependent null) is a contradiction -- it must carry an explicit conflict, never a quiet pick.
    if (e.source === "ay8910" && e.measured.audible !== true) {
      assert.ok(typeof e.conflict === "string" && e.conflict.length > 0,
        `${where} is sent as a sound but not measured audible, with no conflict noted`);
    }
  }
});

test("the map covers exactly the commands the ROM emits -- scanned from source, no gaps or invented entries", () => {
  const emitted = scanEmitSet();
  // Positive control: a broken scan returning nothing must not pass by matching an empty map.
  assert.ok(emitted.length >= 20, `scanEmitSet found only ${emitted.length} emit sites -- the scanner is broken`);
  const mapped = entries().map(([k]) => k).sort((a, b) => a - b);
  assert.deepEqual(mapped.map(h), emitted.map(h),
    "the map's commands must equal the emit set scanned from idiomatic/: a new emit site or a removed byte must be reflected in audio/sounds.js");
});

// --- optional: cross-check the recorded clips when present (gitignored copyright, so absent in a clone) ---

test("the map's measured audibility matches the recorded clips", (t) => {
  const idxPath = new URL("../audio/samples/index.json", import.meta.url);
  if (!existsSync(idxPath)) {
    t.skip("samples/index.json absent (recorded clips are gitignored copyright, BYO)");
    return;
  }
  const index = JSON.parse(readFileSync(idxPath, "utf-8"));
  const byCmd = new Map(index.clips.map((c) => [c.command, c]));
  for (const [k, e] of entries()) {
    const c = byCmd.get(k);
    if (!c) continue; // a command the sweep did not cover is not evidence either way
    if (e.measured.audible === null) continue; // context-dependent pair tail -- one isolation pass is not dispositive
    assert.equal(!c.silent, e.measured.audible,
      `0x${k.toString(16)}: map says audible=${e.measured.audible} but the recording says silent=${c.silent}`);
    if (e.measured.audible) assert.ok(c.file, `0x${k.toString(16)} is audible but has no clip file`);
  }
});
