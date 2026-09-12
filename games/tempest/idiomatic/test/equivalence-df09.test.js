// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_df09 (ROM 0xdf09-0xdf0c) -- presets the body byte 0xc0 and (0xc0 being
// nonzero, the branch is always taken) enters the shared record tail at loc_df12, storing 0xc0 at the
// cursor origin ($74) and running the record chain. A pure tail-caller: it dissolves the branch into a
// direct loc_df12(m, 0xc0) call. All live-out is RAM (the stored byte + the chain's writes); the oracle
// also leaves A as a df5f-family cursor byte the idiomatic tail does not reproduce, and df09 reads no
// register after, so each arm compares RAM (dumpState minus STACK_SCRATCH) only, not A.
// Run: node --test games/tempest/idiomatic/test/equivalence-df09.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_df09 as oracle } from "../../translated/loc_df09.js";
import { loc_df09 } from "../loc_df09.js";
import { loc_df12 } from "../loc_df0d.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_74, loc_75 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xdf09;
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

// Seat the cursor at a VECTOR RAM origin (0x2000-0x2fff, diffed) so the stored body byte and the record
// tail's writes land in a seedable, comparable region.
function seed(m, s = {}) {
  const ptr = s.ptr ?? 0x2500;
  m.mem.write8(loc_74, ptr & 0xff);
  m.mem.write8(loc_75, (ptr >> 8) & 0xff);
  return ptr;
}

test("CAPTURE: real 0xdf09 dispatches -- loc_df09 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_df09(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: stores 0xc0 at the cursor origin and matches the oracle in RAM", () => {
  const ptr = 0x2500;
  const o = new Machine(ROM, OPTS); seed(o, { ptr });
  const c = new Machine(ROM, OPTS); seed(c, { ptr });
  oracle(o); loc_df09(c);
  assert.equal(ramDiff(o, c), null, "RAM equal");
  assert.equal(c.mem.read8(ptr), 0xc0, "body byte 0xc0 stored at cursor origin");
});

test("CRAFTED (non-default seed): a different cursor origin still matches the oracle", () => {
  const ptr = 0x2680;
  const o = new Machine(ROM, OPTS); seed(o, { ptr });
  const c = new Machine(ROM, OPTS); seed(c, { ptr });
  oracle(o); loc_df09(c);
  assert.equal(ramDiff(o, c), null, "RAM equal (non-default cursor)");
});

test("TEETH: a twin that stores the wrong body byte diverges from the oracle", () => {
  const ptr = 0x2500;
  const o = new Machine(ROM, OPTS); seed(o, { ptr });
  const c = new Machine(ROM, OPTS); seed(c, { ptr });
  oracle(o);
  const broken = (m) => loc_df12(m, 0x00); // BUG: 0x00 body byte instead of 0xc0
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong body byte");
});

test("SP-TOOTH: the omitted-ret tail-caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seed(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_df09, TARGET, m);
  assert.equal(r.placeable, true, `loc_df09 must be seam-placeable; got: ${r.error}`);
});
