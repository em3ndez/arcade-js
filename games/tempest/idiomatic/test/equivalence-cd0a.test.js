// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_cd0a (ROM 0xcd0a-0xcd94) -- for each of 16 slots (X=0x0f..0) counts down the
// $e0,x / $f0,x timers and, when they expire, steps the slot through the $cbcb/$cccb animation tables
// (single step or a walk), then publishes $d0,x to POKEY reg $60c0/$60c8,x by slot half. Observable RAM is
// the zero-page cells $c0/$d0/$e0/$f0,x (the $60xx writes are POKEY, write-only, absent from dumpState); the
// CRAFTED seed takes the single-step branch (deterministic, no clock coupling). A leaf: the module omits the
// ROM ret and the seam completes it, so the arms compare RAM (-stack), NOT pc/SP.
// Run: node --test games/tempest/idiomatic/test/equivalence-cd0a.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_cd0a as oracle } from "../../translated/loc_cd0a.js";
import { loc_cd0a } from "../loc_cd0a.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u8, u16 } from "../../../../core/int.js";
import {
  STACK_SCRATCH, loc_bf, loc_c0, loc_d0, loc_e0, loc_f0,
  loc_cbcc, loc_cbcd, loc_cccc, loc_cccd,
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

const TARGET = 0xcd0a;
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

// Seed every slot into the single-step branch: alive ($c0,x != 0), fast timer about to hit 0 ($e0,x = 1),
// slow timer still running after decrement ($f0,x = 2). No inner loop, no POKEY-read coupling.
function seedSingleStep(m) {
  m.mem.write8(loc_bf, 0xff); // no slot equals the reserved index
  for (let x = 0; x < 16; x++) {
    m.mem.write8((loc_c0 + x) & 0xff, 0x04 + x);
    m.mem.write8((loc_d0 + x) & 0xff, 0x30 + x);
    m.mem.write8((loc_e0 + x) & 0xff, 0x01);
    m.mem.write8((loc_f0 + x) & 0xff, 0x02);
  }
}

test("CAPTURE: real 0xcd0a dispatches -- loc_cd0a == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_cd0a(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: single-step branch over all 16 slots -- zero-page cells match the oracle", () => {
  const o = new Machine(ROM, OPTS); seedSingleStep(o);
  const c = new Machine(ROM, OPTS); seedSingleStep(c);
  oracle(o); loc_cd0a(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after stepping");
  for (let x = 0; x < 16; x++) {
    assert.equal(c.mem.read8((loc_f0 + x) & 0xff), 0x01, `slot ${x}: $f0,x decremented`);
  }
});

test("TEETH: a twin that skips the $f0,x decrement store diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedSingleStep(o);
  const c = new Machine(ROM, OPTS); seedSingleStep(c);
  oracle(o);
  // Faithful copy of the single-step branch with ONE store dropped.
  const brokenCd0a = (m) => {
    const mem8 = m.mem8;
    for (let x = 0x0f; x >= 0; x--) {
      let a = mem8[u8(loc_c0 + x)];
      if (a === 0) continue;
      if (x === mem8[loc_bf]) continue;
      const eDec = u8(mem8[u8(loc_e0 + x)] - 1);
      mem8[u8(loc_e0 + x)] = eDec;
      if (eDec !== 0) continue;
      const fDec = u8(mem8[u8(loc_f0 + x)] - 1);
      // BUG: never stores the decremented $f0,x
      if (fDec !== 0) {
        const carry = (a & 0x80) !== 0;
        const y = u8(a << 1);
        if (carry) {
          mem8[u8(loc_e0 + x)] = mem8[u16(loc_cccc + y)];
          a = mem8[u16(loc_cccd + y)];
        } else {
          mem8[u8(loc_e0 + x)] = mem8[u16(loc_cbcc + y)];
          a = mem8[u16(loc_cbcd + y)];
        }
        const prevD = mem8[u8(loc_d0 + x)];
        a = u8(a + prevD);
        mem8[u8(loc_d0 + x)] = a;
        if ((x & 1) !== 0) {
          const d = mem8[u8(loc_d0 + x)];
          mem8[u8(loc_d0 + x)] = ((((prevD ^ d) & 0xf0) ^ d)) & 0xff;
        }
      }
    }
  };
  brokenCd0a(c);
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the RAM diff FAILED to catch the skipped $f0,x store");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_cd0a, TARGET, m);
  assert.equal(r.placeable, true, `loc_cd0a must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
