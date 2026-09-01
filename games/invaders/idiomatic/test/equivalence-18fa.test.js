// SPDX-License-Identifier: GPL-3.0-only
// Memory+register+port equivalence for loc_18fa -- (loc_2094) |= B, mirror the result to the sound
// port, A := result. Input register B; live-out is RAM (loc_2094), the sound-port latch, and A. Each
// side runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH) plus the port + A.
// Run: node --test games/invaders/idiomatic/test/equivalence-18fa.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_18fa as oracle } from "../../translated/loc_18fa.js";
import { loc_18fa } from "../loc_18fa.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_2094 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x18fa;
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

test("CAPTURE: real 0x18fa dispatches -- RAM (-stack), sound-port latch, and A", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_18fa(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.io.soundData[0], o.io.soundData[0], "sound-port latch");
    assert.equal(c.regs.a, o.regs.a, "live-out A");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: (loc_2094) |= B, mirrored to the sound port, A := result", () => {
  for (const [latch, b] of [[0x00, 0x00], [0x30, 0x0c], [0xff, 0x00], [0x00, 0xff], [0xa5, 0x5a]]) {
    const o = new Machine(ROM); o.regs.b = b; o.mem.write8(loc_2094, latch);
    const c = new Machine(ROM); c.regs.b = b; c.mem.write8(loc_2094, latch);
    oracle(o);
    const ret = loc_18fa(c);
    const label = `latch=0x${latch.toString(16)} b=0x${b.toString(16)}`;
    assert.equal(ramDiff(o, c), null, label);
    const want = latch | b;
    assert.equal(c.mem.read8(loc_2094), want, `stored latch ${label}`);
    assert.equal(c.io.soundData[0], want, `sound-port latch ${label}`);
    assert.equal(c.regs.a, want, `A result ${label}`);
    assert.equal(ret, want, `module return ${label}`);
  }
});

test("TEETH: a wrong stored latch is caught (RAM diff)", () => {
  const o = new Machine(ROM); o.regs.b = 0x0c; o.mem.write8(loc_2094, 0x30);
  const c = new Machine(ROM); c.regs.b = 0x0c; c.mem.write8(loc_2094, 0x30);
  oracle(o);
  loc_18fa(c); c.mem.write8(loc_2094, 0x00); // BUG: wrong stored latch
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch a wrong stored latch");
  assert.equal(d.addr, loc_2094 & 0xffff);
});

test("TEETH: a dropped OUT (sound-port latch) is caught", () => {
  const o = new Machine(ROM); o.regs.b = 0x0c; o.mem.write8(loc_2094, 0x30);
  const c = new Machine(ROM); c.regs.b = 0x0c; c.mem.write8(loc_2094, 0x30);
  oracle(o);
  loc_18fa(c); c.io.soundData[0] = 0x00; // BUG: dropped the port mirror
  assert.notEqual(o.io.soundData[0], c.io.soundData[0], "the OUT check FAILED to catch a dropped port write");
});
