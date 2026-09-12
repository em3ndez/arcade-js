// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_9e2f (ROM 0x9e2f-0x9e47) -- a per-slot guard that calls $a33a only when the
// slot is live ($0283,x >= 0) and both cell coords ($02b9,x==$0200, $02cc,x==$0201) match. The idiomatic
// side dissolves the jsr $a33a into a direct loc_a33a(m, x) call. Effect is memory-only, so each arm
// compares RAM (dumpState minus STACK_SCRATCH); registers are not asserted (the dissolved callee leaves
// them per its own contract). Run: node --test games/tempest/idiomatic/test/equivalence-9e2f.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_9e2f as oracle } from "../../translated/loc_9e2f.js";
import { loc_9e2f } from "../loc_9e2f.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_200, loc_201, loc_283, loc_2b9, loc_2cc } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x9e2f;
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

test("CAPTURE: real 0x9e2f dispatches -- loc_9e2f == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_9e2f(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Guard passes on slot 0: live slot, both coords match -> jsr $a33a fires on both arms.
function seedMatch(m) {
  m.regs.x = 0; m.regs.y = 0;
  m.mem.write8(loc_283, 0x10);            // live slot (bit7 clear)
  m.mem.write8(loc_2b9, 0x33); m.mem.write8(loc_200, 0x33); // first coord matches target
  m.mem.write8(loc_2cc, 0x44); m.mem.write8(loc_201, 0x44); // second coord matches target
}

test("CRAFTED (call path): live slot with both coords matching -- loc_9e2f == oracle in RAM", () => {
  const o = new Machine(ROM, OPTS); seedMatch(o);
  const c = new Machine(ROM, OPTS); seedMatch(c);
  oracle(o); loc_9e2f(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the $a33a call");
  assert.equal(c.mem.read8(loc_201), 0x80, "the $a33a tail set $0201=0x81 then decremented it");
});

// Each bail path: dead slot, first-coord mismatch, second-coord mismatch. No sub-call fires.
function seedDead(m) {
  m.regs.x = 0; m.regs.y = 0;
  m.mem.write8(loc_283, 0x80);            // dead slot (bit7 set)
  m.mem.write8(loc_2b9, 0x33); m.mem.write8(loc_200, 0x33);
  m.mem.write8(loc_2cc, 0x44); m.mem.write8(loc_201, 0x44);
}
function seedMiss1(m) { seedMatch(m); m.mem.write8(loc_200, 0x99); } // first coord differs
function seedMiss2(m) { seedMatch(m); m.mem.write8(loc_201, 0x99); } // second coord differs

for (const [name, seed] of [["dead slot", seedDead], ["first-coord mismatch", seedMiss1], ["second-coord mismatch", seedMiss2]]) {
  test(`CRAFTED (bail): ${name} -- RAM equal, $0201 untouched`, () => {
    const o = new Machine(ROM, OPTS); seed(o);
    const c = new Machine(ROM, OPTS); seed(c);
    const before = c.mem.read8(loc_201);
    oracle(o); loc_9e2f(c);
    assert.equal(ramDiff(o, c), null, "RAM equal on the bail path");
    assert.equal(c.mem.read8(loc_201), before, "$0201 unchanged (no $a33a)");
  });
}

test("TEETH: a twin that always calls $a33a diverges from the oracle on a bail seed", () => {
  const o = new Machine(ROM, OPTS); seedDead(o);
  const c = new Machine(ROM, OPTS); seedDead(c);
  oracle(o); // bails: leaves state untouched
  const brokenGuard = (m, x = m.regs.x) => { void x; oracle(m); m.mem.write8(loc_201, 0x00); }; // BUG: fires side-effects unconditionally
  brokenGuard(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the unconditional side-effect");
});

test("TEETH: a twin that skips the call on a matching seed diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedMatch(o);
  const c = new Machine(ROM, OPTS); seedMatch(c);
  oracle(o); // calls $a33a
  const brokenSkip = (_m) => { /* BUG: never calls $a33a */ };
  brokenSkip(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped $a33a call");
});

test("SP-TOOTH: the omitted-ret caller is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  seedDead(m); // bail path keeps the tooth deterministic
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_9e2f, TARGET, m);
  assert.equal(r.placeable, true, `loc_9e2f must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret caller placeable");
});
