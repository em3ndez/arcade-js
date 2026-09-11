// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_de1b (ROM 0xde1b-0xdf08) -- the EAROM state-machine step over $01c6..$01cf
// and the $6000/$6040/$6050 port block. Live-out is memory only (A/X/Y at RTS are incidental), so each
// side runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH). A leaf: the module omits
// the ROM ret and the seam completes it, so the arms compare RAM (-stack), NOT pc/SP.
// The routine's $6000-block reads/writes are the EAROM (deterministic, cloned) -- not POKEY random -- so the
// CRAFTED path is deterministic.
// Run: node --test games/tempest/idiomatic/test/equivalence-de1b.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_de1b as oracle } from "../../translated/loc_de1b.js";
import { loc_de1b } from "../loc_de1b.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_1ca, loc_1cc } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xde1b;
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

test("CAPTURE: real 0xde1b dispatches -- loc_de1b == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_de1b(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Seed that skips the fresh-row rebuild (mode byte nonzero) and drives the carry
// arm: ASL of 0x80 sets carry, so the entry stores and the mode byte becomes 0x40.
const seed = (m) => {
  m.mem.write8(loc_1ca, 0x80); // mode byte nonzero -> ASL sets carry
  m.mem.write8(loc_1cc, 0x00); // cursor 0 keeps the port write inside the EAROM window
};

test("CRAFTED: carry arm retires the mode byte $01ca to 0x40", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_de1b(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the step");
  assert.equal(c.mem.read8(loc_1ca), 0x40, "$01ca folded to 0x40");
});

test("TEETH: a twin that leaves the mode byte untouched diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const brokenDe1b = (m) => {
    const mem = m.mem8;
    mem[(0x6000) & 0xffff] = 0x00; // does the port write but BUG: never folds $01ca to 0x40
  };
  brokenDe1b(c);
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the RAM diff FAILED to catch the skipped mode-byte store");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seed(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_de1b, TARGET, m);
  assert.equal(r.placeable, true, `loc_de1b must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
