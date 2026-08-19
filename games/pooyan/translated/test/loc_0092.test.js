// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for translated loc_0092 (ROM 0x0092, Pooyan) -- the boot entry reached by
// `jp 0x0092`. Uses the REAL Machine (real AddressSpace: DSW routing, watchdog, LS259, ldirAt,
// exact Z80 timing) with every callee/rst-vector/tail-jp target stubbed: `bal` pops the return
// address a real `ret` would (keeping SP balanced), so control flows straight through loc_0092
// without depending on sibling routines that other batches own. DSW1/DSW0 = the io.js idle
// defaults (0x7B / 0xFF). Pins one deterministic path: the ROM self-test (all 8 banks pass ->
// 0x8fff = 0x08 pushed-B + 8), the DSW-derived HUD/control seeds, and the tail-jp to 0x020f.
// TEETH: mis-charge the entry `ld ix,0x0079` (DD-prefixed 14 T) as a plain `ld hl,nn` (10 T);
// the golden cycle total must catch the 4 T it drops.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Machine } from "../../machine.js";
import { loc_0092 } from "../loc_0092.js";

const ROM = new Uint8Array(fs.readFileSync(new URL("../../rom/maincpu.bin", import.meta.url)));

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // callee/rst that immediately rets
const noop = () => {}; // tail-jp target: no return address was pushed
const CALLEES = [0x0010, 0x0020, 0x02e6, 0x01ea, 0x0e8f];

function mk() {
  const routines = new Map(CALLEES.map((a) => [a, bal]));
  routines.set(0x020f, noop);
  const m = new Machine(ROM, routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.a = 0x00; // A as left by the reset vector's `xor a`
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  m.pcSeq = [];
  const os = m.step.bind(m);
  m.step = (na, c) => { m.pcSeq.push(na); return os(na, c); };
  return m;
}
const rd = (m, a) => m.mem.read8(a);

const CALLS = [0x0020, 0x0010, 0x0010, 0x02e6, 0x0020, 0x0020, 0x01ea, 0x0e8f, 0x0010, 0x020f];
const CYCLES = 1605900;
const PCLEN = 223575;

function assertGolden(m) {
  assert.equal(m.cycles, CYCLES, "total T-states");
  assert.equal(m.pc, 0x020f, "ends at the 0x020f tail-jp target");
  assert.equal(m.pcSeq.length, PCLEN, "instruction-boundary count");
  assert.deepEqual(m.calls, CALLS, "rst / call / tail-jp seam targets, in order");
  assert.deepEqual(m.pcSeq.slice(0, 8),
    [0x0095, 0x0098, 0x009b, 0x009d, 0x009e, 0x00a1, 0x00a5, 0x00a8], "prologue boundaries");
  assert.deepEqual(m.pcSeq.slice(-10),
    [0x01c1, 0x01c3, 0x01c6, 0x01c8, 0x01cb, 0x01ce, 0x01cf, 0x01d1, 0x0010, 0x020f], "tail boundaries");
  assert.equal(m.io.watchdogKicks, 14, "watchdog kicked 1 + 8(per bank) + 5 times");
  assert.equal(m.io.latch[0], 1, "LS259 b0 -> vblank NMI enabled");
  assert.equal(m.io.latch[7], 1, "LS259 b7 written 1");
  // ROM self-test: all 8 banks match the 0x0079 table -> tally at 0x8fff = pushed B (0x08) + 8.
  assert.equal(rd(m, 0x8fff), 0x10, "self-test pass tally");
  // work RAM was cleared then re-seeded (values below survive the 0x8800-0x8ffd ldir clear).
  assert.equal(rd(m, 0x881f), 0x01, "(0x881f) = 1");
  assert.equal(rd(m, 0x88a0), 0xc0, "(0x88a0) low");
  assert.equal(rd(m, 0x88a1), 0xc0, "(0x88a1) high");
  assert.equal(rd(m, 0x88aa), 0x01, "(0x88aa) = 1");
  assert.equal(rd(m, 0x8a40), 0x43, "(0x8a40) = 0x43");
  assert.equal(rd(m, 0x8a41), 0x43, "(0x8a41) = 0x43");
  assert.equal(rd(m, 0x8a42), 0x08, "(0x8a42) = 0x08");
  // DSW1 (0x7b) -> control bits at 0x880f/0x8800/0x8820/0x8821 and the 0x8807 add-3 branch.
  assert.equal(rd(m, 0x880f), 0x01, "(0x880f) DSW1 bit");
  assert.equal(rd(m, 0x8800), 0x00, "(0x8800) DSW1 bit");
  assert.equal(rd(m, 0x8820), 0x00, "(0x8820) DSW1 field");
  assert.equal(rd(m, 0x8821), 0x01, "(0x8821) DSW1 bit");
  assert.equal(rd(m, 0x8807), 0x03, "(0x8807) = (cpl DSW1 & 3) + 3");
  // DSW0 rst-0x20 lookups are stubbed here, so 0x882f/0x882c hold the PRE-lookup A (0x0f).
  assert.equal(rd(m, 0x882f), 0x0f, "(0x882f) pre-lookup A (rst 0x20 stubbed)");
  assert.equal(rd(m, 0x882c), 0x0f, "(0x882c) pre-lookup A (rst 0x20 stubbed)");
  // loc_01b8 seeded 10 x (0,0,1) at 0x8a00-0x8a1d.
  assert.equal(rd(m, 0x8a00), 0x00, "(0x8a00) triple lo");
  assert.equal(rd(m, 0x8a02), 0x01, "(0x8a02) triple hi");
  assert.equal(rd(m, 0x8a1d), 0x01, "(0x8a1d) last triple hi");
  // colour RAM filled with 0x10 by the 0x0148 ldir.
  assert.equal(rd(m, 0x8000), 0x10, "colour RAM start = 0x10");
  assert.equal(rd(m, 0x83ff), 0x10, "colour RAM end = 0x10");
}

test("loc_0092 boot: ROM self-test + HUD/DSW seed + tail-jp to 0x020f", () => {
  const m = mk();
  loc_0092(m);
  assertGolden(m);
});

test("loc_0092 MUTATION: entry `ld ix,0x0079` mis-charged 10T (not 14T) is caught", () => {
  const m = mk();
  let first = true;
  const os = m.step.bind(m);
  m.step = (na, c) => {
    if (first && na === 0x00a5) { first = false; return os(na, 10); } // 14 -> 10
    return os(na, c);
  };
  loc_0092(m);
  assert.equal(m.cycles, CYCLES - 4, "mutation drops exactly 4 T (14 -> 10)");
  assert.throws(() => assertGolden(m), /total T-states/, "the cycle golden must fail on the mutant");
});
