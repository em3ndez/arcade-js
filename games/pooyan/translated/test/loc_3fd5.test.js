// SPDX-License-Identifier: GPL-3.0-only
// Equivalence tests for loc_3fd5. Flat-RAM mock (real Regs); pattern-A/tail delegations use a stub
// that records the target and runs m.ret(). Run: node --test games/pooyan/translated/test/loc_3fd5.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3fd5 } from "../loc_3fd5.js";

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

test("loc_3fd5 below landing row -> C set (still falling); 105 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c03, 0x00); m.mem.write8(0x8c09, 0x08); m.mem.write8(0x8c04, 0x00);
  loc_3fd5(m);
  assert.equal(m.tstates, 105);
  assert.equal(m.mem.read8(0x8c03), 0x08, "(ix+3) advanced by velocity");
  assert.ok(m.regs.fC, "carry set while (ix+4) < 0x1e");
  assert.equal(m.pc, CALLER_RET); assert.equal(m.regs.sp, 0x8780);
});
test("loc_3fd5 at landing row -> C clear (landed)", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c04, 0x1e);
  loc_3fd5(m);
  assert.ok(!m.regs.fC, "carry clear once (ix+4) reaches 0x1e");
});
test("loc_3fd5 MUTATION: add a,(ix+0x09) mis-charged 15T (not 19T)", () => {
  const m = makeMachine(); seat(m);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x3fdb ? 15 : c);
  loc_3fd5(m); assert.equal(105 - m.tstates, 4);
});

