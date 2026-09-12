// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_af77 (ROM 0xaf77-0xaf80) -- packs A to BCD via loc_aaf5, then tail-emits the
// single zeropage byte at $29 through loc_dfb1. The idiomatic side dissolves jsr $aaf5 and the jmp $dfb1
// tail-call into direct loc_aaf5(m,a) / loc_dfb1(m,0x29,0x01) calls. Live-out is memory only (the emit
// list + zeropage; A/X/Y at RTS are incidental), so each arm compares RAM (dumpState minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-af77.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_af77 as oracle } from "../../translated/loc_af77.js";
import { loc_af77 } from "../loc_af77.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { loc_aaf5 } from "../loc_aaf5.js";
import { STACK_SCRATCH, loc_29, loc_2c, loc_74 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xaf77;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 4000) : [];

test("CAPTURE: real 0xaf77 dispatches -- loc_af77 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_af77(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// A non-zero source byte packs to a non-trivial BCD, and a list cursor aimed into vector RAM makes the
// emit land in the diffed region. Both sides pull A from m.regs.a (default bridge), so seat it explicitly.
function seed(m, aVal) {
  m.regs.a = aVal;
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_74 + 1, 0x21); // ($74) -> 0x2100 (vector RAM, diffed)
}

test("CRAFTED: A=0x4b packs to BCD at $29/$2c and emits -- RAM equal", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x4b);
  const c = new Machine(ROM, OPTS); seed(c, 0x4b);
  oracle(o); loc_af77(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after pack + emit");
  assert.equal(c.mem.read8(loc_29), c.mem.read8(loc_2c), "$29 and $2c both hold the packed BCD");
});

test("CRAFTED: A=0x00 (non-default seed) -- RAM equal", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x00);
  const c = new Machine(ROM, OPTS); seed(c, 0x00);
  oracle(o); loc_af77(c);
  assert.equal(ramDiff(o, c), null, "RAM equal for the zero source byte");
});

test("TEETH: a twin that skips the dfb1 tail-emit diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x4b); oracle(o);
  const c = new Machine(ROM, OPTS); seed(c, 0x4b);
  const brokenAf77 = (m, a = m.regs.a) => { loc_aaf5(m, a); /* BUG: never emits the byte */ };
  brokenAf77(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped emit");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_74 + 1, 0x21);
  const r = seamPlaceable(withOmittedRet, loc_af77, TARGET, m);
  assert.equal(r.placeable, true, `loc_af77 must be seam-placeable; got: ${r.error}`);
});
