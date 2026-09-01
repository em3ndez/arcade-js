// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_01c0 (ROM 0x01c0) -- seat the alien-status table base loc_2100, then
// delegate to markAllAliensAlive (0x01c3 dissolved) to write 0x01 across 0x37 bytes. Live-out is
// memory only (every caller reloads HL/A before a read), so each side runs on a clone and the contract
// is RAM (dumpState, minus STACK_SCRATCH).
// Run: node --test games/invaders/idiomatic/test/equivalence-01c0.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_01c0 as oracle } from "../../translated/loc_01c0.js";
import { loc_01c0 } from "../loc_01c0.js";
import { markAllAliensAlive } from "../markAllAliensAlive.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_2100 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x01c0;
const FILL_LEN = 0x37;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  new Machine(ROM, { overrides: snap }).runFrames(maxFrames);
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 1500) : [];

test("CAPTURE: real 0x01c0 dispatches -- loc_01c0 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_01c0(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: 0x37 bytes of 0x01 from loc_2100, whatever the incoming HL", () => {
  for (const hl of [0x0000, 0x2400, 0x1111]) { // incoming HL is ignored -- the base is seated internally
    const o = new Machine(ROM); o.regs.sp = 0x2400; o.regs.hl = hl;
    const c = new Machine(ROM); c.regs.sp = 0x2400; c.regs.hl = hl;
    oracle(o); loc_01c0(c);
    assert.equal(ramDiff(o, c), null, `HL=0x${hl.toString(16)}`);
    for (let i = 0; i < FILL_LEN; i++) {
      assert.equal(c.mem.read8((loc_2100 + i) & 0xffff), 0x01, `byte ${i}`);
    }
    assert.equal(c.mem.read8((loc_2100 + FILL_LEN) & 0xffff),
      o.mem.read8((loc_2100 + FILL_LEN) & 0xffff), "the byte past the fill is untouched");
  }
});

test("TEETH: a module seating the wrong base is caught by the RAM diff", () => {
  // Broken twin: the real delegation with the base seated one byte high.
  const brokenLoc01c0 = (m) => markAllAliensAlive(m, (loc_2100 + 1) & 0xffff); // BUG: off-by-one base
  const o = new Machine(ROM); o.regs.sp = 0x2400;
  const c = new Machine(ROM); c.regs.sp = 0x2400;
  oracle(o); brokenLoc01c0(c);
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch the shifted fill base");
  assert.equal(d.addr, loc_2100 & 0xffff); // oracle wrote 0x01 here; the broken twin left it 0x00
});
