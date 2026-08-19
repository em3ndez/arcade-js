// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6e75 (ROM 0x6e75-0x6e85): phase-1 spawner gate. Frozen path tail-jumps to
// 0x4c92; active path runs the two spawn calls 0x6e86/0x6edb.
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

test("loc_6e75 frozen: (0x881e) set -> tail-jump 0x4c92; 40 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x881e, 0x01); // freeze flag

  loc_6e75(m);

  assert.equal(m.tstates, 10 + 13 + 7 + 10, "40 T");
  assert.equal(m.pc, 0x4c92, "tail-jump to the frozen handler");
  assert.deepEqual(m.calls, [0x4c92], "delegates to 0x4c92, no spawn");
  assert.deepEqual(m.pcSeq, [0x6e78, 0x6e7b, 0x6e7c, 0x4c92], "boundaries");
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

test("loc_6e75 MUTATION: or (hl) at 0x6e7b mischarged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x881e, 0x01);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x6e7c ? 4 : c);
  loc_6e75(m);
  assert.notEqual(m.tstates, 40, "golden 40 T catches the mischarge");
});
