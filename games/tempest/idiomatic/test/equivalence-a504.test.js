// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a504 (ROM 0xa504-0xa5ca) -- a sign-split routine: the positive arm bumps a
// slot timer and conditionally resets shot state (jsr $a5cb, jsr $928f); the negative arm ages the shot
// table, advances a clock/counter, and clamps a running total (jsr $928f). The idiomatic side dissolves
// every jsr into direct loc_a5cb / loc_928f calls. Live-out is memory only, so each arm compares RAM
// (dumpState minus STACK_SCRATCH). Run: node --test games/tempest/idiomatic/test/equivalence-a504.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a504 as oracle } from "../../translated/loc_a504.js";
import { loc_a504 } from "../loc_a504.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import {
  STACK_SCRATCH, loc_00, loc_3d, loc_48, loc_a6, loc_106, loc_108, loc_109,
  loc_116, loc_11b, loc_11c, loc_135, loc_201, loc_202, loc_2df, loc_3ab, loc_455,
} from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa504;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 2000) : [];

test("CAPTURE: real 0xa504 dispatches -- loc_a504 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_a504(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Negative arm, full path: age the shot table, take the $0202 counter branch past its ceiling, then
// run the tail (sets $00, jsr $928f, clamps the $03ab total).
function seedNegative(m) {
  m.mem.write8(loc_201, 0x80);            // bit7 set -> negative arm
  m.mem.write8(loc_135, 0x00);
  m.mem.write8(loc_a6, 0x00);
  m.mem.write8(loc_116, 0x00);            // gate clear -> proceed to age loop
  m.mem.write8(loc_11c, 0x02);            // age three shot entries
  m.mem.write8((loc_2df + 0) & 0xffff, 0x05);
  m.mem.write8((loc_2df + 1) & 0xffff, 0x00);
  m.mem.write8((loc_2df + 2) & 0xffff, 0xf5); // ceiling -> snaps to 0
  m.mem.write8(loc_3d, 0x00);
  m.mem.write8((loc_48 + 0) & 0xff, 0x00); // != 1 -> the $0202 branch
  m.mem.write8(loc_202, 0xf0);             // +0x0f crosses the ceiling -> proceed
  m.mem.write8(loc_108, 0x10);
  m.mem.write8(loc_109, 0x10);
  m.mem.write8(loc_3ab, 0x05);
}

test("CRAFTED negative: age + counter + tail -- RAM equal, $0202 stepped, $03ab clamped", () => {
  const o = new Machine(ROM, OPTS); seedNegative(o);
  const c = new Machine(ROM, OPTS); seedNegative(c);
  oracle(o); loc_a504(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the negative arm");
  assert.equal(c.mem.read8(loc_202), 0xff, "$0202 advanced by 0x0f");
  assert.equal(c.mem.read8(loc_00), 0x06, "tail seeded $00");
  assert.equal(c.mem.read8(loc_3ab), 0x25, "$03ab total clamped");
});

// Positive arm, reset path: gate clear, no shot past threshold -> loc_a5cb + loc_928f both run.
function seedPositive(m) {
  m.mem.write8(loc_201, 0x00);   // bit7 clear -> positive arm
  m.mem.write8(loc_455, 0x00);
  m.mem.write8(loc_11b, 0x00); // gate byte
  m.mem.write8(loc_106, 0x00);   // don't early-return
  m.mem.write8(loc_3ab, 0x00);
  m.mem.write8(loc_116, 0x00);   // enter the reset scan
  m.mem.write8(loc_11c, 0x02);
  for (let i = 0; i <= 2; i++) m.mem.write8((loc_2df + i) & 0xffff, 0x00); // nothing past threshold
}

test("CRAFTED positive: reset path dissolves loc_a5cb + loc_928f -- RAM equal", () => {
  const o = new Machine(ROM, OPTS); seedPositive(o);
  const c = new Machine(ROM, OPTS); seedPositive(c);
  oracle(o); loc_a504(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the positive reset path");
});

test("TEETH: a twin that skips the negative arm's work diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedNegative(o);
  const c = new Machine(ROM, OPTS); seedNegative(c);
  oracle(o);
  const brokenA504 = (_m) => { /* BUG: neither ages the table nor advances the counter/tail */ };
  brokenA504(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped work");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_a504, TARGET, m);
  assert.equal(r.placeable, true, `loc_a504 must be seam-placeable; got: ${r.error}`);
});
