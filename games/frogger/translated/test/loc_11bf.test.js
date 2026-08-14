// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_11bf (Frogger frog-X lane-collision dispatcher LO, ROM 0x11BF-0x12CF) and its
// second export loc_12d0 (the frog-kill tail, ROM 0x12D0-0x12E3). Guards: (0x83CD)==0 && (0x8004)==0.
// Index = high nibble of (0x8047); HL = 0x11E9 + 2*index reads a 16-bit arm pointer; `jp (hl)` enters
// the arm. Engine arms load an object list (HL) + width (C) and jp 0x1270, which walks the list and
// delegates to the kill tail 0x12D0 or the HI half 0x12E4. Pointer table supplied in a crafted ROM;
// the 0x12D0/0x12E4 delegations (both ROM `jp`s, no push) are stubbed no-ops.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_11bf, loc_12d0 } from "../loc_11bf.js";

const ARMS = [
  0x1209, 0x120c, 0x120f, 0x1212, 0x121a, 0x1222, 0x122a, 0x1232,
  0x123a, 0x1242, 0x124a, 0x1252, 0x125a, 0x1262, 0x126a, 0x126d,
];

function mkRom(over = {}) {
  const rom = new Uint8Array(0x4000);
  ARMS.forEach((a, i) => {
    rom[0x11e9 + 2 * i] = a & 0xff;
    rom[0x11e9 + 2 * i + 1] = (a >> 8) & 0xff;
  });
  for (const [addr, val] of Object.entries(over)) {
    rom[Number(addr)] = val & 0xff;
    rom[Number(addr) + 1] = (val >> 8) & 0xff;
  }
  return rom;
}

function mk(rom = mkRom()) {
  const routines = new Map();
  routines.set(0x12e4, () => {}); // HI-half tail; jp (no push)
  routines.set(0x12d0, () => {}); // kill tail; jp (no push)
  const m = new Machine(rom, routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  m.reads = [];
  const orr = m.mem.read8.bind(m.mem);
  m.mem.read8 = (a) => { m.reads.push(a); return orr(a); };
  return m;
}
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

test("loc_11bf: (0x83CD)!=0 rets at once; 28 T", () => {
  const m = mk();
  w(m, 0x83cd, 0x01);
  loc_11bf(m);
  assert.equal(m.cycles, 28, "ld a,(nn)13 + or a 4 + ret nz taken 11");
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.equal(m.regs.sp, 0x8800, "stack balanced");
});

test("loc_11bf: (0x8004)!=0 rets; 50 T", () => {
  const m = mk();
  w(m, 0x8004, 0x01);
  loc_11bf(m);
  assert.equal(m.cycles, 50, "13+4+5 + 13+4 + ret nz taken 11");
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0xbeef);
});

test("loc_11bf: low nibble >= 9 takes the early jp nc,0x1209 -> jp 0x12E4; 99 T", () => {
  const m = mk();
  w(m, 0x8047, 0x09); // low nibble 9
  loc_11bf(m);
  assert.deepEqual(m.calls, [0x12e4], "early out to the HI half");
  assert.equal(m.cycles, 99);
  assert.equal(m.regs.sp, 0x87fe, "no push/pop on the jp path");
});

test("loc_11bf: index 9 (arm 0x1242, list 0x8136) with an in-range object -> kill tail 0x12D0; 374 T", () => {
  const m = mk();
  w(m, 0x8047, 0x90); // high nibble 9 -> arm 0x1242, FROGX >= 0x80
  w(m, 0x8044, 0x40); // base
  w(m, 0x8136, 0x01); // object count
  w(m, 0x8137, 0x50); // object X, inside [0x43,0x65)
  loc_11bf(m);
  assert.deepEqual(m.calls, [0x12d0], "in-range + FROGX>=0x80 -> kill");
  assert.equal(m.cycles, 374);
  assert.ok(m.reads.includes(0x8136) && m.reads.includes(0x8137), "walked arm 9's list at 0x8136");
});

test("loc_11bf: index 9 with the object out of range -> HI half 0x12E4; 382 T", () => {
  const m = mk();
  w(m, 0x8047, 0x90);
  w(m, 0x8044, 0x40);
  w(m, 0x8136, 0x01);
  w(m, 0x8137, 0x70); // object X at/above E=0x65
  loc_11bf(m);
  assert.deepEqual(m.calls, [0x12e4]);
  assert.equal(m.cycles, 382);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_11bf.js
//   find: regs.bc = 0x11e9;
//   repl: regs.bc = 0x11ea;   // pointer-table base off by one
//   expect: FAIL (reads a misaligned pointer -> out-of-table target -> the switch default throws)
//   verified-anchor: count == 1 (the sole ld bc,0x11e9 in loc_11bf.js)
// Live guard for the same default: a table entry pointing outside {0x1209..0x126d} throws.
test("loc_11bf: an out-of-table arm pointer is rejected by the dispatch default", () => {
  const m = mk(mkRom({ 0x11e9: 0x9999 })); // index-0 pointer -> bogus 0x9999
  w(m, 0x8047, 0x00); // index 0
  assert.throws(() => loc_11bf(m), /outside the frog-X arm table/);
});

// ---- loc_12d0 (the [B3*] mid-entry) exercised standalone ----

function mk12d0() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const rr = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_12d0: 0x30 <= FROGX < 0x80 sets (0x8004)=1 and (0x829C)=1; 87 T", () => {
  const m = mk12d0();
  m.mem.workRam[0x047] = 0x50;
  loc_12d0(m);
  assert.equal(rr(m, 0x8004), 0x01, "(0x8004) = 1");
  assert.equal(rr(m, 0x829c), 0x01, "(0x829c) = 1");
  assert.equal(m.cycles, 87);
  assert.equal(m.pc, 0xbeef);
  assert.equal(m.regs.sp, 0x8800, "ret balanced the stack");
});

test("loc_12d0: FROGX >= 0x80 sets only (0x8004); ret nc; 51 T", () => {
  const m = mk12d0();
  m.mem.workRam[0x047] = 0x90;
  loc_12d0(m);
  assert.equal(rr(m, 0x8004), 0x01);
  assert.equal(rr(m, 0x829c), 0x00, "(0x829c) untouched");
  assert.equal(m.cycles, 51);
});

test("loc_12d0: FROGX < 0x30 sets only (0x8004); ret c; 63 T", () => {
  const m = mk12d0();
  m.mem.workRam[0x047] = 0x10;
  loc_12d0(m);
  assert.equal(rr(m, 0x8004), 0x01);
  assert.equal(rr(m, 0x829c), 0x00);
  assert.equal(m.cycles, 63);
});
