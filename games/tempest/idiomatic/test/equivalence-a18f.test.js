// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a18f (ROM 0xa18f-0xa1e3) -- loops every slot 0x0b..0: slots 8+ integrate a
// 16-bit velocity into their position pair (and clear past the edge, via jsr $a1e4), slots below 8 step a
// counter and advance it (via jsr $a1fa), clearing at the far limit. The idiomatic side dissolves both
// jsrs into direct calls (consuming loc_a1fa's returned slot index). Live-out is memory only, so each arm
// compares RAM (dumpState minus STACK_SCRATCH). Run: node --test games/tempest/idiomatic/test/equivalence-a18f.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a18f as oracle } from "../../translated/loc_a18f.js";
import { loc_a18f } from "../loc_a18f.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_37, loc_a6, loc_118, loc_120, loc_135, loc_200, loc_202, loc_2d3, loc_2e6, loc_2f2 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa18f;
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

test("CAPTURE: real 0xa18f dispatches -- loc_a18f == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_a18f(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Four active slots exercise every branch. Shared velocity $0120=0x30/$0118=0x01, edge $0202=0x05.
//   slot 0x0a (>=8): $02e6 0xf0 + 0x30 -> 0x20 with carry into $02d3 0x10+0x01+1=0x12 >= edge -> stores 0x12
//                    (carry-sensitive: without the carry it would be 0x11).
//   slot 0x09 (>=8): $02e6 0x10 + 0x30 -> 0x40 no carry; $02d3 0x02+0x01=0x03 < edge -> dec $a6, a1e4, clear.
//   slot 0x03 (<8):  counter 0xf0 + 9 = 0xf9 >= 0xf0 -> dec $0135, clear $02d3.
//   slot 0x02 (<8):  counter 0x40 + 9 = 0x49 < 0xf0 -> kept.
// $0200=0x77 (!= $02ad,x=0) makes a1e4 early-return without the heavy a34b path; a1fa early-returns
// because $03ac,($02ad,x) is 0. Both jsrs still run on both sides -> validates the dissolves + x marshalling.
function seed(m) {
  m.mem.write8(loc_120, 0x30);
  m.mem.write8(loc_118, 0x01);
  m.mem.write8(loc_202, 0x05);
  m.mem.write8(loc_a6, 0x20);
  m.mem.write8(loc_135, 0x08);
  m.mem.write8(loc_200, 0x77);
  m.mem.write8(loc_2d3 + 0x0a, 0x10); m.mem.write8(loc_2e6 + 0x0a, 0xf0);
  m.mem.write8(loc_2d3 + 0x09, 0x02); m.mem.write8(loc_2e6 + 0x09, 0x10);
  m.mem.write8(loc_2d3 + 0x03, 0xf0); m.mem.write8(loc_2f2 + 0x03, 0x00);
  m.mem.write8(loc_2d3 + 0x02, 0x40); m.mem.write8(loc_2f2 + 0x02, 0x00);
}

test("CRAFTED: all four branches (both dissolves) -- RAM equal to the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_a18f(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the full slot sweep");
  assert.equal(c.mem.read8(loc_2d3 + 0x0a), 0x12, "carry propagated into the high byte");
  assert.equal(c.mem.read8(loc_2e6 + 0x0a), 0x20, "low byte wrapped");
  assert.equal(c.mem.read8(loc_2d3 + 0x09), 0x00, "past-edge slot cleared");
  assert.equal(c.mem.read8(loc_2d3 + 0x03), 0x00, "counter slot cleared at the far limit");
  assert.equal(c.mem.read8(loc_2d3 + 0x02), 0x49, "counter slot advanced");
});

test("TEETH: a twin that drops the 16-bit carry diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  // Replays loc_a18f faithfully EXCEPT the high-byte add ignores the low-byte carry.
  const broken = (m) => {
    const { mem8 } = m;
    mem8[loc_37] = 0x0b;
    for (;;) {
      const x = mem8[loc_37];
      if (mem8[(loc_2d3 + x) & 0xffff] !== 0) {
        if (x >= 0x08) {
          const lo = mem8[(loc_2e6 + x) & 0xffff] + mem8[loc_120];
          mem8[(loc_2e6 + x) & 0xffff] = lo;
          const hi = (mem8[(loc_2d3 + x) & 0xffff] + mem8[loc_118]) & 0xff; // BUG: no carry
          if (hi >= mem8[loc_202]) mem8[(loc_2d3 + x) & 0xffff] = hi;
          else { mem8[loc_a6] = mem8[loc_a6] - 1; mem8[(loc_2d3 + x) & 0xffff] = 0x00; }
        } else {
          let counter = mem8[(loc_2d3 + x) & 0xffff] + 0x09;
          if (mem8[(loc_2f2 + x) & 0xffff] !== 0) counter -= 0x04;
          mem8[(loc_2d3 + x) & 0xffff] = counter;
          if (mem8[(loc_2d3 + x) & 0xffff] >= 0xf0) { mem8[loc_135] = mem8[loc_135] - 1; mem8[(loc_2d3 + x) & 0xffff] = 0x00; }
        }
      }
      const next = (mem8[loc_37] - 1) & 0xff;
      mem8[loc_37] = next;
      if (next & 0x80) break;
    }
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the dropped carry");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_a18f, TARGET, m);
  assert.equal(r.placeable, true, `loc_a18f must be seam-placeable; got: ${r.error}`);
});
