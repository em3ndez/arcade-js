// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_71ce (ROM 0x71ce-0x7286): the eagle/arrow approach state machine. Pins
// the (0x8f36)-hold entry gate and the 0x71e3 flag-update block (eagle X below the 0x60 threshold).
//
// Run: node --test games/pooyan/translated/test/loc_71ce.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_71ce } from "../loc_71ce.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_71ce hold: (0x8f36)!=0 -> dec, ret; 49 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f36, 0x05);

  loc_71ce(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 7 + 11 + 10, "49 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8f36), 0x04, "hold ticked");
  assert.deepEqual(m.pcSeq, [0x71d1, 0x71d2, 0x71d3, 0x71d5, 0x71d6, CALLER_RET], "boundaries");
});

test("loc_71ce 71e3 block: eagle X < 0x60 -> res2/set3 of (0x8a87), ret; 176 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f36, 0x00); // no hold
  m.mem.write8(0x8c90, 0x00);
  m.mem.write8(0x8a99, 0x00); // or -> 0 -> fall into 0x71e3
  m.mem.write8(0x8f5b, 0x00); // not latched
  m.mem.write8(0x8a84, 0x50); // eagle X < 0x60
  m.mem.write8(0x8a87, 0x00);

  loc_71ce(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 12 + 10 + 13 + 7 + 10 + 7 + 13 + 4 + 7 + 13 + 7 + 12 + 15 + 15 + 10, "176 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8a87), 0x08, "bit3 set, bit2 clear");
  assert.deepEqual(m.calls, [], "no delegate on this path");
  assert.deepEqual(m.pcSeq,
    [0x71d1, 0x71d2, 0x71d3, 0x71d7, 0x71da, 0x71dd, 0x71de, 0x71e1, 0x71e3, 0x71e6, 0x71e7,
     0x71e9, 0x71ec, 0x71ee, 0x71f3, 0x71f5, 0x71f7, CALLER_RET], "boundaries");
});

test("loc_71ce MUTATION: set 3,(hl) at 0x71f5 mischarged 8T (not 15T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a84, 0x50);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x71f7 ? 8 : c);
  loc_71ce(m);
  assert.notEqual(m.tstates, 176, "golden 176 T catches the mischarge");
});
