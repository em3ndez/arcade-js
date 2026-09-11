// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_994d -- scans the active-slot table for a free entry, seeds its parallel arrays,
// bumps the active count and a per-lane counter, and returns 0x10 (or 0 when none free). Live-out is memory
// plus A (0x10/0 the caller reads back); each side runs on a clone and the RAM contract is dumpState minus
// STACK_SCRATCH. A leaf: the module omits the ROM ret and the seam completes it, so arms compare RAM (-stack).
// The CRAFTED seeds keep $2a != 0x0f so the POKEY-random branch is never taken (deterministic).
// Run: node --test games/tempest/idiomatic/test/equivalence-994d.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_994d as oracle } from "../../translated/loc_994d.js";
import { loc_994d } from "../loc_994d.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import {
  STACK_SCRATCH, loc_36, loc_11c, loc_2df, loc_29, loc_2a, loc_2b, loc_2c, loc_2d,
  loc_2b9, loc_2cc, loc_2a6, loc_28a, loc_291, loc_108, loc_283, loc_142,
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

const TARGET = 0x994d;
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

// A free slot at index 1 (indices 3,2 occupied; 1 free). $2a=0x05 avoids the POKEY-random branch.
function seedFree(m) {
  m.regs.y = 5; m.regs.x = 7;
  m.mem.write8(loc_11c, 0x03);
  m.mem.write8((loc_2df + 3) & 0xffff, 0x81);
  m.mem.write8((loc_2df + 2) & 0xffff, 0x82);
  m.mem.write8((loc_2df + 1) & 0xffff, 0x00);
  m.mem.write8(loc_29, 0xaa);
  m.mem.write8(loc_2a, 0x05);
  m.mem.write8(loc_2b, 0x0b);
  m.mem.write8(loc_2c, 0xcc);
  m.mem.write8(loc_2d, 0xdd);
  m.mem.write8(loc_108, 0x20);
  m.mem.write8((loc_2a6 + 1) & 0xffff, 0x55); // sentinel the zero-store must clear
  m.mem.write8((loc_142 + 3) & 0xffff, 0x40); // lane = 0x0b & 7 = 3
}

// No free slot: indices 2..0 all occupied, count=2.
function seedFull(m) {
  m.regs.y = 9; m.regs.x = 4;
  m.mem.write8(loc_11c, 0x02);
  for (let i = 0; i <= 2; i++) m.mem.write8((loc_2df + i) & 0xffff, 0x90 + i);
  m.mem.write8(loc_108, 0x20);
}

test("CAPTURE: real 0x994d dispatches -- loc_994d == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_994d(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED (free slot): loc_994d == oracle in RAM; slot 1 arrays seeded, count + lane bumped", () => {
  const o = new Machine(ROM, OPTS); seedFree(o);
  const c = new Machine(ROM, OPTS); seedFree(c);
  oracle(o); const rc = loc_994d(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after seed");
  assert.equal(c.regs.a, o.regs.a, "A live-out equal (oracle sets regs.a; module returns it)");
  assert.equal(rc, 0x10, "found -> A=0x10");
  assert.equal(c.mem.read8((loc_2df + 1) & 0xffff), 0xaa, "$02df[1] = $29");
  assert.equal(c.mem.read8((loc_2b9 + 1) & 0xffff), 0x05, "$02b9[1] = $2a");
  assert.equal(c.mem.read8((loc_2cc + 1) & 0xffff), 0x06, "$02cc[1] = ($2a+1)&0x0f");
  assert.equal(c.mem.read8((loc_2a6 + 1) & 0xffff), 0x00, "$02a6[1] cleared");
  assert.equal(c.mem.read8((loc_28a + 1) & 0xffff), 0xcc, "$028a[1] = $2c");
  assert.equal(c.mem.read8((loc_291 + 1) & 0xffff), 0xdd, "$0291[1] = $2d");
  assert.equal(c.mem.read8((loc_283 + 1) & 0xffff), 0x0b, "$0283[1] = $2b");
  assert.equal(c.mem.read8(loc_108), 0x21, "count incremented");
  assert.equal(c.mem.read8((loc_142 + 3) & 0xffff), 0x41, "lane counter incremented");
  assert.equal(c.mem.read8(loc_36), 0x07, "$36 = X on success");
});

test("CRAFTED (no free slot): loc_994d == oracle in RAM; returns A=0, count untouched", () => {
  const o = new Machine(ROM, OPTS); seedFull(o);
  const c = new Machine(ROM, OPTS); seedFull(c);
  oracle(o); const rc = loc_994d(c);
  assert.equal(ramDiff(o, c), null, "RAM equal");
  assert.equal(c.regs.a, o.regs.a, "A live-out equal (oracle sets regs.a; module returns it)");
  assert.equal(rc, 0x00, "none free -> A=0");
  assert.equal(c.mem.read8(loc_108), 0x20, "count untouched");
  assert.equal(c.mem.read8(loc_36), 0x09, "$36 = Y on failure");
});

test("TEETH: a twin that skips the active-count increment diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedFree(o);
  const c = new Machine(ROM, OPTS); seedFree(c);
  oracle(o);
  const broken = (m) => {
    const mem = m.mem8;
    let y = m.regs.y;
    mem[loc_36] = y;
    y = mem[loc_11c];
    while (mem[(loc_2df + y) & 0xffff] !== 0) { y = (y - 1) & 0xff; if (y & 0x80) return; }
    mem[(loc_2df + y) & 0xffff] = mem[loc_29];
    const a = mem[loc_2a];
    mem[(loc_2b9 + y) & 0xffff] = a;
    mem[(loc_2cc + y) & 0xffff] = (a + 1) & 0x0f;
    mem[(loc_2a6 + y) & 0xffff] = 0x00;
    mem[(loc_28a + y) & 0xffff] = mem[loc_2c];
    mem[(loc_291 + y) & 0xffff] = mem[loc_2d];
    // BUG: never increments the active count at $0108
    mem[(loc_283 + y) & 0xffff] = mem[loc_2b];
    const lane = mem[loc_2b] & 0x07;
    mem[loc_36] = m.regs.x;
    mem[(loc_142 + lane) & 0xffff] = mem[(loc_142 + lane) & 0xffff] + 1;
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped count increment");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seedFree(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_994d, TARGET, m);
  assert.equal(r.placeable, true, `loc_994d must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
