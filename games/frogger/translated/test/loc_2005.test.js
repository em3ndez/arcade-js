// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2005 (Frogger NMI object-scroll driver, ROM 0x2005-0x20BE). All four callees
// (loc_20fb/loc_219c wrap handlers, copy engine 0x20cc + its 2nd entry 0x20bf) are stubbed by one
// SP-balancer: each ends in ret, so each pops one return — covering the calls AND the tail-jump's ret.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2005 } from "../loc_2005.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const stubs = new Map([[0x20fb, bal], [0x219c, bal], [0x20cc, bal], [0x20bf, bal]]);
  const m = new Machine(new Uint8Array(0x4000), stubs);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  // The two IX objects: (0x8273)+2 = 0x30 and (0x827c)+2 = 0x40 are the bytes the driver copies.
  m.mem.write8(0x8273, 0x01); m.mem.write8(0x8274, 0x02); m.mem.write8(0x8275, 0x30);
  m.mem.write8(0x827c, 0x55); m.mem.write8(0x827d, 0x06); m.mem.write8(0x827e, 0x40);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.read8(a);

test("loc_2005: no wrap, no phase hit — copies + counter bumps, then ret; 281 T; no calls", () => {
  const m = mk();
  m.mem.write8(0x8110, 0x10); // -> 0x11, below 0x50 -> loc_20fb NOT called
  m.mem.write8(0x8111, 0xa0); // -> 0xa2, not below 0xa0 -> loc_219c NOT called
  m.mem.write8(0x826e, 0x00); // -> 0x01, no phase arm -> ret
  loc_2005(m);
  assert.equal(r(m, 0x811a), 0x30, "(0x811a) = (0x8275)");
  assert.equal(r(m, 0x8119), 0x40, "(0x8119) = (0x827e)");
  assert.equal(r(m, 0x8110), 0x11, "(0x8110) += 1");
  assert.equal(r(m, 0x8111), 0xa2, "(0x8111) += 2");
  assert.equal(r(m, 0x826e), 0x01, "(0x826e) += 1");
  assert.deepEqual(m.calls, [], "neither wrap handler ran");
  assert.equal(m.cycles, 281, "both conditional calls not taken, ret");
  assert.equal(m.regs.sp, 0x8800, "stack balanced by the ret");
});

test("loc_2005: both wrap handlers fire, no phase hit; 295 T", () => {
  const m = mk();
  m.mem.write8(0x8110, 0x5f); // -> 0x60 >= 0x50 -> call nc,loc_20fb
  m.mem.write8(0x8111, 0x00); // -> 0x02 < 0xa0 -> call c,loc_219c
  m.mem.write8(0x826e, 0x00); // -> 0x01, no phase arm
  loc_2005(m);
  assert.deepEqual(m.calls, [0x20fb, 0x219c], "both wrap handlers, in order");
  assert.equal(m.cycles, 295, "both conditional calls taken (17 T each)");
  assert.equal(m.regs.sp, 0x8800, "stubs balanced each call, ret balanced the frame");
});

test("loc_2005: phase 0x10 runs the lane block — calls 0x20cc then tail-jumps 0x20bf; 404 T", () => {
  const m = mk();
  m.mem.write8(0x8110, 0x10); // no wrap call
  m.mem.write8(0x8111, 0xa0); // no wrap call
  m.mem.write8(0x826e, 0x0f); // -> 0x10 -> block_2049
  loc_2005(m);
  assert.deepEqual(m.calls, [0x20cc, 0x20bf], "copy engine then its 2nd entry");
  assert.equal(r(m, 0x81b1), 0x55, "(0x81b1) left holding (0x827c) — the block's last write");
  assert.equal(r(m, 0x826e), 0x10, "phase advanced to 0x10");
  assert.equal(m.cycles, 404, "prologue + block_2049");
  assert.equal(m.regs.sp, 0x8800, "0x20cc call + 0x20bf ret both balanced by the stub");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2005.js
//   find: mem.write8(0x8119, regs.a);
//   repl: mem.write8(0x8118, regs.a);
//   expect: FAIL ((0x8119) stays 0 and 0x8118 is written instead — caught by the (0x8119) check)
//   verified-anchor: count == 1 (the sole write8 to 0x8119 in loc_2005.js; the blocks only read it)
// Simulated by redirecting the 0x8119 store to 0x8118, which is what that edit produces.
test("loc_2005: the contract catches the (0x827e)->(0x8119) copy landing wrong", () => {
  const m = mk();
  m.mem.write8(0x8110, 0x10);
  m.mem.write8(0x8111, 0xa0);
  m.mem.write8(0x826e, 0x00);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a === 0x8119 ? 0x8118 : a, v, o);
  loc_2005(m);
  assert.notEqual(r(m, 0x8119), 0x40, "the copy no longer reaches (0x8119)");
});
