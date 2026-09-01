// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_0a5f (ROM 0x0a5f) -- when the trigger cell (loc_20ef) is nonzero: sound the
// cue (startSound with bit 0x08), index the 3-entry table via loc_097c using the passed count, and stamp
// the looked-up byte at loc_20f2 with markers 0x01 at loc_20f1 / 0x00 at loc_20f3; always return HL=loc_2062.
// Both m.call(0x18fa) and m.call(0x097c) are DISSOLVED into direct idiomatic calls. Input register B (the
// table index); live-out is memory PLUS the returned record pointer HL (the caller feeds it to loadSpriteDescriptor).
// Run: node --test games/invaders/idiomatic/test/equivalence-0a5f.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0a5f as oracle } from "../../translated/loc_0a5f.js";
import { loc_0a5f } from "../loc_0a5f.js";
import { startSound } from "../startSound.js";
import { loc_097c } from "../loc_097c.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_20ef, loc_20f1, loc_20f2, loc_20f3, loc_2062 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x0a5f;
const CALLER_RET = 0xabcd;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  new Machine(ROM, { overrides: snap }).runFrames(maxFrames);
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 1500) : [];

test("CAPTURE: real 0x0a5f dispatches -- loc_0a5f == oracle in RAM (-stack) and HL live-out", () => {
  for (const cap of CAPS) {
    // The oracle push16s each nested m.call's return word below the entry SP, then tail-rets through the
    // seam; the module never touches the stack. Exclude relative to the entry SP as well as fixed scratch.
    const sp = cap.regs.sp;
    const capDiff = (ma, mb) => firstStateDiff(ma.dumpState(), mb.dumpState(),
      (off) => ma.stateOffsetToAddr(off),
      (a) => inDeadStack(a) || (a != null && a >= sp - 0x10 && a < sp));
    const o = cap.clone(), c = cap.clone();
    o.io.setInte(false); c.io.setInte(false);
    oracle(o); loc_0a5f(c);
    assert.equal(capDiff(o, c), null);
    assert.equal(c.regs.hl, o.regs.hl, "returned HL");
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: trigger set -> sound + table byte + markers stamped; HL=loc_2062", () => {
  for (const b of [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x7f, 0xff]) {
    const o = new Machine(ROM); const c = new Machine(ROM);
    o.regs.sp = 0x2400; o.push16(CALLER_RET); o.io.setInte(false);
    c.regs.sp = 0x2400; c.push16(CALLER_RET); c.io.setInte(false);
    o.mem.write8(loc_20ef, 0x01); c.mem.write8(loc_20ef, 0x01); // trigger set
    o.regs.b = b; c.regs.b = b;
    oracle(o); loc_0a5f(c);
    const label = `B=0x${b.toString(16)}`;
    assert.equal(ramDiff(o, c), null, label);
    assert.equal(c.regs.hl, o.regs.hl, `HL vs oracle ${label}`);
    assert.equal(c.regs.hl, loc_2062 & 0xffff, `HL value ${label}`);
    assert.equal(c.mem.read8(loc_20f1), 0x01, `active marker ${label}`);
    assert.equal(c.mem.read8(loc_20f3), 0x00, `clear marker ${label}`);
    // the looked-up byte matches the oracle (it reads the table via loc_097c's clamp of B)
    assert.equal(c.mem.read8(loc_20f2), o.mem.read8(loc_20f2), `table byte ${label}`);
    // cross-check: the stamped byte is exactly mem[loc_097c(B)]
    const probe = new Machine(ROM); probe.regs.a = b;
    assert.equal(c.mem.read8(loc_20f2), probe.mem.read8(loc_097c(probe, b)), `table byte value ${label}`);
  }
});

test("CRAFTED: trigger clear -> no markers, no sound; HL=loc_2062", () => {
  const o = new Machine(ROM); const c = new Machine(ROM);
  o.regs.sp = 0x2400; o.push16(CALLER_RET); o.io.setInte(false);
  c.regs.sp = 0x2400; c.push16(CALLER_RET); c.io.setInte(false);
  o.mem.write8(loc_20ef, 0x00); c.mem.write8(loc_20ef, 0x00); // trigger clear
  // pre-dirty the markers on both so an accidental write would show up
  for (const a of [loc_20f1, loc_20f2, loc_20f3]) { o.mem.write8(a, 0xaa); c.mem.write8(a, 0xaa); }
  o.regs.b = 0x03; c.regs.b = 0x03;
  oracle(o); loc_0a5f(c);
  assert.equal(ramDiff(o, c), null);
  assert.equal(c.regs.hl, loc_2062 & 0xffff, "HL still seated");
  assert.equal(c.mem.read8(loc_20f1), 0xaa, "marker untouched");
});

test("TEETH: a module-mutating twin (drops the 0x01 active marker) is caught", () => {
  // Broken twin of loc_0a5f: omits the loc_20f1 = 0x01 store.
  function loc_0a5f_broken(m, b = m.regs.b) {
    if (m.mem8[loc_20ef]) {
      startSound(m, 0x08);
      m.mem8[loc_20f2] = m.mem8[loc_097c(m, b)];
      // BUG: dropped the active marker at loc_20f1
      m.mem8[loc_20f3] = 0x00;
    }
    return (m.regs.hl = loc_2062);
  }
  const o = new Machine(ROM); const c = new Machine(ROM);
  o.regs.sp = 0x2400; o.push16(CALLER_RET); o.io.setInte(false);
  c.regs.sp = 0x2400; c.push16(CALLER_RET); c.io.setInte(false);
  o.mem.write8(loc_20ef, 0x01); c.mem.write8(loc_20ef, 0x01);
  o.mem.write8(loc_20f1, 0xaa); c.mem.write8(loc_20f1, 0xaa); // pre-dirty so the dropped store shows
  o.regs.b = 0x03; c.regs.b = 0x03;
  oracle(o); loc_0a5f_broken(c);
  const d = ramDiff(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch a dropped marker store");
  assert.equal(d.addr, loc_20f1 & 0xffff);
});
