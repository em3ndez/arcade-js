// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b586 -- flags a rebuild, gates on a byte, latches it into two slots and kicks a
// spread build. The idiomatic side dissolves jsr bda0 into a direct call. Live-out is memory only, so each
// arm compares RAM (dumpState minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-b586.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b586 as oracle } from "../../translated/loc_b586.js";
import { loc_b586 } from "../loc_b586.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_9e, loc_200, loc_201, loc_202, loc_2f, loc_51, loc_57, loc_5b, loc_5f } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb586;
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

test("CAPTURE: real 0xb586 dispatches -- loc_b586 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b586(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Gate byte in range and marker not the skip value: latches the gate, then reaches the spread build,
// which itself early-exits (guard clear and counter below reference), keeping the RAM effect bounded.
function seedBuild(m) {
  m.mem.write8(loc_202, 0x40); // gate: nonzero and < 0xf0
  m.mem.write8(loc_201, 0x00); // marker: not 0x81
  m.mem.write8(loc_200, 0x03); // index
  m.mem.write8(loc_51, 0x08);  // size source
  m.mem.write8(loc_5b, 0x00);  // guard clear
  m.mem.write8(loc_5f, 0x50);  // reference > gate -> callee early-outs
}

test("CRAFTED: in-range gate -- slots latched and RAM matches the oracle", () => {
  const o = new Machine(ROM, OPTS); seedBuild(o);
  const c = new Machine(ROM, OPTS); seedBuild(c);
  oracle(o); loc_b586(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after build");
  assert.equal(c.mem.read8(loc_57), 0x40, "gate latched into $57");
  assert.equal(c.mem.read8(loc_2f), 0x40, "gate latched into $2f");
});

test("TEETH: a twin that skips latching the gate diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedBuild(o);
  const c = new Machine(ROM, OPTS); seedBuild(c);
  oracle(o);
  const brokenB586 = (m) => { m.mem8[loc_9e] = 0x01; /* BUG: never latches $57/$2f, never builds */ };
  brokenB586(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped latch");
});

test("TEETH-OUTRANGE: gate >= 0xf0 -- oracle and idiomatic both early-out identically", () => {
  const seed = (m) => { m.mem.write8(loc_202, 0xf5); };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_b586(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the out-of-range early-out");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seedBuild(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_b586, TARGET, m);
  assert.equal(r.placeable, true, `loc_b586 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret caller (moved 0) placeable");
});
