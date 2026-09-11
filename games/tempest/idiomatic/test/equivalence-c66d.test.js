// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c66d (ROM 0xc66d-0xc6c6) -- averages a slot's two 16-bit coordinate pairs with
// its wrap-around neighbour (round-up, sign-preserving halve) into $61/$62 and $63/$64, appends four bytes to
// the ($74) display list (high bytes masked 0x1f), mirrors them to $6a-$6d, advances the $a9 cursor. Live-out
// is memory only (A/X/Y at RTS are incidental), so each side runs on a clone and the contract is RAM
// (dumpState, minus STACK_SCRATCH). A leaf: it omits the ROM ret and the seam completes it. No POKEY read.
// Run: node --test games/tempest/idiomatic/test/equivalence-c66d.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c66d as oracle } from "../../translated/loc_c66d.js";
import { loc_c66d } from "../loc_c66d.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import {
  STACK_SCRATCH, loc_38, loc_61, loc_62, loc_63, loc_64, loc_a9,
  loc_74, loc_35a, loc_36a, loc_37a, loc_38a,
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

const TARGET = 0xc66d;
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

// Seed the four coordinate arrays (16 entries each) plus the display-list pointer, cursor and slot. The
// pointer targets 0x0300 so the appended bytes land in free RAM clear of the zero-page cells under test.
const DLIST = 0x0300;
function seed(m, slot) {
  for (let i = 0; i < 16; i++) {
    m.mem.write8((loc_35a + i) & 0xffff, 0x20 + i);       // pair1 high
    m.mem.write8((loc_36a + i) & 0xffff, (i * 7) & 0xff); // pair1 low
    m.mem.write8((loc_37a + i) & 0xffff, 0x30 + i);       // pair2 high
    m.mem.write8((loc_38a + i) & 0xffff, (i * 5) & 0xff); // pair2 low
  }
  m.mem.write8(loc_38, slot);
  m.mem.write8(loc_a9, 0x10);
  m.mem.write16(loc_74, DLIST);
}

test("CAPTURE: real 0xc66d dispatches -- loc_c66d == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c66d(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: midpoints, display-list append, mirrors and cursor all match the oracle in RAM", () => {
  for (const slot of [0x00, 0x03, 0x08, 0x0f]) {
    const o = new Machine(ROM, OPTS); seed(o, slot);
    const c = new Machine(ROM, OPTS); seed(c, slot);
    oracle(o); loc_c66d(c);
    const label = `slot=0x${slot.toString(16)}`;
    assert.equal(ramDiff(o, c), null, `RAM diverged: ${label}`);
    for (const a of [loc_61, loc_62, loc_63, loc_64, loc_a9])
      assert.equal(c.mem.read8(a), o.mem.read8(a), `cell 0x${a.toString(16)} diverged: ${label}`);
    for (let k = 0; k < 4; k++)
      assert.equal(c.mem.read8(DLIST + 0x10 + k), o.mem.read8(DLIST + 0x10 + k), `dlist[${k}] diverged: ${label}`);
  }
});

test("TEETH: a twin that skips the 0x1f high-byte mask diverges from the oracle", () => {
  const slot = 0x03; // non-default seed: pair highs 0x20+/0x30+ have bits above 0x1f, so the mask bites
  const o = new Machine(ROM, OPTS); seed(o, slot);
  const c = new Machine(ROM, OPTS); seed(c, slot);
  oracle(o);
  const broken = (m) => {
    const mem = m.mem8;
    const next = (mem[loc_38] + 1) & 0x0f;
    const p1 = ((mem[(loc_35a + slot) & 0xffff] << 8) | mem[(loc_36a + slot) & 0xffff])
             + ((mem[(loc_35a + next) & 0xffff] << 8) | mem[(loc_36a + next) & 0xffff]) + 1;
    const h1 = ((p1 & 0xffff) >> 1) | (p1 & 0x8000);
    const p2 = ((mem[(loc_37a + slot) & 0xffff] << 8) | mem[(loc_38a + slot) & 0xffff])
             + ((mem[(loc_37a + next) & 0xffff] << 8) | mem[(loc_38a + next) & 0xffff]) + 1;
    const h2 = ((p2 & 0xffff) >> 1) | (p2 & 0x8000);
    const ptr = m.mem.read16(loc_74);
    let cur = mem[loc_a9];
    mem[(ptr + cur) & 0xffff] = h2 & 0xff; cur = (cur + 1) & 0xff;
    mem[(ptr + cur) & 0xffff] = (h2 >> 8) & 0xff; cur = (cur + 1) & 0xff; // BUG: no & 0x1f
    mem[(ptr + cur) & 0xffff] = h1 & 0xff; cur = (cur + 1) & 0xff;
    mem[(ptr + cur) & 0xffff] = (h1 >> 8) & 0xff; cur = (cur + 1) & 0xff; // BUG: no & 0x1f
    mem[loc_a9] = cur;
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the unmasked high bytes");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  seed(m, 0x03);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_c66d, TARGET, m);
  assert.equal(r.placeable, true, `loc_c66d must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
