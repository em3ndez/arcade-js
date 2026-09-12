// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b7eb (ROM 0xb7eb-0xb829) -- refreshes two axis params from the $0435/$0445
// tables (index $29), runs the two frame updaters (loc_c098, loc_c765 with X=0x61), counts down the
// sub-timer $013c (on wrap advances phase $013b and reloads $013c), optionally runs the phase handler
// (loc_b84e when the $b83d entry is >= 0), then emits the phase's $cec8/$cec9 vector-pair word via the
// loc_df57 tail. Dissolves all four m.calls into direct idiomatic calls. All live-out is RAM (the tables,
// the timer/phase cells, and every callee's writes); the oracle also leaves A as a df5f-family cursor byte
// the tail does not reproduce, and b7eb reads no register after, so each arm compares RAM only, not A.
// Run: node --test games/tempest/idiomatic/test/equivalence-b7eb.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b7eb as oracle } from "../../translated/loc_b7eb.js";
import { loc_b7eb } from "../loc_b7eb.js";
import { loc_c098 } from "../loc_c098.js";
import { loc_c765 } from "../loc_c765.js";
import { loc_b84e } from "../loc_b84e.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { STACK_SCRATCH, loc_29, loc_56, loc_58, loc_13b, loc_13c, loc_435, loc_445, loc_b82a, loc_b83d, loc_cec8, loc_cec9, loc_74, loc_75 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb7eb;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 4000) : [];

// Seat the frame index $29, the sub-timer $013c, the phase $013b, and a VECTOR RAM cursor ($74/$75) so
// the emitted word lands in the diffed region. $013c==1 forces the wrap (reload + phase advance) branch.
function seed(m, s = {}) {
  m.mem.write8(loc_29, s.y ?? 0x00);
  m.mem.write8(loc_13b, s.phase ?? 0x00);
  m.mem.write8(loc_13c, s.timer ?? 0x03);
  const ptr = s.ptr ?? 0x2500;
  m.mem.write8(loc_74, ptr & 0xff);
  m.mem.write8(loc_75, (ptr >> 8) & 0xff);
}

test("CAPTURE: real 0xb7eb dispatches -- loc_b7eb == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b7eb(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: no-wrap (timer>1) -- axis params refresh, timer ticks, matches the oracle in RAM", () => {
  const s = { y: 0x00, phase: 0x00, timer: 0x03 };
  const o = new Machine(ROM, OPTS); seed(o, s);
  const c = new Machine(ROM, OPTS); seed(c, s);
  oracle(o); loc_b7eb(c);
  assert.equal(ramDiff(o, c), null, "RAM equal (no-wrap)");
  assert.equal(c.mem.read8(loc_13c), 0x02, "sub-timer decremented");
  assert.equal(c.mem.read8(loc_56), o.mem.read8(loc_56), "$56 axis param refreshed");
  assert.equal(c.mem.read8(loc_58), o.mem.read8(loc_58), "$58 axis param refreshed");
});

test("CRAFTED: wrap (timer==1) -- phase advances and the timer reloads, matches the oracle in RAM", () => {
  const s = { y: 0x00, phase: 0x00, timer: 0x01 };
  const o = new Machine(ROM, OPTS); seed(o, s);
  const c = new Machine(ROM, OPTS); seed(c, s);
  oracle(o); loc_b7eb(c);
  assert.equal(ramDiff(o, c), null, "RAM equal (wrap)");
  assert.equal(c.mem.read8(loc_13b), o.mem.read8(loc_13b), "phase advanced identically");
  assert.equal(c.mem.read8(loc_13c), o.mem.read8(loc_13c), "sub-timer reloaded identically");
});

test("TEETH: a twin that never ticks the sub-timer diverges from the oracle", () => {
  const s = { y: 0x00, phase: 0x00, timer: 0x03 };
  const o = new Machine(ROM, OPTS); seed(o, s);
  const c = new Machine(ROM, OPTS); seed(c, s);
  oracle(o);
  const broken = (m) => {
    const { mem8, mem16 } = m;
    const y = mem8[loc_29];
    mem8[loc_56] = mem8[u16(loc_435 + y)];
    mem8[loc_58] = mem8[u16(loc_445 + y)];
    loc_c098(m);
    loc_c765(m, 0x61);
    const x = mem8[loc_13b]; // BUG: never decrements/reloads $013c, never advances the phase
    const phase = mem8[u16(loc_b83d + x)];
    if (phase < 0x80) loc_b84e(m, phase);
    // emit still happens, but $013c is left stale
    void mem16;
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped timer tick");
});

test("TEETH (marshalling): a twin that swaps the df57 emit pair diverges from the oracle", () => {
  const s = { y: 0x00, phase: 0x00, timer: 0x03 };
  const idx = ((s.phase << 1) + 0x28) & 0xff;
  // Only meaningful when the two table bytes differ; assert that precondition, then check divergence.
  const probe = new Machine(ROM, OPTS);
  const lo = probe.mem.read8((loc_cec8 + idx) & 0xffff);
  const hi = probe.mem.read8((loc_cec9 + idx) & 0xffff);
  assert.notEqual(lo, hi, "precondition: the emit pair bytes differ so a swap is observable");

  const o = new Machine(ROM, OPTS); seed(o, s);
  const c = new Machine(ROM, OPTS); seed(c, s);
  oracle(o);
  const broken = (m) => {
    const { mem8, mem16 } = m;
    const y = mem8[loc_29];
    mem8[loc_56] = mem8[u16(loc_435 + y)];
    mem8[loc_58] = mem8[u16(loc_445 + y)];
    loc_c098(m);
    loc_c765(m, 0x61);
    let x = mem8[loc_13b];
    const ticked = (mem8[loc_13c] - 1) & 0xff;
    mem8[loc_13c] = ticked;
    if (ticked === 0) {
      x = (x + 1) & 0xff;
      mem8[loc_13b] = x;
      mem8[loc_13c] = mem8[u16(loc_b82a + x)];
    }
    const phase = mem8[u16(loc_b83d + x)];
    if (phase < 0x80) loc_b84e(m, phase);
    const j = ((mem8[loc_13b] << 1) + 0x28) & 0xff;
    const p = mem16[loc_74];
    // BUG: swapped low/high emit bytes
    mem8[p] = mem8[u16(loc_cec9 + j)];
    mem8[u16(p + 1)] = mem8[u16(loc_cec8 + j)];
    mem8[loc_74] = (mem8[loc_74] + 2) & 0xff;
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the swapped emit pair");
});

test("SP-TOOTH: the omitted-ret tail-caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seed(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_b7eb, TARGET, m);
  assert.equal(r.placeable, true, `loc_b7eb must be seam-placeable; got: ${r.error}`);
});
