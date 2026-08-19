// SPDX-License-Identifier: GPL-3.0-only
// Equivalence tests for loc_3d18. Flat-RAM mock (real Regs); pattern-A/tail delegations use a stub
// that records the target and runs m.ret(). Run: node --test games/pooyan/translated/test/loc_3d18.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3d18 } from "../loc_3d18.js";

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

test("loc_3d18 (0x8d45)=0 -> reseed+anim, fall through to loc_3d5c; 207 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8d45, 0x00); m.mem.write8(0x8c07, 0x00);
  loc_3d18(m);
  assert.equal(m.tstates, 207);
  assert.deepEqual(m.calls, [0x0c45, 0x381e, 0x3d5c]);
  assert.equal(m.mem.read8(0x8c11), 0x20, "(ix+0x11) timer = 0x20 (b default)");
  assert.equal(m.pc, CALLER_RET); assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.pcSeq, [0x3d1a,0x3d1d,0x3d20,0x3d21,0x3d3b,0x3d3e,0x3d3f,0x3d43,0x3d50,0x3d53,0x0c45,0x3d56,0x381e,0x3d59,0x3d5c,CALLER_RET]);
});
test("loc_3d18 MUTATION: bit 1,(ix+7) mis-charged 12T (not 20T)", () => {
  const m = makeMachine(); seat(m); m.mem.write8(0x8d45, 0x00);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x3d43 ? 12 : c);
  loc_3d18(m); assert.equal(207 - m.tstates, 8);
});

