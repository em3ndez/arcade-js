// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_25ce (Frogger board/home-marker reset, ROM 0x25CE-0x2672): dispatch on (0x8121)
// 1..5; each arm gates on its timer/flag pair and, when clear, stamps tile 0x10 into that slot's 2x2 home
// cell (top pair + the row 0x1F below) and clears (0x8121)/(0x8120). Leaf routine, no external callees.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_25ce } from "../loc_25ce.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const r = (m, a) => m.mem.read8(a);

test("loc_25ce: slot-1 arm clears -> stamps the 2x2 cell at 0xab64 + clears selector; 235 T", () => {
  const m = mk();
  m.mem.workRam[0x83fd - 0x8000] = 0x01; // (0x83fd) -> C, dec c hits zero on slot 1
  m.mem.workRam[0x8121 - 0x8000] = 0x01; // selector = 1
  m.mem.workRam[0x825e - 0x8000] = 0x00; // slot-1 timer clear -> stamp
  m.mem.workRam[0x8004 - 0x8000] = 0x00; // final gate clear -> reset selector
  loc_25ce(m);
  assert.equal(r(m, 0xab64), 0x10, "top-left home tile");
  assert.equal(r(m, 0xab65), 0x10, "top-right");
  assert.equal(r(m, 0xab84), 0x10, "bottom-left (row +0x1f)");
  assert.equal(r(m, 0xab85), 0x10, "bottom-right");
  assert.equal(r(m, 0x8121), 0x00, "selector cleared");
  assert.equal(r(m, 0x8120), 0x00, "sub-selector cleared");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.equal(m.cycles, 235, "dispatch 47 + arm 33 + set-hl 20 + tail 135");
});

test("loc_25ce: selector 0 matches no arm -> immediate ret, no VRAM touched; 125 T", () => {
  const m = mk();
  m.mem.workRam[0x8121 - 0x8000] = 0x00;
  loc_25ce(m);
  for (const a of [0xab64, 0xaaa4, 0xa9e4, 0xa924, 0xa864]) assert.equal(r(m, a), 0x00, "untouched");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.equal(m.cycles, 125, "13 cp/jp probes + ret");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_25ce.js
//   find: mem.write8(0x8120, regs.a);
//   repl: mem.write8(0x8120, 0x01);
//   expect: FAIL  ((0x8120) ends 0x01, not the cleared 0x00 -- caught by the check below)
//   verified-anchor: count == 1  (the sole store to 0x8120 in loc_25ce.js)
// Simulated by intercepting the store to 0x8120 and forcing 0x01, which is what the edit produces.
test("loc_25ce: the contract catches a failure to clear the sub-selector", () => {
  const m = mk();
  m.mem.workRam[0x83fd - 0x8000] = 0x01;
  m.mem.workRam[0x8121 - 0x8000] = 0x01;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x8120 ? 0x01 : v, o);
  loc_25ce(m);
  assert.throws(() => assert.equal(r(m, 0x8120), 0x00));
});
