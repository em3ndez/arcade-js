// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_d8a9 (ROM 0xd8a9-0xd8b5) -- stashes A at $29, scales Y,X via loc_df75, then
// emits the single $29 byte through loc_dfb1. The idiomatic side dissolves the two jsr into direct
// loc_df75(m, y, x) and loc_dfb1(m, $29, 1) calls. Live-out is memory only (A/X/Y at RTS are whatever the
// tail callee leaves, incidental), so each arm compares RAM (dumpState minus STACK_SCRATCH); registers are
// NOT asserted. Run: node --test games/tempest/idiomatic/test/equivalence-d8a9.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_d8a9 as oracle } from "../../translated/loc_d8a9.js";
import { loc_d8a9 } from "../loc_d8a9.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { loc_df75 } from "../loc_df75.js";
import { loc_dfb1 } from "../loc_dfb1.js";
import { STACK_SCRATCH, loc_29, loc_74 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xd8a9;
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

test("CAPTURE: real 0xd8a9 dispatches -- loc_d8a9 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_d8a9(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Distinct A/Y/X plus a fresh ($74) cursor into vector RAM: the scaled pair and the emitted record land in
// diffed RAM, making the marshalling (df75 gets Y then X, dfb1 gets $29) a real memory check.
function seedDistinct(m) {
  m.regs.a = 0x11; m.regs.y = 0x22; m.regs.x = 0x33;
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_74 + 1, 0x21); // ($74) -> 0x2100 (vector RAM, diffed)
}

test("CRAFTED: distinct A/Y/X -- loc_d8a9 == oracle in RAM", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  oracle(o); loc_d8a9(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after stash + scale + emit");
  assert.equal(c.mem.read8(loc_29), 0x11, "A stashed at $29");
});

test("TEETH: a twin that skips the stash + emit diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  oracle(o);
  const brokenD8a9 = (_m) => { /* BUG: never stashes A, never scales, never emits */ };
  brokenD8a9(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped work");
});

test("TEETH (marshalling): a twin that scales A (not Y) diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o); oracle(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  const swappedTwin = (m, a = m.regs.a, y = m.regs.y, x = m.regs.x) => {
    const mem8 = m.mem8;
    mem8[loc_29] = a;
    loc_df75(m, a, x); // BUG: scales A instead of Y
    loc_dfb1(m, loc_29, 0x01);
  };
  swappedTwin(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong scaled coordinate");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_d8a9, TARGET, m);
  assert.equal(r.placeable, true, `loc_d8a9 must be seam-placeable; got: ${r.error}`);
});
