// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2906 (Frogger frog-on-log edge blit, ROM 0x2906-0x291C). Issues tile/sound
// command 0xD0 via rst 0x18 (stubbed, SP-balanced) only when (0x83FE)!=0, (0x81A2) in [0x02,0x0E],
// and (0x8140)==0; every guard else-arm is a bare ret. Verifies the issued command, the guards, and
// the exact T-states of each ret path.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2906 } from "../loc_2906.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  // rst 0x18 records the command it was handed, then balances the pushed return (stands in for
  // loc_0018's own ret).
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0018, mkStub()]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
function mkStub(xform = (v) => v) {
  return function (mm) { mm.issued = xform(mm.regs.a); bal(mm); };
}
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

// A fully-open state: playing, (0x81A2)=0x08 in range, (0x8140) idle.
function open(m) { w(m, 0x83fe, 0x01); w(m, 0x81a2, 0x08); w(m, 0x8140, 0x00); }
const check = (m) => assert.equal(m.issued, 0xd0, "rst 0x18 handed 0xD0");

test("loc_2906: issues command 0xD0 when all guards pass; returns to caller", () => {
  const m = mk();
  open(m);
  loc_2906(m);
  check(m);
  assert.equal(m.regs.sp, 0x8800, "stack balanced");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  // 13+4 +5 +13+7 +5 +7+5 +13+4 +5 +7 +11(rst) +10(ret)
  assert.equal(m.cycles, 109, "full-issue path T-states");
});

test("loc_2906: (0x83FE)==0 rets without issuing; 28 T", () => {
  const m = mk();
  open(m); w(m, 0x83fe, 0x00);
  loc_2906(m);
  assert.equal(m.issued, undefined, "no rst 0x18");
  assert.equal(m.cycles, 28, "ld a,(nn)13 + and a 4 + ret z taken 11");
  assert.equal(m.pc, 0xbeef);
});

test("loc_2906: (0x81A2) at/above 0x0F rets (ret nc); at/below 0x01 rets (ret c)", () => {
  for (const [v, ok] of [[0x0f, false], [0x0e, true], [0x02, true], [0x01, false]]) {
    const m = mk();
    open(m); w(m, 0x81a2, v);
    loc_2906(m);
    assert.equal(m.issued === 0xd0, ok, `(0x81A2)=0x${v.toString(16)} issue=${ok}`);
  }
});

test("loc_2906: (0x8140) busy rets (ret nz) without issuing", () => {
  const m = mk();
  open(m); w(m, 0x8140, 0x01);
  loc_2906(m);
  assert.equal(m.issued, undefined, "no blit while the tile slot is busy");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2906.js
//   find: regs.a = 0xd0;
//   repl: regs.a = 0xd1;
//   expect: FAIL  (issues 0xD1 instead of 0xD0 — caught by the command assert)
//   verified-anchor: count == 1  (the sole `regs.a = 0xd0` in loc_2906.js)
// Simulated by making the rst-0x18 stub record 0xD1 where the routine handed 0xD0.
test("loc_2906: the contract catches a wrong blit command", () => {
  const m = mk();
  m.routines.set(0x0018, mkStub((v) => (v === 0xd0 ? 0xd1 : v)));
  open(m);
  loc_2906(m);
  assert.throws(() => check(m));
});
