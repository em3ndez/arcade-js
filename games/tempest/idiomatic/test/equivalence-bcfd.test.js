// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_bcfd (ROM 0xbcfd-0xbd08) -- stores A at $55, loads $56/$58 from the two
// indexed tables $0435/$0445,Y, then falls through into loc_bd09. The idiomatic side dissolves the
// fall-through into a direct loc_bd09(m) tail call. Live-out is memory only, so each arm compares RAM
// (dumpState minus STACK_SCRATCH); registers are NOT asserted.
// Run: node --test games/tempest/idiomatic/test/equivalence-bcfd.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_bcfd as oracle } from "../../translated/loc_bcfd.js";
import { loc_bcfd } from "../loc_bcfd.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { loc_bd09 } from "../loc_bd09.js";
import { STACK_SCRATCH, loc_55, loc_56, loc_58, loc_74, loc_435, loc_445 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xbcfd;
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

test("CAPTURE: real 0xbcfd dispatches -- loc_bcfd == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_bcfd(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Distinct A/Y and a ($74) cursor into vector RAM so the emitted bytes land in diffed RAM.
function seedDistinct(m) {
  m.regs.a = 0x2a; m.regs.y = 0x05;
  // distinct per-index table values so an off-by-one index reads a different byte (teeth)
  for (let i = 0; i < 8; i++) { m.mem.write8(u16(loc_435 + i), 0x30 + i); m.mem.write8(u16(loc_445 + i), 0x50 + i); }
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_74 + 1, 0x24); // ($74) -> 0x2400
}

test("CRAFTED: distinct A/Y -- loc_bcfd == oracle in RAM, work cells seated", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  oracle(o); loc_bcfd(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after store + table loads + emit");
  assert.equal(c.mem.read8(loc_55), 0x2a, "$55 = A");
  assert.equal(c.mem.read8(loc_56), c.mem.read8(u16(loc_435 + 5)), "$56 = [$0435+Y]");
  assert.equal(c.mem.read8(loc_58), c.mem.read8(u16(loc_445 + 5)), "$58 = [$0445+Y]");
});

test("TEETH: a twin that skips the two table loads diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  oracle(o);
  const brokenBcfd = (m, a = m.regs.a) => {
    m.mem8[loc_55] = a; // BUG: never loads $56/$58, never emits
  };
  brokenBcfd(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped loads");
});

test("TEETH (marshalling): a twin that reads the tables at the wrong index diverges", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o); oracle(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  const wrongIndex = (m, a = m.regs.a, y = m.regs.y) => {
    const mem8 = m.mem8;
    mem8[loc_55] = a;
    mem8[loc_56] = mem8[u16(loc_435 + y + 1)]; // BUG: off-by-one index
    mem8[loc_58] = mem8[u16(loc_445 + y + 1)];
    loc_bd09(m);
  };
  wrongIndex(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong index");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_bcfd, TARGET, m);
  assert.equal(r.placeable, true, `loc_bcfd must be seam-placeable; got: ${r.error}`);
});
