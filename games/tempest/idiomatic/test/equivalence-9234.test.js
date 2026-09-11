// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_9234 (ROM 0x9234) -- seeds $3ab from $15b and fills $3ac..$3bb from $15a.
// Live-out is RAM only (A/X are loop scratch no caller reads), so every arm compares RAM (-stack). It is a
// pure leaf (no dispatch), so the seam completes it by omitting its ROM ret. No POKEY reads.
// Run: node --test games/tempest/idiomatic/test/equivalence-9234.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_9234 as oracle } from "../../translated/loc_9234.js";
import { loc_9234 } from "../loc_9234.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_15a, loc_15b, loc_3ab, loc_3ac } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const opt = (name) => {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
};
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x9234;
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

test("CAPTURE: real 0x9234 dispatches -- loc_9234 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_9234(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

function seed(m, s) {
  m.mem8[loc_15a] = s.s15a;
  m.mem8[loc_15b] = s.s15b;
}

test("CRAFTED: header from $15b and 16-byte fill from $15a == oracle (RAM -stack)", () => {
  const cases = [
    { tag: "distinct header/body", s15a: 0x33, s15b: 0xaa },
    { tag: "both zero", s15a: 0x00, s15b: 0x00 },
    { tag: "header 0, body 0xff", s15a: 0xff, s15b: 0x00 },
  ];
  for (const s of cases) {
    const o = new Machine(ROM, OPTS); seed(o, s);
    const c = new Machine(ROM, OPTS); seed(c, s);
    oracle(o); loc_9234(c);
    assert.equal(ramDiff(o, c), null, `RAM: ${s.tag}`);
  }
});

test("TEETH: a rewrite that fills the body from $15b (wrong source) diverges from the oracle", () => {
  // Non-default seed so the mutation bites: body source $15a=0x33 differs from header source $15b=0xaa.
  const s = { s15a: 0x33, s15b: 0xaa };
  const o = new Machine(ROM, OPTS); seed(o, s);
  const c = new Machine(ROM, OPTS); seed(c, s);
  oracle(o);
  const brokenFill = (m) => { // BUG: fills the body from $15b instead of $15a
    m.mem8[loc_3ab] = m.mem8[loc_15b];
    const fill = m.mem8[loc_15b];
    for (let x = 0x0f; x >= 0; x--) m.mem8[(loc_3ac + x) & 0xffff] = fill;
  };
  brokenFill(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch a wrong body source");
});
