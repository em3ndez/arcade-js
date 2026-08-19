// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_705f (ROM 0x705f-0x7070): level-intro phase 6. Pins the expiry path where
// the (0x8f48) delay hits 0. loc_0ecf is a plain-ret callee (pattern-A -> stub runs m.ret()).
//
// Run: node --test games/pooyan/translated/test/loc_705f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_705f } from "../loc_705f.js";

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

test("loc_705f expiry: runs 0x0ecf, clears (0x8f52), (0x880a)=6; 100 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f48, 0x01); // dec -> 0: not ret nz
  m.mem.write8(0x8f52, 0x99);

  loc_705f(m);

  assert.equal(m.tstates, 10 + 11 + 5 + 17 + 10 + 4 + 13 + 7 + 13 + 10, "100 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8f48), 0x00, "(0x8f48) hit 0");
  assert.equal(m.mem.read8(0x8f52), 0x00, "(0x8f52) cleared");
  assert.equal(m.mem.read8(0x880a), 0x06, "(0x880a) = 6");
  assert.deepEqual(m.calls, [0x0ecf], "screen setup call");
  assert.deepEqual(m.pcSeq,
    [0x7062, 0x7063, 0x7064, 0x0ecf, 0x7067, 0x7068, 0x706b, 0x706d, 0x7070, CALLER_RET], "boundaries");
});

test("loc_705f hold: (0x8f48)!=1 -> dec, ret nz; 32 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f48, 0x05);
  loc_705f(m);
  assert.equal(m.tstates, 10 + 11 + 11, "32 T (ld hl 10 + dec 11 + ret nz taken 11)");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.equal(m.mem.read8(0x8f48), 0x04, "(0x8f48) ticked");
  assert.deepEqual(m.calls, [], "no setup call on the hold path");
  assert.deepEqual(m.pcSeq, [0x7062, 0x7063, CALLER_RET], "boundaries");
});

test("loc_705f MUTATION: dec (hl) at 0x7062 mischarged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f48, 0x01);
  m.mem.write8(0x8f52, 0x99);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x7063 ? 7 : c);
  loc_705f(m);
  assert.notEqual(m.tstates, 100, "golden 100 T catches the mischarge");
});
