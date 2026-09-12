// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_ad6e (ROM 0xad6e-0xadcd) -- a CALLER that dissolves three m.calls into direct
// idiomatic calls: loc_adce (fold/clamp the active slot value, consuming its returned A), loc_ddf7 (arm the
// merge with mask 3), and loc_ad22 (walk the request word). Effect is memory only, so each side runs on a
// clone and the contract is RAM (dumpState, minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-ad6e.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_ad6e as oracle } from "../../translated/loc_ad6e.js";
import { loc_ad6e } from "../loc_ad6e.js";
import { loc_adce } from "../loc_adce.js";
import { loc_ddf7 } from "../loc_ddf7.js";
import { loc_ad22 } from "../loc_ad22.js";
import { Machine } from "../../machine.js";
import { u8, u16 } from "../../../../core/int.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  STACK_SCRATCH, loc_00, loc_1, loc_3, loc_3d, loc_4e, loc_50, loc_51,
  loc_600, loc_602, loc_603, loc_604, loc_605, loc_606,
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

const TARGET = 0xad6e;
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

test("CAPTURE: real 0xad6e dispatches -- loc_ad6e == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_ad6e(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Main path: countdown byte non-idle, slot clamps low, gate open, step goes negative -> ddf7 + ad22.
function seedMain(m) {
  m.mem.write8(loc_3, 0x01);   // $03 bits0-4 nonzero -> skip the countdown expiry
  m.mem.write8(loc_602, 0x02); // active slot index
  m.mem.write8((loc_606 + 0x02) & 0xffff, 0x10); // slot value: positive, < 0x1b -> kept
  m.mem.write8(loc_50, 0x00);  // adce step = 0 (no fold change)
  m.mem.write8(loc_51, 0x00);
  m.mem.write8(loc_4e, 0x18);  // gate bits set (& 0x67 -> 0)
  m.mem.write8(loc_604, 0x00); // step-- -> 0xff (negative) -> re-arm branch
  m.mem.write8(loc_3d, 0x00);
  m.mem.write8((loc_600 + 0x00) & 0xffff, 0x02); // < 0x04 -> ddf7 fires
  m.mem.write8(loc_603, 0x00); // ad22 exits idle immediately
}

test("CRAFTED (main path): gate open + negative step re-arms via ddf7/ad22", () => {
  const o = new Machine(ROM, OPTS); seedMain(o);
  const c = new Machine(ROM, OPTS); seedMain(c);
  oracle(o); loc_ad6e(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after ad6e main path");
  assert.equal(c.mem.read8(loc_4e), 0x18 & 0x67, "$4e masked to 0x67");
  assert.equal(c.mem.read8((loc_606 + 0x02) & 0xffff), 0x10, "slot value kept");
});

// Reset path: countdown idle and $0605 decrements to zero -> $0000 = 0x14 and early return.
function seedReset(m) {
  m.mem.write8(loc_3, 0x00);   // $03 bits0-4 clear
  m.mem.write8(loc_605, 0x01); // dec -> 0 -> expire
}

test("CRAFTED (reset path): idle countdown expires to the 0x14 reset", () => {
  const o = new Machine(ROM, OPTS); seedReset(o);
  const c = new Machine(ROM, OPTS); seedReset(c);
  oracle(o); loc_ad6e(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after ad6e reset path");
  assert.equal(c.mem.read8(loc_00), 0x14, "$0000 armed to 0x14");
  assert.equal(c.mem.read8(loc_605), 0x00, "$0605 expired to 0");
});

test("TEETH: a twin that skips the $4e mask (& 0x67) diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedMain(o);
  const c = new Machine(ROM, OPTS); seedMain(c);
  oracle(o);
  // Faithful copy of loc_ad6e with exactly one omission: it never masks $4e with 0x67.
  const broken = (m) => {
    const { mem8 } = m;
    mem8[loc_1] = 0x06;
    if ((mem8[loc_3] & 0x1f) === 0) {
      const count = u8(mem8[loc_605] - 1);
      mem8[loc_605] = count;
      if (count === 0) { mem8[loc_00] = 0x14; return; }
    }
    const slot = mem8[loc_602];
    const clamped = loc_adce(m, mem8[u16(loc_606 + slot)]);
    let value;
    if ((clamped & 0x80) === 0) value = clamped >= 0x1b ? 0x00 : clamped;
    else value = 0x1a;
    mem8[u16(loc_606 + slot)] = value;
    const gate = mem8[loc_4e] & 0x18;
    // BUG: the mask write mem8[loc_4e] = mem8[loc_4e] & 0x67 is omitted here.
    if (gate === 0) return;
    mem8[loc_602] = u8(mem8[loc_602] - 1);
    const step = u8(mem8[loc_604] - 1);
    mem8[loc_604] = step;
    if ((step & 0x80) !== 0) {
      const idx = mem8[loc_3d];
      if (mem8[u16(loc_600 + idx)] < 0x04) loc_ddf7(m);
      loc_ad22(m);
      return;
    }
    mem8[u16(loc_606 + u8(slot - 1))] = 0x00;
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped $4e mask");
});
