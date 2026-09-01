// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_02ed (ROM 0x02ed-0x02f7): reads flag 0x2067, saves it (push psw), and
// branches on its bit0 via `rrc`. Two arms: bit0 set -> carry -> tail-delegate to loc_0332; bit0
// clear -> call 0x020e then fall through into loc_02f8. Pins the PSW push value, both delegates, and
// the exact T-states. The routine never pops, so the mock's `call` stays record-only.
//
// Run: node --test games/invaders/translated/test/loc_02ed.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_02ed } from "../loc_02ed.js";

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
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_02ed: 0x2067 bit0 set -> carry -> tail into loc_0332; 38 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2067, 0x01); // bit0 set -> rrc sets carry

  loc_02ed(m);

  assert.equal(m.tstates, 38, "lda(13)+push psw(11)+rrc(4)+jc taken(10)");
  assert.equal(m.mem.read16(0x23fe), 0x0102, "push psw stored AF (A=0x01, F fixed-bit 0x02)");
  assert.equal(m.regs.a, 0x80, "rrc rotated 0x01 -> 0x80");
  assert.equal(m.pc, 0x0332, "jc lands at loc_0332");
  assert.deepEqual(m.calls, [0x0332], "carry arm delegates to loc_0332");
  assert.deepEqual(m.pcSeq, [0x02f0, 0x02f1, 0x02f2, 0x0332], "step boundaries");
});

test("loc_02ed: 0x2067 bit0 clear -> call 0x020e then fall into loc_02f8; 55 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2067, 0x02); // bit0 clear -> rrc clears carry

  loc_02ed(m);

  assert.equal(m.tstates, 55, "lda(13)+push psw(11)+rrc(4)+jc nt(10)+call(17)");
  assert.equal(m.regs.a, 0x01, "rrc rotated 0x02 -> 0x01");
  assert.equal(m.pc, 0x020e, "last step lands at the 0x020e callee");
  assert.equal(m.mem.read16(0x23fc), 0x02f8, "call 0x020e pushes return addr 0x02f8");
  assert.deepEqual(m.calls, [0x020e, 0x02f8], "call 0x020e then delegate to loc_02f8");
  assert.deepEqual(m.pcSeq, [0x02f0, 0x02f1, 0x02f2, 0x02f5, 0x020e], "step boundaries");
});

test("loc_02ed MUTATION: `lda 0x2067` mis-charged 9T (not 13T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2067, 0x02);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x02f0 ? 9 : c);
  loc_02ed(m);
  assert.equal(m.tstates, 51, "mutation loses 4 T (13 -> 9)");
  assert.notEqual(m.tstates, 55, "golden T-state total catches the mutant");
});
