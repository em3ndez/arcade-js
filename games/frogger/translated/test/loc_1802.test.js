// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1802 (Frogger NMI sprite-animation stepper, ROM 0x1802-0x1840). Busy-rets on
// (0x814F)/(0x815B). With frame timer (0x81B4)!=0 it just decrements it. Otherwise it reads a frame
// pointer from the table at 0x1841 (index (0x81B3)), advances the index, reloads the timer, and LDIRs
// 0x0B bytes of that frame into 0x819B. The pointer table + frame data are supplied in a crafted ROM.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1802 } from "../loc_1802.js";

function mk(rom = new Uint8Array(0x4000)) {
  const m = new Machine(rom, new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_1802: busy on (0x814F) rets immediately; 28 T", () => {
  const m = mk();
  m.mem.workRam[0x14f] = 0x01;
  loc_1802(m);
  assert.equal(m.cycles, 28, "ld a,(nn)13 + and a 4 + ret nz taken 11");
});

function check1832(m) {
  assert.equal(r(m, 0x81b4), 0x04, "(0x81b4) timer 5 -> 4");
  assert.equal(m.cycles, 102, "two idle guards 44 + third guard+jp 27 + block_1832 31");
}

test("loc_1802: non-zero frame timer just decrements it (loc_1832); 102 T", () => {
  const m = mk();
  m.mem.workRam[0x1b4] = 0x05;
  loc_1802(m);
  check1832(m);
});

test("loc_1802: timer at zero advances the frame and copies it (loc_1837)", () => {
  const rom = new Uint8Array(0x4000);
  rom[0x1841] = 0x00; rom[0x1842] = 0x30;          // table[0] -> 0x3000
  for (let k = 0; k <= 10; k++) rom[0x3000 + k] = 0xc0 + k; // 11-byte frame
  const m = mk(rom);
  loc_1802(m); // (0x814f)=(0x815b)=(0x81b4)=(0x81b3)=0
  assert.equal(r(m, 0x81b3), 0x01, "(0x81b3) index advanced 0 -> 1");
  assert.equal(r(m, 0x81b4), 0x15, "(0x81b4) timer reloaded to 0x15");
  assert.equal(r(m, 0x819b), 0xc0, "frame byte 0 copied to 0x819b");
  assert.equal(r(m, 0x81a5), 0xca, "frame byte 10 copied to 0x81a5");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1802.js
//   find: regs.decMem8(mem, regs.hl);   // block_1832, (0x81b4)--
//   repl: regs.incMem8(mem, regs.hl);
//   expect: FAIL  ((0x81b4) 5 -> 6 instead of 4 — caught by check1832)
//   verified-anchor: count == 1  (the sole dec (hl) in block_1832 of loc_1802.js)
// Simulated by corrupting exactly the (0x81b4) store, which is what the edit produces.
test("loc_1802: the contract catches a wrong timer step", () => {
  const m = mk();
  m.mem.workRam[0x1b4] = 0x05;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x81b4 ? (v + 2) & 0xff : v, o);
  loc_1802(m);
  assert.throws(() => check1832(m));
});
