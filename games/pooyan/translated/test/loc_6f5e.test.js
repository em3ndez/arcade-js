// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_6f5e (ROM 0x6f5e-0x6f9c): level-intro phase 3 timing gate. Pins the
// (0x8f48)!=0x20 fast tick and the (0x8f48)==0x20 sub-count path (queue sound 0x0315, tick 0x8f52).
// rst 0x38 is a plain-ret enqueue (pattern-A -> stub runs m.ret()).
//
// Run: node --test games/pooyan/translated/test/loc_6f5e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6f5e } from "../loc_6f5e.js";

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

test("loc_6f5e (0x8f48)!=0x20: fast tick -> dec, ret nz; 58 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f48, 0x05);

  loc_6f5e(m);

  assert.equal(m.tstates, 10 + 7 + 7 + 12 + 11 + 11, "58 T");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.equal(m.mem.read8(0x8f48), 0x04, "(0x8f48) ticked");
  assert.deepEqual(m.calls, [], "no sound on the fast path");
  assert.deepEqual(m.pcSeq, [0x6f61, 0x6f62, 0x6f64, 0x6f79, 0x6f7a, CALLER_RET], "boundaries");
});

test("loc_6f5e (0x8f48)==0x20: queue sound 0x0315, tick (0x8f52) -> ret nz; 131 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f48, 0x20);
  m.mem.write8(0x8f52, 0x02); // non-zero sub-count
  m.mem.write8(0x89e5, 0x00); // not held

  loc_6f5e(m);

  assert.equal(m.tstates, 10 + 7 + 7 + 7 + 7 + 7 + 4 + 7 + 10 + 11 + 10 + 13 + 4 + 5 + 11 + 11, "131 T");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.equal(m.mem.read8(0x8f52), 0x01, "(0x8f52) sub-count ticked");
  assert.equal(m.regs.de, 0x0315, "queued sound command");
  assert.deepEqual(m.calls, [0x0038], "rst-0x38 enqueue");
  assert.deepEqual(m.pcSeq,
    [0x6f61, 0x6f62, 0x6f64, 0x6f66, 0x6f68, 0x6f69, 0x6f6a, 0x6f6c, 0x6f6f, 0x0038, 0x6f70,
     0x6f73, 0x6f74, 0x6f75, 0x6f76, CALLER_RET], "boundaries");
});

test("loc_6f5e MUTATION: cp 0x20 at 0x6f62 mischarged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f48, 0x05);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x6f64 ? 4 : c);
  loc_6f5e(m);
  assert.notEqual(m.tstates, 58, "golden 58 T catches the mischarge");
});
