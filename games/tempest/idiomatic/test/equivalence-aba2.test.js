// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_aba2 (ROM 0xaba2-0xabab) -- refreshes the control state via loc_ac20, then
// branches on ($01c9 & 3): zero -> the loc_ac07 no-op tail, else the loc_abac rebuild/copy path. The
// idiomatic side dissolves all three jsr into direct calls. Live-out is memory only, so each arm compares
// RAM (dumpState minus STACK_SCRATCH). A caller: the module omits the ROM ret and the seam completes it.
// Run: node --test games/tempest/idiomatic/test/equivalence-aba2.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_aba2 as oracle } from "../../translated/loc_aba2.js";
import { loc_aba2 } from "../loc_aba2.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { loc_ac20 } from "../loc_ac20.js";
import { loc_ac07 } from "../loc_ac07.js";
import { STACK_SCRATCH, loc_100, loc_1c9, loc_71e, loc_71f } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xaba2;
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

test("CAPTURE: real 0xaba2 dispatches -- loc_aba2 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_aba2(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Force the loc_abac branch: mismatched cached target bytes make loc_ac20 request a rebuild, which sets
// ($01c9 | 3) so the low two bits are non-zero. Vector RAM dirtied so the copy/fill lands in the diffed region.
function seedRebuild(m) {
  m.mem.write8(loc_71e, 0xff);
  m.mem.write8(loc_71f, 0xff);
  m.mem.write8(loc_1c9, 0x00);
  for (let i = 0; i < 0x40; i++) m.mem.write8((0x2100 + i) & 0xffff, 0x5a);
}

test("CRAFTED: forced rebuild -> loc_abac path -- loc_aba2 == oracle in RAM", () => {
  const o = new Machine(ROM, OPTS); seedRebuild(o);
  const c = new Machine(ROM, OPTS); seedRebuild(c);
  oracle(o); loc_aba2(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the rebuild/copy path");
  // loc_abac consumes (clears) the loc_1c9 request bits; its durable $0100=0x08 write marks that the
  // rebuild branch ran (the no-op loc_ac07 path never writes $0100).
  assert.equal(c.mem.read8(loc_100), 0x08, "loc_abac branch ran (its $0100 write is present)");
});

test("TEETH: a twin that skips the loc_abac path diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedRebuild(o); oracle(o);
  const c = new Machine(ROM, OPTS); seedRebuild(c);
  const broken = (m) => {
    loc_ac20(m);
    // BUG: takes the no-op tail regardless of the request bits
    return loc_ac07();
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped loc_abac path");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_aba2, TARGET, m);
  assert.equal(r.placeable, true, `loc_aba2 must be seam-placeable; got: ${r.error}`);
});
