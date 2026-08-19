// SPDX-License-Identifier: GPL-3.0-only
// Equivalence tests for loc_3f7c. Flat-RAM mock (real Regs); pattern-A/tail delegations use a stub
// that records the target and runs m.ret(). Run: node --test games/pooyan/translated/test/loc_3f7c.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3f7c } from "../loc_3f7c.js";
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

// loc_3fd5 is a plain-ret sub; dispatch it to the REAL routine so the ret c decision at 0x3f82 is
// driven by the true carry (still-airborne vs landed), the other calls hit the pattern-A stub.
test("loc_3f7c airborne -> loc_3fd5 sets carry -> ret c; 160 T", () => {
  const m = makeMachine({ 0x3fd5: loc_3fd5 }); seat(m);
  m.mem.write8(0x8c04, 0x00); m.mem.write8(0x8c09, 0x00); // (ix+4)=0 < 0x1e -> C set
  loc_3f7c(m);
  assert.equal(m.tstates, 160);
  assert.deepEqual(m.calls, [0x4006, 0x3fd5]);
  assert.equal(m.pc, CALLER_RET); assert.equal(m.regs.sp, 0x8780);
});
test("loc_3f7c landed, non-special ((ix+0x0b) bit0=0, (0x8901)=0) -> ret z; 393 T", () => {
  const m = makeMachine({ 0x3fd5: loc_3fd5 }); seat(m);
  m.mem.write8(0x8c04, 0x1e); // (ix+4)=0x1e -> loc_3fd5 clears carry -> land
  m.mem.write8(0x8c0b, 0x00); m.mem.write8(0x8901, 0x00);
  loc_3f7c(m);
  assert.equal(m.tstates, 393);
  assert.deepEqual(m.calls, [0x4006, 0x3fd5, 0x0c45, 0x381e, 0x0eda]);
  assert.equal(m.mem.read8(0x8c02), 0x02, "(ix+2) reset to 2");
  assert.equal(m.mem.read8(0x8c11), 0x20, "(ix+0x11) timer reset");
  assert.equal(m.pc, CALLER_RET); assert.equal(m.regs.sp, 0x8780);
});
test("loc_3f7c MUTATION: bit 0,(ix+0x0b) mis-charged 12T (not 20T)", () => {
  const m = makeMachine({ 0x3fd5: loc_3fd5 }); seat(m);
  m.mem.write8(0x8c04, 0x1e); m.mem.write8(0x8c0b, 0x00); m.mem.write8(0x8901, 0x00);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x3fa8 ? 12 : c);
  loc_3f7c(m); assert.equal(393 - m.tstates, 8);
});

