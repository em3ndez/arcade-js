// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_dd27 -- a caller that seats a fixed value byte, then dissolves its jmp into
// the already-idiomatic loc_dd29 (direct call). The routine and its callee chain shape vector work cells;
// live-out is memory only (registers at exit are incidental), so each side runs on a clone and the contract
// is RAM (dumpState, minus STACK_SCRATCH). Y flows in via the register bridge.
// Run: node --test games/tempest/idiomatic/test/equivalence-dd27.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_dd27 as oracle } from "../../translated/loc_dd27.js";
import { loc_dd27 } from "../loc_dd27.js";
import { loc_dd29 } from "../loc_dd29.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xdd27;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 3000) : [];

test("CAPTURE: real 0xdd27 dispatches -- loc_dd27 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_dd27(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

const seedVectorRam = (m) => { for (let a = 0x2000; a < 0x2100; a++) m.mem.write8(a, (a * 7) & 0xff); };

test("CRAFTED: seeded dispatch is RAM-equivalent through the dissolved callee", () => {
  const seed = (m) => { seedVectorRam(m); m.regs.y = 0x14; };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_dd27(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after dissolved call");
});

test("TEETH: a twin that seats the wrong value byte diverges from the oracle", () => {
  const seed = (m) => { seedVectorRam(m); m.regs.y = 0x14; };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  // BUG: seats 0x00 instead of the fixed 0xd0 before the dissolved call.
  loc_dd29(c, c.regs.y, 0x00);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong value byte");
});
