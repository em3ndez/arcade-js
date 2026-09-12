// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a65b (ROM 0xa65b-0xa69a) -- spawn an enemy into slot x: the leading test is
// dead (and #$00), so it always seeds the three state bytes ($0263,x $0283,x $02a3,x = 0x80), then fills
// three velocity/coordinate pairs from the RNG -- $02c3,x=$60da, $0323,x=jsr $a69b; $02e3,x=$60ca,
// $0343,x=jsr $a69b forced non-positive; $0303,x=$60ca, $0363,x=jsr $a69b -- and rings the sound cue
// (jsr $ccc1). The idiomatic side dissolves the three jsr $a69b and the jsr $ccc1 into direct calls.
//   POKEY coupling: $60ca/$60da (RANDOM) are clock-coupled -- the ROM's m.step charges cycles the idiomatic
// does not, so the arms only agree when the POKEY poly is frozen (clear SK_RESET -> _advance early-returns
// -> poly index constant). On a fresh machine skctl is already 0 (index 0 -> RANDOM reads 0xff), so the
// crafted arm is deterministic; freezing the captured clones makes the CAPTURE arm deterministic too.
// Live-out is memory only, so each arm compares RAM (dumpState minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-a65b.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a65b as oracle } from "../../translated/loc_a65b.js";
import { loc_a65b } from "../loc_a65b.js";
import { loc_a69b } from "../loc_a69b.js";
import { loc_ccc1 } from "../loc_ccc1.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u8, u16 } from "../../../../core/int.js";
import { STACK_SCRATCH, loc_263, loc_283, loc_2a3, loc_2c3, loc_2e3, loc_303, loc_323, loc_343, loc_363, loc_60ca, loc_60da } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa65b;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

// Freeze the POKEY polys: clearing SK_RESET (0x03) makes _advance early-return, so RANDOM ($60ca/$60da)
// no longer moves with the cycle count -> both arms read the same random bytes.
const freezePokey = (m) => { for (const p of m.io.pokeys) p.skctl &= ~0x03; return m; };

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 4000) : [];

test("CAPTURE: real 0xa65b dispatches -- loc_a65b == oracle in RAM (-stack, poly frozen)", () => {
  for (const cap of CAPS) {
    const o = freezePokey(cap.clone()), c = freezePokey(cap.clone());
    oracle(o); loc_a65b(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

const XREG = 0x02, YREG = 0x05;
function seed(m) {
  freezePokey(m);
  m.regs.x = XREG; m.regs.y = YREG;
  for (const b of [loc_263, loc_283, loc_2a3, loc_2c3, loc_2e3, loc_303, loc_323, loc_343, loc_363]) {
    m.mem.write8(u16(b + XREG), 0x77); // dirty sentinels
  }
}

test("CRAFTED: state bytes -> 0x80 and RAM equal after the RNG fill", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_a65b(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after spawn");
  for (const b of [loc_263, loc_283, loc_2a3]) assert.equal(c.mem.read8(u16(b + XREG)), 0x80, "state byte active");
});

test("TEETH: a twin that skips the 0x80 state-byte seeding diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o); oracle(o);
  const c = new Machine(ROM, OPTS); seed(c);
  const brokenA65b = (m, x = m.regs.x, y = m.regs.y) => {
    const { mem8 } = m;
    // BUG: never marks the three state bytes active
    const r0 = mem8[loc_60da]; mem8[u16(loc_2c3 + x)] = r0; mem8[u16(loc_323 + x)] = loc_a69b(m, r0);
    const r1 = mem8[loc_60ca]; mem8[u16(loc_2e3 + x)] = r1;
    let step = loc_a69b(m, r1); if ((step & 0x80) === 0) step = u8(-step); mem8[u16(loc_343 + x)] = step;
    const r2 = mem8[loc_60ca]; mem8[u16(loc_303 + x)] = r2; mem8[u16(loc_363 + x)] = loc_a69b(m, r2);
    loc_ccc1(m, x, y);
  };
  brokenA65b(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped state-byte seeding");
});

test("TEETH (marshalling): a twin that always negates the middle step diverges when it is already negative", () => {
  const o = new Machine(ROM, OPTS); seed(o); oracle(o);
  const correctMid = o.mem.read8(u16(loc_343 + XREG));
  // Frozen RANDOM (0xff) drives $60ca bit0=1 -> the middle step comes back already negative and must be kept.
  assert.equal((correctMid & 0x80) !== 0, true, "precondition: the correct middle step is negative (kept, not negated)");
  const c = new Machine(ROM, OPTS); seed(c);
  const alwaysNegate = (m, x = m.regs.x, y = m.regs.y) => {
    const { mem8 } = m;
    mem8[u16(loc_263 + x)] = 0x80; mem8[u16(loc_283 + x)] = 0x80; mem8[u16(loc_2a3 + x)] = 0x80;
    const r0 = mem8[loc_60da]; mem8[u16(loc_2c3 + x)] = r0; mem8[u16(loc_323 + x)] = loc_a69b(m, r0);
    const r1 = mem8[loc_60ca]; mem8[u16(loc_2e3 + x)] = r1;
    mem8[u16(loc_343 + x)] = u8(-loc_a69b(m, r1)); // BUG: unconditional negate
    const r2 = mem8[loc_60ca]; mem8[u16(loc_303 + x)] = r2; mem8[u16(loc_363 + x)] = loc_a69b(m, r2);
    loc_ccc1(m, x, y);
  };
  alwaysNegate(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong middle-step sign");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_a65b, TARGET, m);
  assert.equal(r.placeable, true, `loc_a65b must be seam-placeable; got: ${r.error}`);
});
