// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0f8c (Frogger frog-anim pre-helper, ROM 0x0F8C-0x0FAE). Leaf, no callees.
// Guarded by (0x8118): when 0 it rets at once; otherwise it blits 8 rows of a 2-byte tile pair from
// the ROM source at 0x1413 down VRAM from 0xA806 (row stride 0x20), then clears (0x8118).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0f8c } from "../loc_0f8c.js";

function mk() {
  const rom = new Uint8Array(0x4000);
  for (let i = 0; i < 16; i++) rom[0x1413 + i] = 0x40 + i; // sample source tile bytes
  const m = new Machine(rom, new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.cycles = 0;
  return m;
}
const wr = (m, a) => m.mem.workRam[a - 0x8000];
const vr = (m, off) => m.mem.videoRam[off];

test("loc_0f8c: (0x8118)==0 rets immediately, no VRAM touched; 28 T", () => {
  const m = mk();
  m.mem.workRam[0x118] = 0x00;
  loc_0f8c(m);
  assert.equal(m.cycles, 28, "ld a,(nn)13 + and a 4 + ret z taken 11");
  assert.equal(m.pc, 0xbeef, "returned");
  assert.equal(m.mem.videoRam.reduce((s, b) => s + b, 0), 0, "VRAM untouched");
});

test("loc_0f8c: (0x8118)!=0 blits 8 rows x 2 bytes at stride 0x20, clears trigger; 943 T", () => {
  const m = mk();
  m.mem.workRam[0x118] = 0x01;
  loc_0f8c(m);
  // 8 rows from 0xa806, each row two bytes at off and off+1, off advancing by 0x20:
  for (let row = 0; row < 8; row++) {
    const off = 0x006 + row * 0x20;
    assert.equal(vr(m, off), 0x40 + row * 2, `row ${row} byte 0`);
    assert.equal(vr(m, off + 1), 0x41 + row * 2, `row ${row} byte 1`);
  }
  assert.equal(vr(m, 0x0e6), 0x4e, "last row byte 0");
  assert.equal(vr(m, 0x0e7), 0x4f, "last row byte 1");
  assert.equal(wr(m, 0x8118), 0x00, "trigger cleared");
  assert.equal(m.cycles, 943, "exact T-states");
  assert.equal(m.pc, 0xbeef, "returned");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0f8c.js
//   find: regs.bc = 0x001f;
//   repl: regs.bc = 0x000f;
//   expect: FAIL (row stride becomes 0x10 not 0x20, so rows 1..7 land at the wrong VRAM offsets)
//   verified-anchor: the sole `regs.bc = 0x001f;` in loc_0f8c.js; applied/ran/reverted.
// Also simulated here without editing the file: force the add-hl advance to 0x0f and confirm row 1
// no longer lands at off 0x026.
test("loc_0f8c: the row-stride contract catches a wrong advance", () => {
  const m = mk();
  m.mem.workRam[0x118] = 0x01;
  const realAddHl = m.regs.addHl.bind(m.regs);
  m.regs.addHl = (v) => realAddHl(v === 0x001f ? 0x000f : v); // the 0x000f mutant's stride
  loc_0f8c(m);
  assert.notEqual(vr(m, 0x026), 0x42, "row 1 no longer at off 0x026 under the wrong stride");
});
