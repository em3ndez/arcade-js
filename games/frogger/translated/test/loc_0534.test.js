// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0534 (Frogger clear-P1 pre-block, ROM 0x0534-0x0546): zeroes (0x825C) and the
// 0x825E-0x8262 table, then tail jp into the cold-start mid-entry 0x0567 (owned by loc_0547.js).
// Test 1 stubs 0x0567 for loc_0534's own contract; test 2 wires the REAL loc_0567 to prove the chain.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0534 } from "../loc_0534.js";
import { loc_0567 } from "../loc_0547.js";

const balCall = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // undo a CALL/RST push16
const noop = () => {}; // a tail-jp target: nothing to balance

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

test("loc_0534: clears (0x825c) + 0x825e-0x8262, tail jp to mid-entry 0x0567; 143 T", () => {
  const m = mk(new Map([[0x0567, noop]]));
  m.mem.workRam[0x25c] = 0xff; m.mem.workRam[0x25e] = 0xff; m.mem.workRam[0x262] = 0xff;
  loc_0534(m);
  assert.equal(wr(m, 0x825c), 0x00, "(0x825c) cleared");
  assert.equal(wr(m, 0x825e), 0x00, "(0x825e) seed cleared");
  assert.equal(wr(m, 0x8262), 0x00, "(0x8262) cleared (LDIR count 4)");
  assert.equal(m.cycles, 143, "own T-states");
  assert.deepEqual(m.calls, [0x0567], "tail jp to 0x0567");
});

test("loc_0534 -> real loc_0567: chain reaches game-mode set + flip clear; 143+8855 T", () => {
  const routines = new Map([0x0038, 0x07e6, 0x0b67, 0x0f69, 0x0b1f, 0x07eb].map((a) => [a, balCall]));
  routines.set(0x0567, loc_0567); routines.set(0x0368, noop);
  const m = mk(routines);
  loc_0534(m);
  assert.equal(wr(m, 0x825c), 0x00, "loc_0534's clear persists");
  assert.equal(wr(m, 0x83d6), 0x03, "loc_0567 set the game-mode byte");
  assert.equal(m.io.flipX, 0, "loc_0567 cleared flip_x");
  assert.equal(m.io.flipY, 0, "loc_0567 cleared flip_y");
  assert.equal(m.cycles, 143 + 8855, "loc_0534 + loc_0567 own T-states");
  assert.deepEqual(m.calls, [0x0567, 0x0038, 0x07e6, 0x0b67, 0x0f69, 0x0b1f, 0x07eb, 0x0368]);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0534.js
//   find: mem.write8(0x825c, regs.a);
//   repl: mem.write8(0x825d, regs.a);
//   expect: FAIL (clears the wrong cell -> (0x825c) stays 0xff)
//   verified-anchor: the sole (0x825c) write in loc_0534.js. Simulated by redirecting the write.
test("loc_0534: the (0x825c) clear address is pinned", () => {
  const m = mk(new Map([[0x0567, noop]]));
  m.mem.workRam[0x25c] = 0xff;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, bo) => ow(a === 0x825c ? 0x825d : a, v, bo);
  loc_0534(m);
  assert.notEqual(wr(m, 0x825c), 0x00, "wrong address -> (0x825c) not cleared");
});
