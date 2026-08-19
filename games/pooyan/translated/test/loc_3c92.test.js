// SPDX-License-Identifier: GPL-3.0-only
// Equivalence tests for loc_3c92 (ROM 0x3c92-0x3cad, state-1 handler) driving loc_3cae
// (0x3cae-0x3d0e, the CALLER-SKIP spawn helper). Flat-RAM mock. m.call runs the REAL loc_3cae so the
// boolean caller-skip protocol (true=scan continues, false=abort to loc_3c92's caller) is exercised
// end-to-end; the leaf helpers (0x4006/0x381e/0x403c) hit the pattern-A stub.
// Run: node --test games/pooyan/translated/test/loc_3c92.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3c92 } from "../loc_3c92.js";
import { loc_3cae } from "../loc_3cae.js";

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
    call(addr) { this.calls.push(addr); if (addr === 0x3cae) return loc_3cae(this); this.ret(); return undefined; },
  };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); m.regs.ix = 0x8c00; }

test("loc_3c92 timer not elapsed -> dec (ix+0x11), ret nz; 61 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c11, 0x02); // (ix+0x11) = 2 -> dec to 1, ret nz
  loc_3c92(m);
  assert.equal(m.tstates, 61, "call(27)+dec(23)+ret nz(11)");
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(0x8c11), 0x01, "(ix+0x11) decremented");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_3c92 all 4 slots occupied -> loop completes, reseed timer; 502 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c11, 0x01); // elapses this frame
  for (let i = 0; i < 4; i++) m.mem.write8(0x8c30 + i * 0x18, 0x01); // (iy+0)!=0 -> occupied
  loc_3c92(m);
  assert.equal(m.tstates, 502, "full 4-record scan, no launch");
  assert.deepEqual(m.calls, [0x4006, 0x3cae, 0x3cae, 0x3cae, 0x3cae], "loc_3cae per record");
  assert.equal(m.mem.read8(0x8c11), 0x10, "timer reseeded to 0x10");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack balanced across 4 caller-skip-capable calls");
});

test("loc_3c92 first slot free -> loc_3cae launches + CALLER-SKIP aborts the scan", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c11, 0x01);   // elapses
  // 0x8c30 record left zero -> free; loc_3cae seats a child there and caller-skips
  loc_3c92(m);
  assert.deepEqual(m.calls, [0x4006, 0x3cae, 0x381e, 0x403c], "one loc_3cae launch, no further records");
  assert.equal(m.mem.read8(0x8c31), 0x01, "child (iy+1) marked active");
  assert.equal(m.mem.read8(0x8c02), 0x06, "parent (ix+2) -> state 6");
  assert.equal(m.pc, CALLER_RET, "caller-skip returns to loc_3c92's caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (pop af drops the in-loop return)");
});

test("loc_3c92 MUTATION: add iy,de mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c11, 0x01);
  for (let i = 0; i < 4; i++) m.mem.write8(0x8c30 + i * 0x18, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3ca7 ? 11 : c); // 0x3ca7 = landing after add iy,de
  loc_3c92(m);
  assert.notEqual(m.tstates, 502, "golden total catches the add iy,de undercharge (4x4T)");
  assert.equal(m.tstates, 486);
});
