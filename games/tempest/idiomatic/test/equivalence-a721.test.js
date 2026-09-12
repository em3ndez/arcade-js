// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a721 (ROM 0xa721-0xa75c) -- steps a slot's three axis velocities through
// loc_a75d and, when all saturate, zeros the slot's whole coordinate. The idiomatic side dissolves the
// three jsr $a75d into direct loc_a75d(...) calls. Live-out is memory only (RAM incl. $29/$2a/$2b and
// the per-axis cells), so each arm compares RAM (dumpState minus STACK_SCRATCH); X is unchanged so it is
// not asserted. Run: node --test games/tempest/idiomatic/test/equivalence-a721.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a721 as oracle } from "../../translated/loc_a721.js";
import { loc_a721 } from "../loc_a721.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { loc_a75d } from "../loc_a75d.js";
import { STACK_SCRATCH, loc_29, loc_2c3, loc_2e3, loc_303, loc_323, loc_343, loc_363, loc_283 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa721;
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

test("CAPTURE: real 0xa721 dispatches -- loc_a721 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_a721(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Slot 0: three velocities small enough that one fixed step (a788=0x20) crosses zero on every
// axis -> all three saturate ($29: 0xfd + 3 wraps to 0x00) -> the slot coord is zeroed.
function seedSaturating(m) {
  m.regs.x = 0;
  for (const b of [loc_2c3, loc_2e3, loc_303]) m.mem.write8(b, 0x00); // low bytes
  for (const b of [loc_323, loc_343, loc_363]) m.mem.write8(b, 0x00); // whole bytes (0x0000 -> step crosses zero)
  m.mem.write8(loc_283, 0x77); // dirty coord sentinel
}

test("CRAFTED: three saturating axes -- RAM equal and the slot coord clears to 0", () => {
  const o = new Machine(ROM, OPTS); seedSaturating(o);
  const c = new Machine(ROM, OPTS); seedSaturating(c);
  oracle(o); loc_a721(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after step");
  assert.equal(c.mem.read8(loc_283), 0x00, "coord cleared on full saturation");
});

test("TEETH: a twin that skips the axis steps diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedSaturating(o);
  const c = new Machine(ROM, OPTS); seedSaturating(c);
  oracle(o);
  const brokenA721 = (_m) => { /* BUG: never steps any axis, never zeros the coord */ };
  brokenA721(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped steps");
});

// Distinct per-axis low != whole (non-saturating): makes the module-vs-oracle RAM compare a real
// marshalling check -- a swapped (low,whole) arg to loc_a75d would diverge from the oracle here.
function seedDistinct(m) {
  m.regs.x = 0;
  m.mem.write8(loc_2c3, 0x03); m.mem.write8(loc_323, 0x41); // axis 0: low != whole, whole large -> no saturate
  m.mem.write8(loc_2e3, 0x05); m.mem.write8(loc_343, 0x42); // axis 1
  m.mem.write8(loc_303, 0x07); m.mem.write8(loc_363, 0x43); // axis 2
  m.mem.write8(loc_283, 0x77);
}

test("CRAFTED (marshalling): distinct low!=whole per axis -- loc_a721 == oracle in RAM", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  oracle(o); loc_a721(c);
  assert.equal(ramDiff(o, c), null, "RAM equal -- correct (low,whole) arg order to loc_a75d");
});

test("TEETH (marshalling): a twin that swaps axis-0 (low,whole) args diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o); oracle(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  const swappedTwin = (m, x = m.regs.x) => {
    const mem8 = m.mem8;
    mem8[loc_29] = 0xfd;
    // BUG: axis-0 args swapped (whole, low) instead of (low, whole)
    { const [low, whole] = loc_a75d(m, mem8[u16(loc_323 + x)], mem8[u16(loc_2c3 + x)]);
      mem8[u16(loc_2c3 + x)] = low; mem8[u16(loc_323 + x)] = whole; }
    { const [low, whole] = loc_a75d(m, mem8[u16(loc_2e3 + x)], mem8[u16(loc_343 + x)]);
      mem8[u16(loc_2e3 + x)] = low; mem8[u16(loc_343 + x)] = whole; }
    { const [low, whole] = loc_a75d(m, mem8[u16(loc_303 + x)], mem8[u16(loc_363 + x)]);
      mem8[u16(loc_303 + x)] = low; mem8[u16(loc_363 + x)] = whole; }
    if (mem8[loc_29] !== 0) return;
    mem8[u16(loc_283 + x)] = 0x00;
  };
  swappedTwin(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the swapped (low,whole) marshalling");
});

test("LIVE-OUT: returned Y equals the oracle's exit Y on BOTH RTS paths", () => {
  // Non-saturating (distinct): exits via the bne-skip RTS at 0xa75c. Exit Y = axis-2 stepped whole.
  {
    const o = new Machine(ROM, OPTS); seedDistinct(o); oracle(o);
    const c = new Machine(ROM, OPTS); seedDistinct(c); const ry = loc_a721(c);
    assert.equal(ramDiff(o, c), null, "RAM still equal (non-saturating)");
    assert.equal(ry, o.regs.y, "returned Y must equal oracle exit Y (bne-skip path)");
  }
  // Saturating: exits via the fall-through RTS after `sta $0283,x`. All axes saturate -> exit Y = 0.
  {
    const o = new Machine(ROM, OPTS); seedSaturating(o); oracle(o);
    const c = new Machine(ROM, OPTS); seedSaturating(c); const ry = loc_a721(c);
    assert.equal(ramDiff(o, c), null, "RAM still equal (saturating)");
    assert.equal(ry, o.regs.y, "returned Y must equal oracle exit Y (fall-through path)");
  }
});

test("TEETH (live-out): a twin returning the wrong axis's whole diverges from oracle exit Y", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o); oracle(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  const wrongTwin = (m, x = m.regs.x) => {
    const { mem8 } = m;
    mem8[loc_29] = 0xfd;
    let whole0;
    { const [low, whole] = loc_a75d(m, mem8[u16(loc_2c3 + x)], mem8[u16(loc_323 + x)]);
      mem8[u16(loc_2c3 + x)] = low; mem8[u16(loc_323 + x)] = whole; whole0 = whole; }
    { const [low, whole] = loc_a75d(m, mem8[u16(loc_2e3 + x)], mem8[u16(loc_343 + x)]);
      mem8[u16(loc_2e3 + x)] = low; mem8[u16(loc_343 + x)] = whole; }
    { const [low, whole] = loc_a75d(m, mem8[u16(loc_303 + x)], mem8[u16(loc_363 + x)]);
      mem8[u16(loc_303 + x)] = low; mem8[u16(loc_363 + x)] = whole; }
    // BUG: returns axis-0 whole (0x40) instead of the axis-2 exit whole (0x42).
    if (mem8[loc_29] !== 0) return whole0;
    mem8[u16(loc_283 + x)] = 0x00;
    return whole0;
  };
  const ry = wrongTwin(c);
  assert.notEqual(ry, o.regs.y, "the live-out check FAILED to catch a wrong-axis return");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_a721, TARGET, m);
  assert.equal(r.placeable, true, `loc_a721 must be seam-placeable; got: ${r.error}`);
});
