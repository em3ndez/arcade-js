// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_df6c (ROM 0xdf6c-0xdf72) -- tags A with the 0x70 header bits, then emits the
// vector word {Y, tagged-A} at the cursor and advances it. The idiomatic side dissolves the jmp $df57 tail
// into a direct loc_df57(m, y, a|0x70) call. Live-out is memory only (pure tail-caller, reads no register
// after), so each arm compares RAM (dumpState minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-df6c.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_df6c as oracle } from "../../translated/loc_df6c.js";
import { loc_df6c } from "../loc_df6c.js";
import { loc_df57 } from "../loc_df53.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_74, loc_75 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xdf6c;
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

// Aim the cursor into diffed vector RAM and preset the A/Y payload.
function seed(m, a, y) {
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_75, 0x20); // cursor -> $2000
  m.regs.a = a; m.regs.y = y;
}

test("CAPTURE: real 0xdf6c dispatches -- loc_df6c == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_df6c(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: word {Y, A|0x70} emitted at the cursor, cursor advanced", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x0c, 0x2a);
  const c = new Machine(ROM, OPTS); seed(c, 0x0c, 0x2a);
  oracle(o); loc_df6c(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after emit");
  assert.equal(c.mem.read8(0x2000), 0x2a, "first byte = Y payload");
  assert.equal(c.mem.read8(0x2001), 0x7c, "second byte = A tagged with 0x70");
});

test("TEETH: a twin tagging with 0x60 instead of 0x70 diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o, 0x0c, 0x2a); oracle(o);
  const c = new Machine(ROM, OPTS); seed(c, 0x0c, 0x2a);
  const brokenDf6c = (m, a = m.regs.a, y = m.regs.y) => loc_df57(m, y, a | 0x60); // BUG: wrong header bits
  brokenDf6c(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong header tag");
});

test("SP-TOOTH: the omitted-ret tail-caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_df6c, TARGET, m);
  assert.equal(r.placeable, true, `loc_df6c must be seam-placeable; got: ${r.error}`);
});
