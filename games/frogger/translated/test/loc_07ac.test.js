// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_07ac (Frogger sound-queue consumer, ROM 0x07AC-0x07C0). (0x8300)==0 rets (32 T,
// no call). Otherwise decrement (0x8300), issue the (0x8301) command via loc_0794, and shift the queue
// down one slot (LDIR of the pre-decrement count). loc_0794 is stubbed (SP-balancer; it preserves HL).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_07ac } from "../loc_07ac.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0794, bal]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_07ac: empty queue ((0x8300)==0) rets without a sound call; 32 T", () => {
  const m = mk();
  loc_07ac(m);
  assert.equal(m.cycles, 32, "ld hl 10 + ld a,(hl) 7 + or a 4 + ret z 11");
  assert.deepEqual(m.calls, [], "no sound issued");
});

function checkPlay(m) {
  assert.equal(r(m, 0x8300), 0x02, "(0x8300) decremented 3 -> 2");
  assert.deepEqual(m.calls, [0x0794], "the (0x8301) command was issued");
  assert.equal(r(m, 0x8301), 0xaa, "slot 1 <- slot 2");
  assert.equal(r(m, 0x8302), 0xbb, "slot 2 <- slot 3");
  assert.equal(r(m, 0x8303), 0xcc, "slot 3 <- slot 4");
}

test("loc_07ac: non-empty queue decrements, issues, and shifts down; 156 T", () => {
  const m = mk();
  m.mem.workRam[0x300] = 0x03; m.mem.workRam[0x301] = 0x2a;
  m.mem.workRam[0x302] = 0xaa; m.mem.workRam[0x303] = 0xbb; m.mem.workRam[0x304] = 0xcc;
  loc_07ac(m);
  checkPlay(m);
  assert.equal(m.cycles, 156, "full path incl. LDIR of 3 and the (0-charge) sound stub");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_07ac.js
//   find: regs.decMem8(mem, regs.hl);\n  m.step(0x07b3, 11); // (0x8300)--
//   repl: m.step(0x07b3, 11); // (drop the decrement)
//   expect: FAIL  ((0x8300) stays 3 — caught by checkPlay)
//   verified-anchor: count == 1  (the sole dec (hl) in loc_07ac.js)
test("loc_07ac: the contract catches a dropped head decrement", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.hl = 0x8300; m.step(0x07af, 10);
    regs.a = mem.read8(regs.hl); m.step(0x07b0, 7);
    regs.or(regs.a); m.step(0x07b1, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x07b2, 5);
    m.step(0x07b3, 11); // MUTANT: dec (hl) dropped
    regs.c = regs.a; m.step(0x07b4, 4);
    regs.l = regs.inc8(regs.l); m.step(0x07b5, 4);
    regs.a = mem.read8(regs.hl); m.step(0x07b6, 7);
    m.push16(0x07b9); m.step(0x0794, 17); m.call(0x0794);
    regs.d = regs.h; m.step(0x07ba, 4);
    regs.e = regs.l; m.step(0x07bb, 4);
    regs.l = regs.inc8(regs.l); m.step(0x07bc, 4);
    regs.b = 0x00; m.step(0x07be, 7);
    m.ldirAt(0x07be, 0x07c0);
    m.ret();
  };
  const m = mk();
  m.mem.workRam[0x300] = 0x03; m.mem.workRam[0x301] = 0x2a;
  m.mem.workRam[0x302] = 0xaa; m.mem.workRam[0x303] = 0xbb; m.mem.workRam[0x304] = 0xcc;
  mutant(m);
  assert.throws(() => checkPlay(m));
});
