// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a343 / loc_a347 -- two seed entries that stamp the head flag ($013b)
// with a per-entry tag (0x09 / 0x07), then tail-JMP into the shared insert (loc_a34d). Each side
// dissolves the jmp into a direct loc_a34d call, passing the entry X/Y (preserved across the callee).
// Output is RAM, so each arm compares the RAM diff (minus the dead stack) and checks X/Y preserved.
// Run: node --test games/tempest/idiomatic/test/equivalence-a343.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a343 as oracle343, loc_a347 as oracle347 } from "../../translated/loc_a343.js";
import { loc_a343, loc_a347 } from "../loc_a343.js";
import { loc_a34d } from "../loc_a34b.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_5, loc_2c, loc_200, loc_202, loc_13b, loc_13c } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(target, oracleFn, K, maxFrames) {
  const caps = [];
  const snap = new Map([[target, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracleFn(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps */ }
  return caps;
}
const CAPS343 = ROM_PRESENT ? captureDispatches(0xa343, oracle343, 16, 2000) : [];
const CAPS347 = ROM_PRESENT ? captureDispatches(0xa347, oracle347, 16, 2000) : [];

function seed(m) {
  m.regs.x = 0x05; m.regs.y = 0x03;
  m.mem.write8(loc_5, 0x80);
  m.mem.write8(loc_202, 0x77);
  m.mem.write8(loc_200, 0x88);
}

test("CAPTURE: real 0xa343 dispatches -- loc_a343 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS343) {
    const o = cap.clone(), c = cap.clone();
    oracle343(o); loc_a343(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(c.regs.x, o.regs.x, "X preserved");
    assert.equal(c.regs.y, o.regs.y, "Y preserved");
  }
  console.log(`  CAPTURE a343: ${CAPS343.length} dispatch(es) checked`);
});

test("CAPTURE: real 0xa347 dispatches -- loc_a347 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS347) {
    const o = cap.clone(), c = cap.clone();
    oracle347(o); loc_a347(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE a347: ${CAPS347.length} dispatch(es) checked`);
});

test("CRAFTED: a343 stamps $013b=0x09, a347 stamps 0x07 -- RAM equal, X/Y preserved", () => {
  for (const [name, oracleFn, idFn, tag] of [
    ["a343", oracle343, loc_a343, 0x09],
    ["a347", oracle347, loc_a347, 0x07],
  ]) {
    const o = new Machine(ROM, OPTS); seed(o);
    const c = new Machine(ROM, OPTS); seed(c);
    oracleFn(o); idFn(c);
    assert.equal(ramDiff(o, c), null, `${name} RAM equal`);
    assert.equal(c.regs.x, o.regs.x, `${name} X preserved`);
    assert.equal(c.regs.y, o.regs.y, `${name} Y preserved`);
    assert.equal(c.mem.read8(loc_13b), tag, `${name} head flag`);
    assert.equal(c.mem.read8(loc_2c), 0x01, `${name} $2c type-1`);
    assert.equal(c.mem.read8(loc_13c), 0x01, `${name} $013c ready flag`);
  }
});

test("TEETH: a twin that stamps the wrong head-flag tag diverges in RAM", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle343(o);
  const broken = (m, x = m.regs.x, y = m.regs.y) => loc_a34d(m, 0x07, x, y); // BUG: 0x07 not 0x09
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong head-flag tag");
});

test("SP-TOOTH: the omitted-ret tail-callers (moved 0) are seam-placeable", () => {
  for (const [target, idFn] of [[0xa343, loc_a343], [0xa347, loc_a347]]) {
    const m = new Machine(ROM, OPTS);
    m.regs.s = 0xfb;
    m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
    const r = seamPlaceable(withOmittedRet, idFn, target, m);
    assert.equal(r.placeable, true, `${target.toString(16)} must be seam-placeable; got: ${r.error}`);
  }
});
