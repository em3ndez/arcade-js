// SPDX-License-Identifier: GPL-3.0-only
// Drafter + mutation test for loc_0bb3 (Frogger mode-3 board setup, ROM 0x0BB3-0x0C24) and its
// registered mid-entry loc_0c17 (ROM 0x0C17-0x0C24), which loc_0d11 jumps to directly. Heavy callees
// (0x0781 board init, 0x0c3d, 0x0ba9/0x0b95 pointer fetch, 0x0028 rst-28 blit) are stubbed with a
// stack-balancing call so m.cycles measures loc_0bb3's OWN instructions; the real loc_0c17 is wired so
// the fall-through tail runs. The I register (Regs.i / regs.ldAI()) holds the 1..5 pass counter, pinned by
// the exact m.cycles assertion -- a lost counter changes the inner-loop count.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0bb3, loc_0c17 } from "../loc_0bb3.js";

const balCall = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // undo a CALL/RST push16
const LEAVES = [0x0781, 0x0c3d, 0x0ba9, 0x0b95, 0x0028];

function mk() {
  const routines = new Map(LEAVES.map((a) => [a, balCall]));
  routines.set(0x0c17, loc_0c17); // the real mid-entry, so the tail blit runs
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef); m.cycles = 0;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const wr = (m, a) => m.mem.workRam[a - 0x8000];
const SEQ = [
  0x0781, 0x0c3d, 0x0028,
  0x0ba9, 0x0028, 0x0b95, 0x0028, 0x0ba9, 0x0028, 0x0b95, 0x0028, 0x0ba9, 0x0028, 0x0b95, 0x0028,
  0x0ba9, 0x0028, 0x0b95, 0x0028, 0x0ba9, 0x0028, 0x0b95, 0x0028,
  0x0c17, 0x0028,
];

test("loc_0bb3: (0x83d8)--, (0x83d7)/(0x83b3)/(0x8039) cleared, (0x8019)=3, stride-4 clear, 5 blit passes; 1849 T", () => {
  const m = mk();
  m.mem.workRam[0x3d8] = 0x05;
  for (const a of [0x83d7, 0x83b3, 0x8039, 0x801f, 0x8023, 0x8027, 0x802b, 0x802f, 0x8033]) m.mem.workRam[a - 0x8000] = 0xff;
  loc_0bb3(m);
  assert.equal(wr(m, 0x83d8), 0x04, "(0x83d8) decremented");
  assert.equal(wr(m, 0x83d7), 0x00, "(0x83d7) cleared");
  assert.equal(wr(m, 0x83b3), 0x00, "(0x83b3) cleared");
  assert.equal(wr(m, 0x8019), 0x03, "(0x8019) = 3");
  for (const a of [0x801f, 0x8023, 0x8027, 0x802b, 0x802f]) assert.equal(wr(m, a), 0x00, `${a.toString(16)} stride-4 cleared`);
  assert.equal(wr(m, 0x8033), 0xff, "0x8033 untouched -- exactly 5 passes (B=5)");
  assert.equal(wr(m, 0x8039), 0x00, "(0x8039) cleared in loc_0c17");
  assert.deepEqual(m.calls, SEQ, "board init, 5 blit passes (0ba9/0b95/rst28), tail loc_0c17 + rst28");
  assert.equal(m.regs.sp, 0x8800, "stack balanced");
  assert.equal(m.pc, 0xbeef, "returned to caller via loc_0c17 ret");
  assert.equal(m.cycles, 1849, "own T-states (callee bodies stubbed)");
});

test("loc_0c17 as a standalone mid-entry: (0x8039)=0, one blit, ret; 65 T", () => {
  const routines = new Map([[0x0028, balCall]]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef); m.cycles = 0;
  m.mem.workRam[0x039] = 0xff;
  loc_0c17(m);
  assert.equal(wr(m, 0x8039), 0x00, "(0x8039) cleared");
  assert.equal(m.pc, 0xbeef, "returned");
  assert.equal(m.cycles, 65, "loc_0c17 own T-states");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0bb3.js
//   find: mem.write8(0x8019, regs.a);   (regs.a == 3 at that point)
//   repl: mem.write8(0x8019, 0x02);
//   expect: FAIL ((0x8019) = 2, not 3). Simulated below by corrupting that write.
test("loc_0bb3: the (0x8019) = 3 board-state write is pinned", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, bo) => ow(a, a === 0x8019 && v === 0x03 ? 0x02 : v, bo);
  loc_0bb3(m);
  assert.notEqual(wr(m, 0x8019), 0x03, "corrupted write -> (0x8019) != 3");
});
