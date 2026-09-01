// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_020e (ROM 0x020e-0x0212): sets A=0x01, then tail-delegates to
// loc_0214. Record-only mock pins the seat, T-states, step boundaries, and the delegate.
// Run: node --test games/invaders/translated/test/loc_020e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_020e } from "../loc_020e.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x020e, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_020e: sets A=0x01, tail-delegates to loc_0214; 17 T", () => {
  const m = makeMachine();

  loc_020e(m);

  assert.equal(m.regs.a, 0x01, "A := 0x01");
  assert.equal(m.tstates, 7 + 10, "T: mvi(7)+jmp(10)");
  assert.equal(m.pc, 0x0214, "last step lands at the tail target");
  assert.deepEqual(m.pcSeq, [0x0210, 0x0214], "step boundaries");
  assert.deepEqual(m.calls, [0x0214], "tail-delegates to loc_0214");
});

test("loc_020e MUTATION: `mvi a` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0210 ? 4 : c);
  loc_020e(m);
  assert.equal(m.tstates, 4 + 10, "mutation loses 3 T (7 -> 4)");
  assert.notEqual(m.tstates, 17, "golden T-state total catches the mutant");
});
