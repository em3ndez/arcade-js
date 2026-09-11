// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_c9af (ROM 0xc9af-0xc9f0) -- clears $04, decrements $48,x; when $48|$49 == 0 it
// hands off to loc_c9f1 and returns, else it picks the next non-empty slot via the $3f toggle and arms the
// $02/$00 timers. The idiomatic dissolves the m.call(0xc9f1) into a direct loc_c9f1(m). Live-out is memory
// only (A/X/Y at RTS differ per exit path, so incidental). A leaf: the module omits the ROM ret and the seam
// completes it, so arms compare RAM (-stack), NOT pc/SP.
// Run: node --test games/tempest/idiomatic/test/equivalence-c9af.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c9af as oracle } from "../../translated/loc_c9af.js";
import { loc_c9af } from "../loc_c9af.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_0, loc_2, loc_4, loc_3d, loc_3e, loc_3f, loc_46, loc_47, loc_48, loc_49, loc_126 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc9af;
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

test("CAPTURE: real 0xc9af dispatches -- loc_c9af == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_c9af(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED pick-slot: gate byte survives -> slot chosen, $02/$00 timers armed", () => {
  const seed = (m) => {
    m.mem.write8(loc_3d, 0x00); // X source
    m.mem.write8(loc_48, 0x03); // gate byte, decremented to 0x02 (still nonzero)
    m.mem.write8(loc_49, 0x00);
    m.mem.write8(loc_3e, 0x00); // no toggle
    m.mem.write8(loc_3f, 0x00); // selected slot
    m.mem.write8(loc_46, 0x05); // $46+slot -> nonzero increment
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c9af(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the pick-slot path");
  assert.equal(c.mem.read8(loc_48), 0x02, "$48 decremented");
  assert.equal(c.mem.read8(loc_2), 0x02, "$02 timer = 0x02");
  assert.equal(c.mem.read8(loc_0), 0x0a, "$00 timer = 0x0a");
  assert.equal(c.mem.read8(loc_4), 0x00, "$04 cleared");
});

test("CRAFTED gate-zero: $48|$49 spent -> the dissolved loc_c9f1 hand-off runs", () => {
  const seed = (m) => {
    m.mem.write8(loc_3d, 0x00);
    m.mem.write8(loc_48, 0x01); // decrements to 0x00
    m.mem.write8(loc_49, 0x00); // -> $48|$49 == 0
    m.mem.write8(loc_3e, 0x02); // c9f1 scan window
    m.mem.write8(loc_46, 0x10);
    m.mem.write8(loc_47, 0x30); // largest in the window
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); loc_c9af(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the c9f1 hand-off path");
  assert.equal(c.mem.read8(loc_126), 0x2f, "c9f1 wrote max-1 to $126");
});

test("TEETH: a twin that skips the $48,x decrement diverges from the oracle", () => {
  const seed = (m) => {
    m.mem.write8(loc_3d, 0x00);
    m.mem.write8(loc_48, 0x03);
    m.mem.write8(loc_49, 0x00);
    m.mem.write8(loc_3e, 0x00);
    m.mem.write8(loc_3f, 0x00);
    m.mem.write8(loc_46, 0x05);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  const brokenC9af = (m) => {
    const mem = m.mem8;
    mem[loc_4] = 0;
    // BUG: never decrements $48,x
    mem[loc_2] = 0x02;
    mem[loc_0] = 0x0a;
  };
  brokenC9af(c);
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the RAM diff FAILED to catch the skipped decrement");
});

test("SP-TOOTH: the omitted-ret leaf (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_c9af, TARGET, m);
  assert.equal(r.placeable, true, `loc_c9af must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret leaf (moved 0) placeable");
});
