// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6e75 (ROM 0x6e75-0x6e85): phase-1 spawner gate. The frozen/paused arm aims
// at 0x4c92 which is DATA -- a dead trap that throws; the active path runs the two spawn calls 0x6e86/0x6edb.
//
// Run: node --test games/pooyan/translated/test/loc_6e75.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6e75 } from "../loc_6e75.js";

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

test("loc_6e75 frozen: (0x881e) set -> the 0x4c92 data-arm is a dead trap (throws)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x881e, 0x01); // freeze flag -> the jp nz,0x4c92 arm; 0x4c92 is a data table

  assert.throws(() => loc_6e75(m), /trap 0x4c92/, "the freeze/pause arm aims at data -> unreachable, throws");
});

test("loc_6e75 active: no flags -> spawn 0x6e86 + 0x6edb, ret; 104 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.call = (a) => { m.calls.push(a); m.ret(); return undefined; }; // pattern-A stub

  loc_6e75(m);

  assert.equal(m.tstates, 10 + 13 + 7 + 10 + 17 + 10 + 17 + 10 + 10, "104 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.deepEqual(m.calls, [0x6e86, 0x6edb], "both spawn calls");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x6e78, 0x6e7b, 0x6e7c, 0x6e7f, 0x6e86, 0x6e82, 0x6edb, 0x6e85, CALLER_RET], "boundaries");
});

test("loc_6e75 MUTATION: or (hl) at 0x6e7c mischarged 4T (not 7T) caught by the active-path golden", () => {
  const m = makeMachine();
  seatCaller(m);
  m.call = (a) => { m.calls.push(a); m.ret(); return undefined; }; // pattern-A stub (active path)
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x6e7c ? 4 : c);
  loc_6e75(m);
  assert.notEqual(m.tstates, 104, "golden 104 T catches the mischarge");
});
