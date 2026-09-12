// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_9f81 / loc_9f8a (ROM 0x9f81-0x9fc3) -- a per-slot(x) segment-flag step that
// tail-jmps into loc_9e5f. The idiomatic side dissolves jsr $9d67, jsr $9c4f and the jmp $9e5f into direct
// loc_9d67 / loc_9c4f / loc_9e5f calls. All output is RAM plus the tail's A live-out (loc_9e5f's stored
// direction byte), so each arm compares RAM (dumpState minus STACK_SCRATCH) and the returned A vs o.regs.a.
// The loc_9f8a entry reads a POKEY random bit ($60ca): both sides run on identically-seeded Machines (same
// poly state), so the read agrees. Run: node --test games/tempest/idiomatic/test/equivalence-9f81.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_9f81 as oracle, loc_9f8a as oracle8a } from "../../translated/loc_9f81.js";
import { loc_9f81, loc_9f8a } from "../loc_9f81.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { STACK_SCRATCH, loc_283, loc_2b9, loc_111 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x9f81;
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

test("CAPTURE: real 0x9f81 dispatches -- loc_9f81 == oracle in RAM (-stack) and A live-out", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); const a = loc_9f81(c);
    assert.equal(ramDiff(o, c), null);
    assert.equal(a, o.regs.a, "returned A must equal oracle exit A");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// slot 0; a live board ($0111 != 0) so the tail's toggle condition runs.
function seed(m, s) {
  m.regs.x = 0x00;
  m.mem.write8(loc_111, s.board ?? 0x01);
  m.mem.write8(u16(loc_283 + 0), s.flag ?? 0x00);
  m.mem.write8(u16(loc_2b9 + 0), s.depth ?? 0x00);
}

test("CRAFTED (9f81): flip / no-flip / skip -- loc_9f81 == oracle (RAM + A)", () => {
  const cases = [
    { tag: "bit6 clear, depth>=0x0f -> flip", flag: 0x00, depth: 0x0f },
    { tag: "bit6 set, depth==0 -> flip", flag: 0x40, depth: 0x00 },
    { tag: "bit6 clear, depth<0x0f -> no flip", flag: 0x00, depth: 0x03 },
    { tag: "bit6 set, depth!=0 -> no flip", flag: 0x40, depth: 0x05 },
    { tag: "board 0 -> tail skipped", board: 0x00, flag: 0x00, depth: 0x0f },
  ];
  for (const s of cases) {
    const o = new Machine(ROM, OPTS); seed(o, s);
    const c = new Machine(ROM, OPTS); seed(c, s);
    oracle(o); const a = loc_9f81(c);
    assert.equal(ramDiff(o, c), null, s.tag);
    assert.equal(a, o.regs.a, `A live-out: ${s.tag}`);
  }
});

test("CRAFTED (9f8a): random-reseed entry -- loc_9f8a == oracle8a (RAM + A)", () => {
  // Identical seed => identical POKEY poly => the $60ca bit agrees on both sides.
  for (const s of [{ flag: 0x00, depth: 0x0f }, { flag: 0x40, depth: 0x00 }, { flag: 0xbf, depth: 0x03 }]) {
    const o = new Machine(ROM, OPTS); seed(o, s);
    const c = new Machine(ROM, OPTS); seed(c, s);
    oracle8a(o); const a = loc_9f8a(c);
    assert.equal(ramDiff(o, c), null, `9f8a RAM: flag ${s.flag}`);
    assert.equal(a, o.regs.a, `9f8a A live-out: flag ${s.flag}`);
  }
});

test("TEETH: a twin that never flips bit6 diverges from the oracle on the flip case", () => {
  const s = { flag: 0x00, depth: 0x0f }; // oracle flips bit6 here
  const o = new Machine(ROM, OPTS); seed(o, s); oracle(o);
  const c = new Machine(ROM, OPTS); seed(c, s);
  const broken = (m, x = m.regs.x) => {
    const { mem8 } = m;
    // dissolve the two heads as usual...
    // BUG: skip the whole shared-tail toggle+step so bit6 never flips and $9e5f never runs.
    mem8[loc_111]; void x;
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped flip/step");
});

test("SP-TOOTH: the omitted-ret tail-caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_9f81, TARGET, m);
  assert.equal(r.placeable, true, `loc_9f81 must be seam-placeable; got: ${r.error}`);
});
