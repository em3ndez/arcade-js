// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a33a -- inserts an object tagged 5 via the shared tail (loc_a352),
// then decrements the $0201 pending counter. Dissolves the one jsr into a direct loc_a352 call,
// passing the entry X/Y (preserved across the callee). Output is RAM (a352's writes + $0201), so
// each arm compares the RAM diff (minus the dead stack) and checks X/Y preserved.
// Run: node --test games/tempest/idiomatic/test/equivalence-a33a.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a33a as oracle } from "../../translated/loc_a33a.js";
import { loc_a33a } from "../loc_a33a.js";
import { loc_a352 } from "../loc_a34b.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_5, loc_2c, loc_200, loc_201, loc_202, loc_13c } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa33a;
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

function seed(m) {
  m.regs.x = 0x05; m.regs.y = 0x03;   // register bridge into the sound gate + insert
  m.mem.write8(loc_5, 0x80);          // sound enable high bit
  m.mem.write8(loc_202, 0x77);        // source byte -> $29
  m.mem.write8(loc_200, 0x88);        // target byte -> $2d
  m.mem.write8(loc_201, 0x40);        // pending counter (a352 sets 0x81, then dec -> 0x80)
}

test("CAPTURE: real 0xa33a dispatches -- loc_a33a == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_a33a(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.regs.x, o.regs.x, "X preserved");
    assert.equal(c.regs.y, o.regs.y, "Y preserved");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: insert runs, $0201 steps 0x81 -> 0x80 -- RAM equal, X/Y preserved", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_a33a(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after insert + decrement");
  assert.equal(c.regs.x, o.regs.x, "X preserved");
  assert.equal(c.regs.y, o.regs.y, "Y preserved");
  assert.equal(c.mem.read8(loc_2c), 0x05, "$2c tagged 5");
  assert.equal(c.mem.read8(loc_201), 0x80, "$0201 decremented");
  assert.equal(c.mem.read8(loc_13c), 0x01, "$013c ready flag");
});

test("TEETH: a twin that skips the decrement leaves $0201 at 0x81 and diverges", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const broken = (m, x = m.regs.x, y = m.regs.y) => {
    loc_a352(m, 0x05, x, y);           // BUG: never decrements $0201
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped decrement");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_a33a, TARGET, m);
  assert.equal(r.placeable, true, `loc_a33a must be seam-placeable; got: ${r.error}`);
});
