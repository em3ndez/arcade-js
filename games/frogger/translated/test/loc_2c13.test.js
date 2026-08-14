// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2c13 (Frogger IX sprite-object arm, ROM 0x2C13-0x2CA7). Gated on (0x83b7)>=3 and
// (ix+0x06)==0; pulls bytes from loc_0aee (stubbed to return a fixed sequence + balance SP), indexes ROM
// tables 0x2CE6/0x2CDC to a work-RAM cell, runs the 0x2C6D scan loop, and writes the object's
// (ix+0x00..0x06)/(ix+0x09)/(ix+0x0b). ROM table bytes are planted so the deep path is deterministic.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2c13 } from "../loc_2c13.js";

const IX = 0x8300;

function mkrom() {
  const rom = new Uint8Array(0x4000);
  rom[0x2cea] = 0x30; // table_2ce6[2*C=4]+0 -> E
  rom[0x2ceb] = 0x50; // table_2ce6[..]+1 -> ptr1 low (ix+0x0b); ptr1 = 0x8050
  rom[0x2ce0] = 0x00; // table_2cdc[2*C=4]+0 -> hl2 low
  rom[0x2ce1] = 0x81; // table_2cdc[..]+1 -> hl2 high; hl2 = 0x8100
  return rom;
}

// aee returns: call#1=0x10 (<=0xA0 so the cp-b gate passes), #2=0x02 (&7 < 5),
// #3 dead, #4=0x02 (even -> the 0x80/0xf0 arm).
function mk(rets = [0x10, 0x02, 0x00, 0x02]) {
  let idx = 0;
  const aee = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; mm.regs.a = rets[idx++]; };
  const m = new Machine(mkrom(), new Map([[0x0aee, aee]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.ix = IX;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

function setupDeep(m) {
  w(m, 0x83b7, 0x04); // >= 3 -> C=4
  w(m, IX + 0x06, 0x00); // gate open
  w(m, 0x8050, 0x50); // mem[ptr1] -> D
  w(m, 0x8100, 0x01); // mem[hl2] -> rrca,rrca,-0x10 = 0x30 -> C
}

test("loc_2c13: deep spawn path writes the full ix[0..6]/[9]/[b] record", () => {
  const m = mk();
  setupDeep(m);
  loc_2c13(m);
  assert.equal(r(m, IX + 0x04), 0x50, "(ix+4) = nibble-swap(2)+0x30");
  assert.equal(r(m, IX + 0x0b), 0x50, "(ix+0xb) = ptr1 low");
  assert.equal(r(m, IX + 0x02), 0x50, "(ix+2) = mem[ptr1]");
  assert.equal(r(m, IX + 0x01), 0x30, "(ix+1) = mem[ptr1] - B");
  assert.equal(r(m, IX + 0x00), 0x60, "(ix+0) = (ix+1) + C");
  assert.equal(r(m, IX + 0x05), 0x80, "(ix+5) = 0x80 (call#4 even)");
  assert.equal(r(m, IX + 0x03), 0xf0, "(ix+3) = 0xf0");
  assert.equal(r(m, IX + 0x06), 0x01, "(ix+6) armed");
  assert.equal(r(m, IX + 0x09), 0x08, "(ix+9) = 0x08");
  assert.deepEqual(m.calls, [0x0aee, 0x0aee, 0x0aee, 0x0aee], "four loc_0aee draws");
  assert.equal(m.regs.sp, 0x8800, "SP balanced");
});

test("loc_2c13: call#4 odd -> the 0x00/0x00 arm for (ix+0x05)/(ix+0x03)", () => {
  const m = mk([0x10, 0x02, 0x00, 0x03]); // #4 odd -> rrca sets carry
  setupDeep(m);
  loc_2c13(m);
  assert.equal(r(m, IX + 0x05), 0x00, "(ix+5) = 0x00");
  assert.equal(r(m, IX + 0x03), 0x00, "(ix+3) = 0x00");
});

test("loc_2c13: (0x83b7) < 3 rets immediately (31 T), no draws, no writes", () => {
  const m = mk();
  w(m, 0x83b7, 0x02);
  w(m, IX + 0x06, 0x55);
  loc_2c13(m);
  assert.equal(m.cycles, 31, "ld a,(nn)13 + cp 7 + ret c taken 11");
  assert.equal(r(m, IX + 0x06), 0x55, "no write");
  assert.deepEqual(m.calls, [], "loc_0aee not called");
  assert.equal(m.regs.sp, 0x8800, "SP balanced");
});

test("loc_2c13: (ix+0x06)!=0 rets nz after one gate load", () => {
  const m = mk();
  w(m, 0x83b7, 0x04);
  w(m, IX + 0x06, 0x01); // already armed
  loc_2c13(m);
  assert.deepEqual(m.calls, [], "no draw when already armed");
  assert.equal(r(m, IX + 0x04), 0x00, "no write");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2c13.js
//   find: regs.add(0x30);
//   repl: regs.add(0x31);
//   expect: FAIL  ((ix+0x04) becomes 0x51, not nibble-swap(2)+0x30 = 0x50)
//   verified-anchor: count == 1  (the sole `regs.add(0x30);` in loc_2c13.js)
// Simulated by intercepting the (ix+0x04)=0x8304 store, the only cell the patched constant moves.
test("loc_2c13: the contract catches a wrong (ix+0x04) constant", () => {
  const m = mk();
  setupDeep(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, a === (IX + 0x04) ? (val + 1) & 0xff : val, o);
  loc_2c13(m);
  assert.notEqual(r(m, IX + 0x04), 0x50, "mutated constant no longer matches the contract");
});
