// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_12e4 (Frogger frog-X move dispatcher HI, ROM 0x12E4-0x13EC). Guarded by
// (0x8004). Index = high nibble of ((0x8047)+0x0F); low nibble <5 short-circuits to arm 0. HL =
// 0x130B + 2*index reads a pointer from the table at 0x130B and jp(hl) enters an arm; engine arms fall
// into the lane scan at 0x138F. The pointer table is supplied in a crafted ROM; 0x12D0 is stubbed.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_12e4 } from "../loc_12e4.js";

const TABLE = [
  0x132b, 0x132e, 0x1331, 0x1334, 0x133c, 0x1344, 0x134c, 0x1354,
  0x135c, 0x1364, 0x136c, 0x1374, 0x137c, 0x1384, 0x138c, 0x138c,
];

function mkRom() {
  const rom = new Uint8Array(0x4000);
  TABLE.forEach((a, i) => { rom[0x130b + 2 * i] = a & 0xff; rom[0x130b + 2 * i + 1] = (a >> 8) & 0xff; });
  return rom;
}

function mk() {
  const m = new Machine(mkRom(), new Map([[0x12d0, () => {}]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_12e4: (0x8004)!=0 rets immediately; 28 T", () => {
  const m = mk();
  m.mem.workRam[0x004] = 0x01;
  loc_12e4(m);
  assert.equal(m.cycles, 28, "ld a 13 + and a 4 + ret nz taken 11");
  assert.deepEqual(m.calls, []);
});

test("loc_12e4: low nibble <5 short-circuits to arm 0 (ret); 94 T", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0x01; // +0x0f = 0x10, low nibble 0 < 5
  loc_12e4(m);
  assert.equal(m.cycles, 94, "head + jp c,0x132b + jp 0x13e1 + ret");
  assert.equal(r(m, 0x8004), 0x00, "no lane scan, no block flag");
  assert.deepEqual(m.calls, []);
});

test("loc_12e4: a lane hit with the frog across sets (0x8004)=1; 384 T", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0x86; // index 9 (arm 0x1364), and (0x8047) >= 0x80
  m.mem.workRam[0x02f] = 0x00; // < 0x80 -> D from (0x8044)+0x0c
  m.mem.workRam[0x044] = 0x20;
  m.mem.workRam[0x136] = 0x02; // lane object count
  m.mem.workRam[0x137] = 0x30; // object X inside [0x2c, 0x4e)
  loc_12e4(m);
  assert.equal(r(m, 0x8004), 0x01, "move blocked");
  assert.deepEqual(m.calls, [], "no frog-kill on a block");
  assert.equal(m.cycles, 384);
});

test("loc_12e4: no lane hit with the frog not across tail-jumps to the kill entry 0x12D0", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0x46; // index 5 (arm 0x1344), (0x8047) < 0x80
  m.mem.workRam[0x02f] = 0x00;
  m.mem.workRam[0x044] = 0x10;
  m.mem.workRam[0x112] = 0x01; // one lane object
  m.mem.workRam[0x113] = 0x10; // X below the low bound -> no hit
  loc_12e4(m);
  assert.deepEqual(m.calls, [0x12d0], "jp c,0x12d0 tail-jump");
  assert.equal(r(m, 0x8004), 0x00, "no block flag");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_12e4.js
//   find: regs.bc = 0x130b;
//   repl: regs.bc = 0x130c;
//   expect: FAIL  (misaligned table read -> off-table arm pointer -> the switch default throws)
//   verified-anchor: count == 1  (the sole ld bc,0x130b in loc_12e4.js)
test("loc_12e4: the switch guard rejects an off-table arm pointer", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0x86; // dispatches through index 9
  m.mem.rom[0x131d] = 0x99; // corrupt table[9] -> arm pointer 0x9999
  m.mem.rom[0x131e] = 0x99;
  assert.throws(() => loc_12e4(m), /outside the arm table/);
});
