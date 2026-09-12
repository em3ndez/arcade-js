// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c765 (ROM 0xc765-0xc771) -- an alt entry that lays a fixed {0x00,0x71}
// header at the cursor start (slots 0,1) then falls (bne, y=2 always taken) into loc_c774's body to
// finish the vector. The idiomatic form dissolves that fall-through into a direct loc_c774(m, x, 2) call.
// Effect is memory only (vector RAM via ($74) plus the $6a-$6d cache and cursor), so each side runs on a
// clone and the contract is RAM (dumpState, minus STACK_SCRATCH). X (zeropage-pair index) is a register
// input, seated on both sides.
// Run: node --test games/tempest/idiomatic/test/equivalence-c765.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c765 as oracle } from "../../translated/loc_c765.js";
import { loc_c765 } from "../loc_c765.js";
import { loc_c774 } from "../loc_c772.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_1, loc_2, loc_3, loc_00, loc_6a, loc_6b, loc_6c, loc_6d, loc_74, loc_75 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc765;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 2000) : [];

test("CAPTURE: real 0xc765 dispatches -- loc_c765 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c765(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Point the ($74) cursor at vector RAM (0x2000, RW + diffed) and seat the zeropage coordinate pairs at X.
function seed(m, x) {
  m.mem.write8(loc_74, 0x00);
  m.mem.write8(loc_75, 0x20);
  m.mem.write8((loc_00 + x) & 0xff, 0x11); // Y lo
  m.mem.write8((loc_1 + x) & 0xff, 0xe4);  // Y hi (bits above 0x1f set)
  m.mem.write8((loc_2 + x) & 0xff, 0x22);  // X lo
  m.mem.write8((loc_3 + x) & 0xff, 0xd7);  // X hi (bits above 0x1f set)
  m.regs.x = x;
  m.regs.y = 0x00;
}

test("CRAFTED: c765 lays {0x00,0x71} header then the c774 header + two 5-bit-clamped coordinate words", () => {
  const x = 0x10;
  const o = new Machine(ROM, OPTS); seed(o, x);
  const c = new Machine(ROM, OPTS); seed(c, x);
  oracle(o); loc_c765(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after c765");
  assert.equal(c.mem.read8(0x2000), 0x00, "alt header lo");
  assert.equal(c.mem.read8(0x2001), 0x71, "alt header hi");
  assert.equal(c.mem.read8(0x2002), 0x40, "c774 header lo");
  assert.equal(c.mem.read8(0x2003), 0x80, "c774 header hi");
  assert.equal(c.mem.read8(0x2004), 0x22, "X lo raw");
  assert.equal(c.mem.read8(0x2005), 0xd7 & 0x1f, "X hi clamped");
  assert.equal(c.mem.read8(0x2006), 0x11, "Y lo raw");
  assert.equal(c.mem.read8(0x2007), 0xe4 & 0x1f, "Y hi clamped");
  assert.equal(c.mem.read8(loc_6c), 0x22, "$6c cache");
  assert.equal(c.mem.read8(loc_6d), 0xd7, "$6d cache raw");
  assert.equal(c.mem.read8(loc_6a), 0x11, "$6a cache");
  assert.equal(c.mem.read8(loc_6b), 0xe4, "$6b cache raw");
});

test("TEETH: a twin that writes the wrong alt-header byte (0x70) diverges from the oracle", () => {
  const x = 0x10;
  const o = new Machine(ROM, OPTS); seed(o, x);
  const c = new Machine(ROM, OPTS); seed(c, x);
  oracle(o);
  const broken = (m) => {
    const base = m.mem.read8(loc_74) | (m.mem.read8(loc_75) << 8);
    m.mem.write8((base + 0) & 0xffff, 0x00);
    m.mem.write8((base + 1) & 0xffff, 0x70); // BUG: should be 0x71
    loc_c774(m, m.regs.x, 2);
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong alt-header byte");
});
