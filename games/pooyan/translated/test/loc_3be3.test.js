// SPDX-License-Identifier: GPL-3.0-only
// Equivalence tests for loc_3be3 (ROM 0x3be3-0x3c91), object state-0 handler. Flat-RAM mock.
// call 0x4006 / call 0x3553 are pattern-A (stub records + m.ret()).
// Run: node --test games/pooyan/translated/test/loc_3be3.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3be3 } from "../loc_3be3.js";

const CALLER_RET = 0xabcd;
function makeMachine() {
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
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); m.regs.ix = 0x8c00; }

test("loc_3be3 free-run, not yet at 0x1f -> ret c; 164 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c08, 0x00); // (ix+8) bit0 clear -> free-run
  m.mem.write8(0x8c05, 0x00); m.mem.write8(0x8c09, 0x00); // no carry
  m.mem.write8(0x8c06, 0x00); // (ix+6) = 0 < 0x1f -> ret c
  loc_3be3(m);
  assert.equal(m.tstates, 164, "free-run early-out total");
  assert.deepEqual(m.calls, [0x4006], "only the timer tick");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_3be3 homing branch (bit0 set) -> ret nz at 0x3c3a; 305 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c08, 0x01); // (ix+8) bit0 set -> homing
  m.mem.write8(0x8c0a, 0x00); // velocity 0 -> neg 0, b=0
  m.mem.write8(0x8c05, 0x10); // (ix+5) >= b -> skip dec (ix+6)
  m.mem.write8(0x8c14, 0x00); m.mem.write8(0x8c15, 0x8c); // linked record IY = 0x8c00
  m.mem.write8(0x8c06, 0x05); // (ix+6)&0x1f != 0 -> ret nz
  loc_3be3(m);
  assert.equal(m.tstates, 305, "homing path total");
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8c05), 0x10, "(ix+5) advanced by velocity");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (push hl / pop iy)");
});

test("loc_3be3 MUTATION: bit 0,(ix+8) mis-charged 12T (not 20T) is caught", () => {
  const m = makeMachine(); seat(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3bea ? 12 : c); // 0x3bea = landing after bit 0,(ix+8)
  loc_3be3(m);
  assert.notEqual(m.tstates, 164, "golden total catches the 8T undercharge");
});
