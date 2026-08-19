// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7287 (ROM 0x7287-0x7291): eagle grid-advance guard. Below 0xd0 it ret c;
// at/above it arms (0x8f3e) and falls through into loc_7292 (tail-continue, record-only stub).
//
// Run: node --test games/pooyan/translated/test/loc_7287.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7287 } from "../loc_7287.js";

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

test("loc_7287 below edge: (0x8c94)<0xd0 -> ret c; 31 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8c94, 0x00);

  loc_7287(m);

  assert.equal(m.tstates, 13 + 7 + 11, "31 T");
  assert.equal(m.pc, CALLER_RET, "ret c returns to caller");
  assert.deepEqual(m.calls, [], "no finish");
  assert.deepEqual(m.pcSeq, [0x728a, 0x728c, CALLER_RET], "boundaries");
});

test("loc_7287 at edge: (0x8c94)>=0xd0 -> arm (0x8f3e), tail into loc_7292; 45 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8c94, 0xff);

  loc_7287(m);

  assert.equal(m.tstates, 13 + 7 + 5 + 7 + 13, "45 T");
  assert.equal(m.pc, 0x7292, "tail-continue into loc_7292");
  assert.equal(m.mem.read8(0x8f3e), 0x01, "finish flag armed");
  assert.deepEqual(m.calls, [0x7292], "delegates to loc_7292");
  assert.deepEqual(m.pcSeq, [0x728a, 0x728c, 0x728d, 0x728f, 0x7292], "boundaries");
});

test("loc_7287 MUTATION: cp 0xd0 at 0x728a mischarged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8c94, 0x00);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x728c ? 4 : c);
  loc_7287(m);
  assert.notEqual(m.tstates, 31, "golden 31 T catches the mischarge");
});
