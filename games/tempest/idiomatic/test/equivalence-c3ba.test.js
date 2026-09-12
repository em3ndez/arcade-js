// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c3ba (ROM 0xc3ba-0xc3ed) -- stores two 16-bit differences (cur-prev) into
// $6e/$6f and $70/$71, emits the record through loc_df92 (X=$6e), then latches cur ($61-$64) into prev
// ($6a-$6d) and sets $73=0xc0. The idiomatic side dissolves the jsr $df92 into a direct call. Live-out is
// memory only, so each arm compares RAM (dumpState minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-c3ba.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c3ba as oracle } from "../../translated/loc_c3ba.js";
import { loc_c3ba } from "../loc_c3ba.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { loc_df92 } from "../loc_df92.js";
import { STACK_SCRATCH, loc_61, loc_62, loc_63, loc_64, loc_6a, loc_6b, loc_6c, loc_6d,
         loc_6e, loc_6f, loc_70, loc_71, loc_73, loc_74 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc3ba;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 6000) : [];

test("CAPTURE: real 0xc3ba dispatches -- loc_c3ba == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c3ba(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Distinct cur/prev so both 16-bit subtracts are non-trivial (second pair borrows). Cursor aimed into
// vector RAM so loc_df92's emit lands in the diffed region. Delta slots dirtied to prove they are rewritten.
function seed(m) {
  m.mem.write8(loc_61, 0x50); m.mem.write8(loc_62, 0x01); // cur pair A
  m.mem.write8(loc_6a, 0x10); m.mem.write8(loc_6b, 0x00); // prev pair A -> delta 0x0140
  m.mem.write8(loc_63, 0x30); m.mem.write8(loc_64, 0x02); // cur pair B
  m.mem.write8(loc_6c, 0x40); m.mem.write8(loc_6d, 0x00); // prev pair B -> delta borrows
  for (const a of [loc_6e, loc_6f, loc_70, loc_71]) m.mem.write8(a, 0x99); // dirty sentinels
  m.mem.write8(loc_73, 0x07); // key byte for the fold
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_74 + 1, 0x21); // ($74) -> 0x2100
}

test("CRAFTED: two 16-bit subtracts + emit + latch -- RAM equal", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c3ba(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after subtract/emit/latch");
  assert.equal(c.mem.read8(loc_6e), 0x40, "delta A low");
  assert.equal(c.mem.read8(loc_6f), 0x01, "delta A high");
  assert.equal(c.mem.read8(loc_6a), 0x50, "prev A low latched from cur");
  assert.equal(c.mem.read8(loc_73), 0xc0, "$73 flagged ready");
});

test("TEETH: a twin that skips the emit + latch diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o); oracle(o);
  const c = new Machine(ROM, OPTS); seed(c);
  const broken = (m) => {
    const { mem8 } = m;
    const d0 = mem8[loc_61] - mem8[loc_6a];
    mem8[loc_6e] = d0;
    mem8[loc_6f] = mem8[loc_62] - mem8[loc_6b] - (d0 < 0 ? 1 : 0);
    const d1 = mem8[loc_63] - mem8[loc_6c];
    mem8[loc_70] = d1;
    mem8[loc_71] = mem8[loc_64] - mem8[loc_6d] - (d1 < 0 ? 1 : 0);
    // BUG: never emits through loc_df92, never latches cur, never flags $73
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped emit + latch");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_74 + 1, 0x21);
  const r = seamPlaceable(withOmittedRet, loc_c3ba, TARGET, m);
  assert.equal(r.placeable, true, `loc_c3ba must be seam-placeable; got: ${r.error}`);
});
