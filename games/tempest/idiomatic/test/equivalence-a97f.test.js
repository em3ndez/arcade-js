// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a97f (ROM 0xa97f-0xa9d6) -- builds the 7-entry vector list at $2f60 from
// y-keyed base indices, seeds the $3b/$3c glyph pointer, and tail-transfers into loc_a9d7 (the nibble
// emitter). Dissolves that fall-through into a direct idiomatic call. The oracle m.calls frozen a9d7; the
// idiomatic calls idiomatic a9d7. Output is RAM ($2f60 list, $38, $3b/$3c) plus the a9d7 write cursor left
// in X on the emit path -- so tail cases also assert o.regs.x vs c.regs.x. The early-exit path emits
// nothing (X incidental there). An omitted-ret rewrite.
// Run: node --test games/tempest/idiomatic/test/equivalence-a97f.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a97f as oracle } from "../../translated/loc_a97f.js";
import { loc_a97f } from "../loc_a97f.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import {
  STACK_SCRATCH, loc_2b, loc_3d, loc_5, loc_2f60, loc_48, loc_38, loc_00, loc_3b, loc_3c,
  loc_3284, loc_3286, loc_cdde,
} from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa97f;
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

function seat(m, s = {}) {
  m.regs.a = s.a ?? 0x0c;
  m.regs.y = s.y ?? 1;
  m.regs.x = 0x00;
  m.mem.write8(loc_3d, s.c3d ?? 0x05);
  m.mem.write8(loc_5, s.c5 ?? 0x00);
  m.mem.write8(loc_00, s.c00 ?? 0x00);
  m.mem.write8(loc_3284, s.g0 ?? 0xaa);
  m.mem.write8(loc_3286, s.g1 ?? 0xbb);
  const cnt = s.cnt ?? [0, 3, 3, 3, 3, 3, 3, 3];
  for (let i = 0; i < 8; i++) m.mem.write8((loc_48 + i) & 0xffff, cnt[i]);
  m.mem.write8(loc_38, 0x00);
  m.mem.write8(loc_2b, 0x00);
  m.mem.write8(loc_3b, 0x00);
  m.mem.write8(loc_3c, 0x00);
}

test("CAPTURE: real 0xa97f dispatches -- loc_a97f == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_a97f(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: seeded states across every branch == oracle (RAM + emit cursor)", () => {
  const cases = [
    { tag: "build + emit, off-marker", y: 1, c3d: 5, c00: 0, tail: true },
    { tag: "marker path: head zeroed + count dec", y: 3, c3d: 3, c5: 0x80, c00: 0, tail: true },
    { tag: "early exit: state 4 off-marker", y: 1, c3d: 5, c00: 4, tail: false },
  ];
  for (const s of cases) {
    const o = new Machine(ROM, OPTS); seat(o, s);
    const c = new Machine(ROM, OPTS); seat(c, s);
    oracle(o); loc_a97f(c);
    assert.equal(ramDiff(o, c), null, s.tag);
    if (s.tail) assert.equal(c.regs.x, o.regs.x, `${s.tag}: emit cursor (X) live-out`);
  }
});

test("TEETH: a twin that skips the head-zero + emit tail diverges (RAM + cursor)", () => {
  const s = { a: 0x0c, y: 3, c3d: 3, c5: 0x80, c00: 0 };
  const o = new Machine(ROM, OPTS); seat(o, s);
  const c = new Machine(ROM, OPTS); seat(c, s);
  oracle(o);
  // BUG: never zeroes the head at the marker and skips the loop + $3b pointer + a9d7 emit.
  const broken = (m, y) => {
    const { mem8 } = m;
    mem8[loc_2b] = y;
    const a = 0x0c | 0x70; // head NOT zeroed
    const x = mem8[(loc_cdde + y) & 0xffff];
    mem8[(loc_2f60 + x) & 0xffff] = a;
  };
  broken(c, s.y);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped emit tail");
  assert.notEqual(c.regs.x, o.regs.x, "the emit cursor (X) FAILED to diverge");
});

test("SP-TOOTH: the omitted-ret rewrite is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  seat(m, { y: 1, c3d: 5, c00: 4 }); // early-exit seed keeps the tooth cheap
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_a97f, TARGET, m);
  assert.equal(r.placeable, true, `loc_a97f must be seam-placeable; got: ${r.error}`);
});
