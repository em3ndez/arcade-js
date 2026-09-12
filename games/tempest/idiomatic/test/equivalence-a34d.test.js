// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a34d (ROM 0xa34d) -- the $013b-seed mid-entry: stores the caller's A into the
// head flag $013b, then falls into the shared insert tail with a fixed type byte 0x01 (so $2c = 0x01),
// copying $0202->$29 / $0200->$2d, firing the sound gate and table insert with the entry X/Y, and raising
// the ready flags. The idiomatic side dissolves the fall-through into a direct loc_a352 call. Live-out is
// memory (X/Y preserved); each arm compares RAM (dumpState minus STACK_SCRATCH) and checks X/Y unchanged.
// Run: node --test games/tempest/idiomatic/test/equivalence-a34d.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a34d as oracle } from "../../translated/loc_a34b.js";
import { loc_a34d } from "../loc_a34b.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_5, loc_2c, loc_13b, loc_13c, loc_200, loc_201, loc_202 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa34d;
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

test("CAPTURE: real 0xa34d dispatches -- loc_a34d == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_a34d(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.regs.x, o.regs.x, "X preserved");
    assert.equal(c.regs.y, o.regs.y, "Y preserved");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

function seed(m, a) {
  m.regs.a = a; m.regs.x = 0x05; m.regs.y = 0x03; // A = head-flag value; X/Y bridge to the callees
  m.mem.write8(loc_5, 0x80);
  m.mem.write8(loc_202, 0x77);
  m.mem.write8(loc_200, 0x88);
}

test("CRAFTED: head flag seeded, then the type-1 insert runs -- RAM equal and X/Y preserved", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x09);
  const c = new Machine(ROM, OPTS); seed(c, 0x09);
  oracle(o); loc_a34d(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after setup");
  assert.equal(c.regs.x, o.regs.x, "X preserved");
  assert.equal(c.regs.y, o.regs.y, "Y preserved");
  assert.equal(c.mem.read8(loc_13b), 0x09, "$013b = A (head flag)");
  assert.equal(c.mem.read8(loc_2c), 0x01, "$2c = 0x01 (fixed type)");
  assert.equal(c.mem.read8(loc_201), 0x81, "$0201 ready flag");
  assert.equal(c.mem.read8(loc_13c), 0x01, "$013c ready flag");
});

test("TEETH: a twin that stores the wrong head flag / skips the tail diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x09);
  const c = new Machine(ROM, OPTS); seed(c, 0x09);
  oracle(o);
  const broken = (m, a = m.regs.a) => { m.mem8[loc_13b] = (a ^ 0xff); /* BUG: wrong head flag + skips insert */ };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong head flag / skipped tail");
});
