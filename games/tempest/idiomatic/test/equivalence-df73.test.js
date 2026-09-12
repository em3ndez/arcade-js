// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_df73 (ROM 0xdf73-0xdf74) -- stashes Y at $73, then falls through into loc_df75
// to scale A,X into the vector work pair. The idiomatic side dissolves the fall-through into a direct
// loc_df75(m, a, x) tail call. Live-out is memory only ($73 plus df75's scaled pair); registers are NOT
// asserted. Run: node --test games/tempest/idiomatic/test/equivalence-df73.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_df73 as oracle } from "../../translated/loc_df73.js";
import { loc_df73 } from "../loc_df73.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { loc_df75 } from "../loc_df75.js";
import { STACK_SCRATCH, loc_73 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xdf73;
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

test("CAPTURE: real 0xdf73 dispatches -- loc_df73 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_df73(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Distinct A/Y/X so both the $73 stash and the scaled pair (df75 gets A then X) are real memory checks.
function seedDistinct(m) {
  m.regs.a = 0x11; m.regs.y = 0x22; m.regs.x = 0x33;
}

test("CRAFTED: distinct A/Y/X -- loc_df73 == oracle in RAM", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  oracle(o); loc_df73(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after stash + scale");
  assert.equal(c.mem.read8(loc_73), 0x22, "Y stashed at $73");
});

test("TEETH: a twin that skips the $73 stash diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  oracle(o);
  const brokenDf73 = (m, y = m.regs.y, a = m.regs.a, x = m.regs.x) => {
    loc_df75(m, a, x); // BUG: never stashes Y at $73
  };
  brokenDf73(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped stash");
});

test("TEETH (marshalling): a twin that scales X,A swapped diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedDistinct(o); oracle(o);
  const c = new Machine(ROM, OPTS); seedDistinct(c);
  const swappedTwin = (m, y = m.regs.y, a = m.regs.a, x = m.regs.x) => {
    m.mem8[loc_73] = y;
    return loc_df75(m, x, a); // BUG: A and X args swapped
  };
  swappedTwin(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the swapped scale args");
});

test("SP-TOOTH: the omitted-ret caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_df73, TARGET, m);
  assert.equal(r.placeable, true, `loc_df73 must be seam-placeable; got: ${r.error}`);
});
