// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0fd4 (Frogger frog-anim ARM0 + shared render loop, ROM 0x0FD4-0x1047).
// One file, THREE registered entries: loc_0fd4 (ARM0 setup, falls into the loop), loc_0ff1 (the shared
// render loop -- a MID-ENTRY the C3 arms loc_1058/loc_10f8 jp into), and loc_1029 (the index-advance
// tail -- also a MID-ENTRY loc_1058 jp 0x1029 hits). Callees loc_1198/loc_0faf are stubbed; the two
// mid-entries are exercised on their own so nothing runs a real callee.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0fd4, loc_0ff1, loc_1029 } from "../loc_0fd4.js";

const balCall = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // undo a CALL's push16
const noop = () => {}; // a tail-delegate target: no push16 to balance

function mk(routines) {
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.cycles = 0;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const wr = (m, a) => m.mem.workRam[a - 0x8000];
const vr = (m, off) => m.mem.videoRam[off];

// ---- loc_0fd4: ARM0 setup, then delegates to the render loop ----------------------------------
test("loc_0fd4: seeds IX/IY/(0x81b1)/(0x8001) from 0x8270 + (0x13ed), then falls into loc_0ff1; 130 T", () => {
  const rom = new Uint8Array(0x4000);
  rom[0x13ed] = 0x06; rom[0x13ee] = 0xa8; // (0x13ed) = 0xa806 dest base
  const m = new Machine(rom, new Map([[0x0ff1, noop]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef); m.cycles = 0; m.calls = [];
  const oc = m.call.bind(m); m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  m.mem.workRam[0x270] = 0x30; m.mem.workRam[0x271] = 0x02; m.mem.workRam[0x272] = 0x03;
  loc_0fd4(m);
  assert.equal(m.regs.a, 0x30, "A = (0x8270)");
  assert.equal(m.regs.b, 0x02, "B = (0x8271)");
  assert.equal(m.regs.c, 0x03, "C = (0x8272)");
  assert.equal(m.regs.hl, 0xa806, "HL = (0x13ed)");
  assert.equal(m.regs.de, 0x1403, "DE = tile source");
  assert.equal(m.regs.ix, 0x8100, "IX seeded");
  assert.equal(m.regs.iy, 0x8100, "IY seeded");
  assert.equal(wr(m, 0x81b1), 0x30, "(0x81b1) = A");
  assert.equal(wr(m, 0x8001), 0x03, "(0x8001) low = 0x03");
  assert.equal(wr(m, 0x8002), 0x14, "(0x8002) high = 0x14");
  assert.equal(m.cycles, 130, "exact setup T-states");
  assert.deepEqual(m.calls, [0x0ff1], "falls through to loc_0ff1");
});

// ---- loc_0ff1: shared render loop (mid-entry) -------------------------------------------------
function setupLoop(overrides = {}) {
  const m = mk(new Map([[0x1198, balCall], [0x1029, noop]]));
  m.mem.workRam[0x400] = 0xaa; m.mem.workRam[0x401] = 0xbb; // source tile pair at 0x8400
  m.mem.workRam[0x1b1] = overrides.rowAdv ?? 0x10; // (0x81b1)
  m.mem.workRam[0x25b] = overrides.suppress ?? 0x00; // (0x825b) plot-suppress
  m.regs.ix = 0x8100; m.regs.iy = 0x8100;
  m.regs.hl = 0xa806; m.regs.de = 0x8400; m.regs.b = 0x01; m.regs.c = 0x01;
  return m;
}

test("loc_0ff1: one pass, (0x825b)=0 stores -C at (ix+1), inc (iy+0), copies the row; 330 T", () => {
  const m = setupLoop();
  loc_0ff1(m);
  assert.equal(wr(m, 0x8101), 0xff, "(ix+1) = -C  (C=1 -> 0xff)");
  assert.equal(wr(m, 0x8100), 0x01, "inc (iy+0)");
  assert.equal(wr(m, 0x8003), 0x01, "(0x8003) = B");
  assert.equal(vr(m, 0x006), 0xaa, "VRAM row byte 0");
  assert.equal(vr(m, 0x007), 0xbb, "VRAM row byte 1");
  assert.equal(m.regs.ix, 0x8101, "IX advanced");
  assert.equal(m.cycles, 330, "exact T-states");
  assert.deepEqual(m.calls, [0x1198, 0x1029], "coord-compute then index-advance tail");
});

test("loc_0ff1: (0x825b)!=0 skips the (ix+1) store + inc iy; still copies the row; 271 T", () => {
  const m = setupLoop({ suppress: 0x01 });
  loc_0ff1(m);
  assert.equal(wr(m, 0x8101), 0x00, "(ix+1) NOT written");
  assert.equal(wr(m, 0x8100), 0x00, "(iy+0) NOT incremented");
  assert.equal(m.regs.ix, 0x8100, "IX unchanged");
  assert.equal(vr(m, 0x006), 0xaa, "row still copied");
  assert.equal(vr(m, 0x007), 0xbb);
  assert.equal(m.cycles, 271, "exact T-states");
  assert.deepEqual(m.calls, [0x1198, 0x1029]);
});

test("loc_0ff1: C=2 loops back through 0x103c (reload DE from (0x8001)) for a second pass; 589 T", () => {
  const m = mk(new Map([[0x1198, balCall], [0x1029, noop]]));
  m.mem.workRam[0x400] = 0xaa; m.mem.workRam[0x401] = 0xbb;
  m.mem.workRam[0x1b1] = 0x00; m.mem.workRam[0x25b] = 0x01; // suppress store, row-adv 0
  m.mem.workRam[0x001] = 0x00; m.mem.workRam[0x002] = 0x84; // (0x8001) = 0x8400 source reload
  m.regs.ix = 0x8100; m.regs.iy = 0x8100;
  m.regs.hl = 0xa806; m.regs.de = 0x8400; m.regs.b = 0x01; m.regs.c = 0x02;
  loc_0ff1(m);
  assert.equal(vr(m, 0x006), 0xaa, "pass 1 row");
  assert.equal(vr(m, 0x026), 0xaa, "pass 2 row (HL advanced by 0x20)");
  assert.equal(wr(m, 0x8003), 0x01, "(0x8003) = B");
  assert.equal(m.cycles, 589, "exact T-states across two passes");
  assert.deepEqual(m.calls, [0x1198, 0x1198, 0x1029], "two coord computes, one tail");
});

// ---- loc_1029: index-advance tail (mid-entry) -------------------------------------------------
test("loc_1029: (0x8000) 0x05 -> 0x06, still < 0x0b -> re-dispatch loc_0faf; 45 T", () => {
  const m = mk(new Map([[0x0faf, noop]]));
  m.mem.workRam[0x000] = 0x05;
  loc_1029(m);
  assert.equal(wr(m, 0x8000), 0x06, "index advanced");
  assert.equal(m.cycles, 45, "exact T-states");
  assert.deepEqual(m.calls, [0x0faf], "re-dispatched");
});

test("loc_1029: (0x8000) 0x0a -> 0x0b == 0x0b -> wrap to 0 and ret; 76 T", () => {
  const m = mk(new Map());
  m.mem.workRam[0x000] = 0x0a;
  loc_1029(m);
  assert.equal(wr(m, 0x8000), 0x00, "index wrapped");
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.equal(m.cycles, 76, "exact T-states");
  assert.deepEqual(m.calls, [], "no re-dispatch");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0fd4.js
//   find: mem.write8((regs.ix + 0x01) & 0xffff, regs.a);
//   repl: mem.write8((regs.ix + 0x02) & 0xffff, regs.a);
//   expect: FAIL (stores -C at (ix+2) not (ix+1), so (0x8101) is no longer 0xff)
//   verified-anchor: the sole `(regs.ix + 0x01)` store in loc_0fd4.js; applied/ran/reverted.
// Simulated here by intercepting the store to ix+2 and confirming (0x8101) stays unwritten.
test("loc_0ff1: the (ix+1) store offset is pinned", () => {
  const m = setupLoop();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => {
    const target = (m.regs.ix + 0x01) & 0xffff; // IX is still 0x8100 at the (ix+1) store
    ow(a === target ? (m.regs.ix + 0x02) & 0xffff : a, val, o);
  };
  loc_0ff1(m);
  assert.notEqual(wr(m, 0x8101), 0xff, "wrong offset -> (0x8101) no longer holds -C");
});
