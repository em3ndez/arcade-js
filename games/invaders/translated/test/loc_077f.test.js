// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_077f (ROM 0x077f-0x0797): a poll loop. Two arms are pinned:
//   (a) mem[0x20eb]-1 != 0  -> tail-jump to loc_0857 (jnz taken);
//   (b) mem[0x20eb]-1 == 0, IN1 bit2 set -> one pass then fall through into loc_0798.
// Pins the branch T-states, the call return addr, and the delegate for each arm.
//
// Run: node --test games/invaders/translated/test/loc_077f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_077f } from "../loc_077f.js";

function makeMachine(port1 = 0x00) {
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
    io: { portIn: (_p) => port1 },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_077f arm (b): count==1, IN1 bit2 set -> one pass, delegate to loc_0798; 99 T", () => {
  const m = makeMachine(0x04); // IN1 bit2 set -> ani 0x04 NZ -> jz not taken
  m.regs.sp = 0x2400;
  m.mem.write8(0x20eb, 0x01); // dcr a -> 0x00 -> Z -> jnz not taken

  loc_077f(m);

  assert.equal(m.regs.a, 0x04, "A = IN1 & 0x04");
  assert.equal(m.regs.c, 0x14, "C := 0x14");
  assert.equal(m.regs.hl, 0x2810, "HL := 0x2810");
  assert.equal(m.regs.de, 0x1acf, "DE := 0x1acf");
  assert.equal(m.tstates, 13 + 5 + 10 + 7 + 10 + 10 + 17 + 10 + 7 + 10, "T total, one loop pass then exit");
  assert.equal(m.pc, 0x0798, "last step lands at loc_0798");
  assert.deepEqual(m.calls, [0x08f3, 0x0798], "call 0x08f3 then delegate to loc_0798");
  assert.deepEqual(
    m.pcSeq,
    [0x0782, 0x0783, 0x0786, 0x0788, 0x078b, 0x078e, 0x08f3, 0x0793, 0x0795, 0x0798],
    "step boundaries",
  );
  assert.equal(m.mem.read16(0x23fe), 0x0791, "call 0x08f3 pushes return addr 0x0791");
});

test("loc_077f arm (a): count!=1 -> tail-jump to loc_0857; 45 T", () => {
  const m = makeMachine(0x00);
  m.regs.sp = 0x2400;
  m.mem.write8(0x20eb, 0x03); // dcr a -> 0x02 -> NZ -> jnz taken

  loc_077f(m);

  assert.equal(m.tstates, 13 + 5 + 10 + 7 + 10, "T total: through jnz taken");
  assert.equal(m.pc, 0x0857, "last step lands at loc_0857");
  assert.deepEqual(m.calls, [0x0857], "tail-delegates to loc_0857");
  assert.deepEqual(m.pcSeq, [0x0782, 0x0783, 0x0786, 0x0788, 0x0857], "step boundaries");
});

test("loc_077f MUTATION: `dcr a` mis-charged 4T (not 5T) is caught", () => {
  const m = makeMachine(0x04);
  m.regs.sp = 0x2400;
  m.mem.write8(0x20eb, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0783 ? 4 : c);
  loc_077f(m);
  assert.notEqual(m.tstates, 99, "golden T-state total catches the mutant");
});
