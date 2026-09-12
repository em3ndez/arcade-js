// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_df57 (ROM 0xdf57) -- the shared vector-word tail reached with the pair
// preset: store A at ($74/$75)+0 and X at +1, then advance the ($74/$75) cursor by 2 (tail into
// loc_df5f). loc_df53 falls into it with the fixed {0x40,0x80}; loc_df4c/loc_df6c/loc_ab0d reach it
// with a computed pair. The oracle m.call(0xdf5f)s the translated tail; the idiomatic calls the
// idiomatic loc_df5f -- both memory-equivalent, so the contract is RAM (dumpState, minus STACK_SCRATCH).
// A/X are INPUTS (read from the register bridge); the display-builder family leaves no asserted
// register live-out (the landed loc_df5f tail preserves none). Plain caller -- no SP tooth, no POKEY read.
// Run: node --test games/tempest/idiomatic/test/equivalence-df57.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_df57 as oracle } from "../../translated/loc_df53.js";
import { loc_df57 } from "../loc_df53.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { STACK_SCRATCH, loc_74, loc_75 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const opt = (name) => {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
};
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xdf57;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function seedRegs(m, a, x) { m.regs.a = a; m.regs.x = x; }
function seedCursor(m, lo, hi) { m.mem.write8(loc_74, lo); m.mem.write8(loc_75, hi); }

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 2000) : [];

test("CAPTURE: real 0xdf57 dispatches -- loc_df57 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_df57(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: {A,X} word written at cursor and cursor advanced by 2 == oracle (RAM -stack)", () => {
  // The ($74/$75) cursor points into the AVG display list = vector RAM (0x2000-0x2FFF, "diffed").
  // Keep every seed inside vector RAM so the two stores land in the RAM dump.
  const cases = [
    { tag: "no carry: ptr=0x2000", a: 0x3c, x: 0x72, lo: 0x00, hi: 0x20 },
    { tag: "low carry: $74=0xff -> +2 carries into $75", a: 0x11, x: 0x22, lo: 0xff, hi: 0x20 },
    { tag: "top of vec RAM: ptr=0x2ffe -> cursor advances to 0x3000", a: 0xa5, x: 0x5a, lo: 0xfe, hi: 0x2f },
  ];
  for (const t of cases) {
    const o = new Machine(ROM, OPTS); seedCursor(o, t.lo, t.hi); seedRegs(o, t.a, t.x);
    const c = new Machine(ROM, OPTS); seedCursor(c, t.lo, t.hi); seedRegs(c, t.a, t.x);
    oracle(o); loc_df57(c);
    assert.equal(ramDiff(o, c), null, `RAM: ${t.tag}`);
    const ptr = u16((t.hi << 8) | t.lo);
    assert.equal(c.mem.read8(ptr), t.a, `${t.tag}: byte0 = A`);
    assert.equal(c.mem.read8(u16(ptr + 1)), t.x, `${t.tag}: byte1 = X`);
  }
});

test("TEETH: a twin that swaps the two bytes (X first, A second) diverges from the oracle", () => {
  const lo = 0x40, hi = 0x20, a = 0x3c, x = 0x72;
  const o = new Machine(ROM, OPTS); seedCursor(o, lo, hi); seedRegs(o, a, x); oracle(o);
  const c = new Machine(ROM, OPTS); seedCursor(c, lo, hi); seedRegs(c, a, x);
  const swapped = (m, aa = m.regs.a, xx = m.regs.x) => {
    const { mem8, mem16 } = m;
    const ptr = mem16[loc_74];
    mem8[ptr] = xx;               // BUG: X first
    mem8[u16(ptr + 1)] = aa;      // BUG: A second
    // (still advances via the shared tail so only the byte order differs)
    mem8[loc_74] = mem8[loc_74] + 2;
  };
  swapped(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the swapped byte order");
});

test("TEETH: a twin that skips the cursor advance diverges from the oracle", () => {
  const lo = 0x00, hi = 0x20, a = 0x3c, x = 0x72;
  const o = new Machine(ROM, OPTS); seedCursor(o, lo, hi); seedRegs(o, a, x); oracle(o);
  const c = new Machine(ROM, OPTS); seedCursor(c, lo, hi); seedRegs(c, a, x);
  const noAdvance = (m, aa = m.regs.a, xx = m.regs.x) => {
    const { mem8, mem16 } = m;
    const ptr = mem16[loc_74];
    mem8[ptr] = aa;
    mem8[u16(ptr + 1)] = xx;      // BUG: never advances the cursor
  };
  noAdvance(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped cursor advance");
});
