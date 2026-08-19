// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6f2d (ROM 0x6f2d-0x6f3d): per-record state handler. Pins the state<0x0d
// mover path (state 0 -> sub 0x0b borrows -> run 0x4006, ret). loc_4006 is a plain-ret callee.
//
// Run: node --test games/pooyan/translated/test/loc_6f2d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6f2d } from "../loc_6f2d.js";

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
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_6f2d state 0: mover 0x4006 then ret; 87 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b02, 0x00); // (ix+2) = 0 -> not state 2, sub 0x0b borrows -> mover path

  loc_6f2d(m);

  assert.equal(m.tstates, 19 + 7 + 10 + 7 + 7 + 17 + 10 + 10, "87 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.deepEqual(m.calls, [0x4006], "generic mover call");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x6f30, 0x6f32, 0x6f35, 0x6f37, 0x6f39, 0x4006, 0x6f3c, CALLER_RET], "boundaries");
});

test("loc_6f2d state 2: jp z tail into 0x3536", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b02, 0x02);
  m.call = (a) => { m.calls.push(a); return undefined; }; // tail jump: record-only
  loc_6f2d(m);
  assert.equal(m.pc, 0x3536, "state 2 tail-jumps to 0x3536");
  assert.deepEqual(m.calls, [0x3536], "delegates to 0x3536");
});

test("loc_6f2d MUTATION: ld a,(ix+2) at 0x6f2d mischarged 12T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x6f30 ? 12 : c);
  loc_6f2d(m);
  assert.notEqual(m.tstates, 87, "golden 87 T catches the mischarge");
});
