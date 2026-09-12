// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_9d82 (ROM 0x9d82-0x9e2e) -- advances slot x's turn animation. The idiomatic
// side dissolves the two jsr ($9ed7 direction lookup, $9f81 next-step kick) into direct calls, consuming
// loc_9ed7's returned direction for the match branch. Live-out is memory only (the result is stashed in
// $010c; A/X/Y at RTS are incidental), so each arm compares RAM (dumpState minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-9d82.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_9d82 as oracle } from "../../translated/loc_9d82.js";
import { loc_9d82 } from "../loc_9d82.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_2cc, loc_283, loc_2b9, loc_28a, loc_3ab, loc_2df, loc_202, loc_10c, loc_3ee } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x9d82;
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

test("CAPTURE: real 0x9d82 dispatches -- loc_9d82 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_9d82(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// state != 4, and the seeded ring table makes loc_9ed7's returned direction MATCH the stepped phase --
// so the walk branch fires. This makes the $9ed7 dissolve+return load-bearing: a wrong direction arg or a
// dropped return breaks the match and diverges. Slot 3, $0283=0x02 (low3=2, bit6 clear -> phase +1);
// $02cc 0x50 -> stepped 0x81; a=$0283^0x40=0x42 (half-turn) -> y=($02b9-1)&0xf=5, dir=(table[5]+8)&0xf|0x80;
// table[5]=9 -> dir=0x81 == stepped phase -> subtract branch: $02cc<-$02b9(6), $02b9<-5.
function seedMatch(m) {
  m.regs.x = 0x03;
  m.mem.write8(loc_283 + 3, 0x02);
  m.mem.write8(loc_2cc + 3, 0x50);
  m.mem.write8(loc_2b9 + 3, 0x06);
  m.mem.write8(loc_3ee + 5, 0x09);
  m.mem.write8(loc_10c, 0x5c); // dirty flag sentinel
}

test("CRAFTED (9ed7 dissolve): direction matches -> walk branch fires, RAM equal", () => {
  const o = new Machine(ROM, OPTS); seedMatch(o);
  const c = new Machine(ROM, OPTS); seedMatch(c);
  oracle(o); loc_9d82(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the matched walk");
  assert.equal(c.mem.read8(loc_2cc + 3), 0x06, "phase took the coord");
  assert.equal(c.mem.read8(loc_2b9 + 3), 0x05, "coord walked one step");
  assert.equal(c.mem.read8(loc_10c), 0x00, "state bit7 stashed");
});

// state == 4 settling with $02df == $0202 -> the jsr $9f81 next-step kick fires. Slot 3, $0283=0x04
// (low3=4, bit6 clear -> phase +1); $02cc 0x87 -> stepped 0x88 (low3=0, bit3 set -> bump $02b9);
// $03ab=0 and $02df==$0202 -> loc_9f81 runs. Validates the $9f81 dissolve.
function seedSettle(m) {
  m.regs.x = 0x03;
  m.mem.write8(loc_283 + 3, 0x04);
  m.mem.write8(loc_2cc + 3, 0x87);
  m.mem.write8(loc_2b9 + 3, 0x0a);
  m.mem.write8(loc_28a + 3, 0x11);
  m.mem.write8(loc_3ab, 0x00);
  m.mem.write8(loc_202, 0x55);
  m.mem.write8(loc_2df + 3, 0x55);
}

test("CRAFTED (9f81 dissolve): state 4 settles and kicks the next step, RAM equal", () => {
  const o = new Machine(ROM, OPTS); seedSettle(o);
  const c = new Machine(ROM, OPTS); seedSettle(c);
  oracle(o); loc_9d82(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the settle + 9f81 kick");
  assert.equal(c.mem.read8(loc_2cc + 3), o.mem.read8(loc_2cc + 3), "phase reseeded (matches oracle)");
});

test("TEETH: a twin that skips the $010c stash diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedMatch(o);
  const c = new Machine(ROM, OPTS); seedMatch(c);
  oracle(o);
  const broken9d82 = (m, x = m.regs.x) => {
    const { mem8 } = m;
    const stepDown = mem8[(loc_283 + x) & 0xffff] & 0x40;
    const phase = (stepDown ? mem8[(loc_2cc + x) & 0xffff] - 1 : mem8[(loc_2cc + x) & 0xffff] + 1) & 0xff;
    mem8[(loc_2cc + x) & 0xffff] = (phase & 0x0f) | 0x80;
    // BUG: never runs the state dispatch or the $010c stash
  };
  broken9d82(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped stash");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_9d82, TARGET, m);
  assert.equal(r.placeable, true, `loc_9d82 must be seam-placeable; got: ${r.error}`);
});
