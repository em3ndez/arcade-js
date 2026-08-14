// SPDX-License-Identifier: GPL-3.0-only
// Drafter + mutation test for loc_0547 (Frogger cold-start new-game init, ROM 0x0547-0x05D2).
// One file, THREE registered entries chained by fall-through: loc_0547 (clear part 1) -> loc_0557
// (part 2, mid-entry from loc_04f3) -> loc_0567 (part 3, mid-entry from loc_0534). Each entry is tested
// on its own with the next entry / heavy callees stubbed, so m.cycles measures that entry's own
// instructions; a final test wires the real siblings to prove the chain.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0547, loc_0557, loc_0567 } from "../loc_0547.js";

const balCall = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // undo a CALL/RST push16
const noop = () => {}; // a tail-jp / fall-through target: nothing to balance
const LEAVES = [0x0038, 0x07e6, 0x0b67, 0x0f69, 0x0b1f, 0x07eb]; // loc_0567's CALL/RST callees

function mk(routines) {
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef); m.cycles = 0;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const wr = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_0547: clears (0x825c) + 0x825e-0x8262, falls into loc_0557; 133 T", () => {
  const m = mk(new Map([[0x0557, noop]]));
  m.mem.workRam[0x25c] = 0xff; m.mem.workRam[0x25e] = 0xff; m.mem.workRam[0x262] = 0xff;
  loc_0547(m);
  assert.equal(wr(m, 0x825c), 0x00, "(0x825c) cleared");
  assert.equal(wr(m, 0x8262), 0x00, "(0x8262) cleared (LDIR count 4)");
  assert.equal(m.cycles, 133, "own T-states");
  assert.deepEqual(m.calls, [0x0557], "falls through to loc_0557");
});

test("loc_0557: clears (0x825d) + 0x8263-0x8267, falls into loc_0567; 133 T", () => {
  const m = mk(new Map([[0x0567, noop]]));
  m.mem.workRam[0x25d] = 0xff; m.mem.workRam[0x263] = 0xff; m.mem.workRam[0x267] = 0xff;
  loc_0557(m);
  assert.equal(wr(m, 0x825d), 0x00, "(0x825d) cleared");
  assert.equal(wr(m, 0x8267), 0x00, "(0x8267) cleared (LDIR count 4)");
  assert.equal(m.cycles, 133, "own T-states");
  assert.deepEqual(m.calls, [0x0567], "falls through to loc_0567");
});

test("loc_0567: RAM/HW cold-start clears, game-mode = 3, flip latches = 0, tail 0x0368; 8855 T", () => {
  const routines = new Map(LEAVES.map((a) => [a, balCall]));
  routines.set(0x0368, noop);
  const m = mk(routines);
  for (const off of [0x100, 0x25f, 0x000, 0x004, 0x00c, 0x03a]) m.mem.workRam[off] = 0xff;
  for (const a of [0x83c3, 0x83fe, 0x83bf, 0x83c9, 0x83ca, 0x83bb, 0x83cb, 0x83d8, 0x83c4, 0x83ba, 0x8295, 0x825b])
    m.mem.workRam[a - 0x8000] = 0xff;
  m.mem.workRam[0x293] = 0xff; m.mem.workRam[0x294] = 0xff;
  m.io.setFlipX(1); m.io.setFlipY(1);
  loc_0567(m);
  assert.equal(wr(m, 0x8100), 0x00, "0x8100 LDIR-cleared");
  assert.equal(wr(m, 0x825f), 0x00, "0x825f end of the 0x15f LDIR");
  assert.equal(wr(m, 0x8000), 0x00, "0x8000 cleared");
  assert.equal(wr(m, 0x8004), 0x00, "0x8004 end of the count-4 LDIR");
  assert.equal(wr(m, 0x800c), 0x00, "0x800c cleared");
  assert.equal(wr(m, 0x803a), 0x00, "0x803a end of the 0x2e LDIR");
  assert.equal(wr(m, 0x83c9), 0x00, "(0x83c9) zeroed");
  assert.equal(wr(m, 0x83ca), 0x00, "(0x83ca) zeroed");
  assert.equal(wr(m, 0x8293), 0x00, "(0x8293) low of 0x0000");
  assert.equal(wr(m, 0x8294), 0x00, "(0x8294) high of 0x0000");
  assert.equal(wr(m, 0x825b), 0x00, "(0x825b) zeroed");
  assert.equal(wr(m, 0x83d6), 0x03, "(0x83d6) = 3 game mode");
  assert.equal(m.io.flipX, 0, "flip_x cleared");
  assert.equal(m.io.flipY, 0, "flip_y cleared");
  assert.equal(m.cycles, 8855, "own T-states");
  assert.deepEqual(m.calls, [0x0038, 0x07e6, 0x0b67, 0x0f69, 0x0b1f, 0x07eb, 0x0368],
    "screen-clear, 4 init callees, force-clear, tail 0x0368");
});

test("loc_0547 -> loc_0557 -> loc_0567 real chain: full clear, game-mode = 3; 133+133+8855 T", () => {
  const routines = new Map(LEAVES.map((a) => [a, balCall]));
  routines.set(0x0557, loc_0557); routines.set(0x0567, loc_0567); routines.set(0x0368, noop);
  const m = mk(routines);
  m.mem.workRam[0x25c] = 0xff; m.mem.workRam[0x25d] = 0xff; m.mem.workRam[0x100] = 0xff;
  loc_0547(m);
  assert.equal(wr(m, 0x825c), 0x00, "part-1 clear");
  assert.equal(wr(m, 0x825d), 0x00, "part-2 clear");
  assert.equal(wr(m, 0x8100), 0x00, "part-3 LDIR clear");
  assert.equal(wr(m, 0x83d6), 0x03, "part-3 game-mode set");
  assert.equal(m.cycles, 133 + 133 + 8855, "whole-chain own T-states");
  assert.deepEqual(m.calls, [0x0557, 0x0567, 0x0038, 0x07e6, 0x0b67, 0x0f69, 0x0b1f, 0x07eb, 0x0368]);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0547.js
//   find: regs.a = 0x03;   (loc_0567, before the (0x83d6) write)
//   repl: regs.a = 0x02;
//   expect: FAIL ((0x83d6) game mode set to 2, not 3)
//   verified-anchor: the sole `regs.a = 0x03` in loc_0547.js. Simulated by corrupting the write value.
test("loc_0567: the (0x83d6) game-mode value is pinned", () => {
  const routines = new Map(LEAVES.map((a) => [a, balCall]));
  routines.set(0x0368, noop);
  const m = mk(routines);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, bo) => ow(a, a === 0x83d6 && v === 0x03 ? 0x02 : v, bo);
  loc_0567(m);
  assert.notEqual(wr(m, 0x83d6), 0x03, "wrong value -> game mode != 3");
});
