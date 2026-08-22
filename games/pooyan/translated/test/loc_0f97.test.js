// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0f97 (ROM 0x0f97-0x0fa1): a second-entry command trampoline. Computes
// A = (((0x8907) rrca) & 3) + 0x1e and tail-delegates to the 0x0fc3 command dispatcher.
//
// Run: node --test games/pooyan/translated/test/loc_0f97.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f97 } from "../loc_0f97.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0,
    step(n, c) { this.pc = n; this.tstates += c; },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("(0x8907)==0 -> A=0x1e, delegates to 0x0fc3", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8907, 0x00);
  loc_0f97(m);
  assert.equal(m.regs.a & 0xff, 0x1e, "A = ((0 rrca)&3)+0x1e");
  assert.deepEqual(m.calls, [0x0fc3], "tail-delegates to the 0x0fc3 dispatcher");
  assert.equal(m.pc, CALLER_RET, "dispatcher ret's to loc_0f97's caller");
  assert.equal(m.tstates, 13 + 4 + 7 + 7 + 10 + 10, "ld/rrca/and/add/jp + delegate ret");
});

test("(0x8907)==2 -> A=0x1f", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8907, 0x02); // rrca -> 0x01, &3 = 1, +0x1e = 0x1f
  loc_0f97(m);
  assert.equal(m.regs.a & 0xff, 0x1f);
  assert.deepEqual(m.calls, [0x0fc3]);
});
