// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1474 (ROM 0x1474-0x147b): OUT (L & 7) to port 2 (shift-register offset
// select), then tail-jump into loc_1a47. The mock records the port write and the delegate.
//
// Run: node --test games/invaders/translated/test/loc_1474.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1474 } from "../loc_1474.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [], outs: [],
    io: { outs: [], portOut(p, v) { this.outs.push([p, v & 0xff]); }, portIn(_p) { return 0; } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_1474: OUT port2 = L&7, delegates to loc_1a47; 32 T", () => {
  const m = makeMachine();
  m.regs.l = 0x25; // low 3 bits -> 5

  loc_1474(m);

  assert.equal(m.regs.a, 0x05, "A := L & 0x07");
  assert.deepEqual(m.io.outs, [[0x02, 0x05]], "single OUT to port 2 with 0x05");
  assert.equal(m.tstates, 5 + 7 + 10 + 10, "mov+ani+out+jmp");
  assert.deepEqual(m.calls, [0x1a47], "tail-delegates to loc_1a47");
  assert.equal(m.pc, 0x1a47, "last step lands at loc_1a47");
});

test("loc_1474 MUTATION: `out 0x02` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.l = 0x25;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1479 ? 7 : c); // out lands at 0x1479
  loc_1474(m);
  assert.notEqual(m.tstates, 32, "golden T-state total catches the mutant");
});
