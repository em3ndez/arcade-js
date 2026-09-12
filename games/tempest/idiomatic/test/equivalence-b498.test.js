// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b498 -- builds the vector display list for active objects and tail-calls the
// header emitter. The idiomatic side dissolves jsr df4c/c765/df5f/df6a into direct calls. Live-out is the
// display-list RAM plus the coordinate scratch cells; the A carried out by the tail header emitter is
// validated by that callee's own equivalence, so each arm compares RAM (dumpState minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-b498.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b498 as oracle } from "../../translated/loc_b498.js";
import { loc_b498 } from "../loc_b498.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import {
  STACK_SCRATCH, loc_37, loc_46, loc_56, loc_68, loc_69, loc_74, loc_75, loc_b5,
  loc_203, loc_243, loc_35a, loc_36a, loc_37a, loc_38a,
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

const TARGET = 0xb498;
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

test("CAPTURE: real 0xb498 dispatches -- loc_b498 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b498(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// One active object near the top of the table: exercises the header build, the two coordinate
// words, the shadow negation, and the byte layout at the cursor.
function seedOneObject(m) {
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_75, 0x28); // cursor into vector RAM
  for (let i = 0; i <= 0x3f; i++) m.mem.write8(u16(loc_243 + i), 0x00); // no objects
  m.mem.write8(u16(loc_243 + 0x3f), 0x33); // one active object, kind < 0x50
  m.mem.write8(u16(loc_203 + 0x3f), 0x05); // object index 5
  m.mem.write8(u16(loc_38a + 0x05), 0x90);
  m.mem.write8(u16(loc_37a + 0x05), 0x02);
  m.mem.write8(u16(loc_36a + 0x05), 0x44);
  m.mem.write8(u16(loc_35a + 0x05), 0x03);
  m.mem.write8(loc_68, 0x10); m.mem.write8(loc_69, 0x00);
  m.mem.write8(loc_b5, 0x00); m.mem.write8(loc_46, 0x00);
}

test("CRAFTED: one active object -- display list and coord scratch match the oracle in RAM", () => {
  const o = new Machine(ROM, OPTS); seedOneObject(o);
  const c = new Machine(ROM, OPTS); seedOneObject(c);
  oracle(o); loc_b498(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after list build");
});

test("TEETH: a twin that skips the shadow-negation words diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedOneObject(o);
  const c = new Machine(ROM, OPTS); seedOneObject(c);
  oracle(o);
  const brokenB498 = (m) => {
    const mem8 = m.mem8;
    const base = mem8[loc_74] | (mem8[loc_75] << 8);
    for (let i = 0; i < 6; i++) mem8[u16(base + i)] = 0x00; // BUG: only a stub, no real list
    mem8[loc_56] = 0x11; mem8[loc_37] = 0xff;
  };
  brokenB498(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the stubbed build");
});

test("SP-TOOTH: the omitted-ret tail-caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seedOneObject(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_b498, TARGET, m);
  assert.equal(r.placeable, true, `loc_b498 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret tail-caller (moved 0) placeable");
});
