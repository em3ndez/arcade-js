// SPDX-License-Identifier: GPL-3.0-only
// Equivalence tests for loc_3e69. Flat-RAM mock (real Regs); pattern-A/tail delegations use a stub
// that records the target and runs m.ret(). Run: node --test games/pooyan/translated/test/loc_3e69.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3e69 } from "../loc_3e69.js";

const CALLER_RET = 0xabcd;
function makeMachine(dispatch) {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); if (dispatch && dispatch[addr]) return dispatch[addr](this); this.ret(); return undefined; },
  };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); m.regs.ix = 0x8c00; }

test("loc_3e69 timer elapses, valid descriptor -> seed + fall through to loc_3e9c; 291 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c11, 0x01);
  m.mem.write8(0x8c14, 0x00); m.mem.write8(0x8c15, 0x8d); // linked record HL = 0x8d00
  m.mem.write8(0x8d02, 0x05); // descriptor type in [0x05,0x06]
  m.mem.write8(0x8d04, 0x11); // becomes (ix+4) after dec -> 0x10
  loc_3e69(m);
  assert.equal(m.tstates, 291);
  assert.deepEqual(m.calls, [0x3e9c]);
  assert.equal(m.mem.read8(0x8c04), 0x10, "(ix+4) = descriptor byte - 1");
  assert.equal(m.mem.read8(0x8c15), 0x00, "(ix+0x15) cleared");
  assert.equal(m.pc, CALLER_RET); assert.equal(m.regs.sp, 0x8780);
});
test("loc_3e69 timer not elapsed -> ret nz; 34 T", () => {
  const m = makeMachine(); seat(m); m.mem.write8(0x8c11, 0x02);
  loc_3e69(m);
  assert.equal(m.tstates, 34); assert.deepEqual(m.calls, []); assert.equal(m.pc, CALLER_RET);
});
test("loc_3e69 MUTATION: dec (ix+0x11) mis-charged 19T (not 23T)", () => {
  const m = makeMachine(); seat(m); m.mem.write8(0x8c11, 0x01);
  m.mem.write8(0x8c15, 0x8d); m.mem.write8(0x8d02, 0x05);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x3e6c ? 19 : c);
  loc_3e69(m); assert.equal(291 - m.tstates, 4);
});

