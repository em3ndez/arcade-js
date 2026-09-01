// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1868 (ROM 0x1868-0x189d): bump 0x20c2, call loc_01d9, compare to (0x20ca).
// Arm A -- equal: write 0x20cb=1 and RET (loc_1898). Arm B -- unequal + bit2 of 0x20c2 clear: add
// 0x30 to (0x20cc), store to 0x20c7, call loc_1a3b, XCHG, tail-jmp loc_15d3. The mock's `call` pops
// the pushed return (models the callee ret); Arm B's tail-jmp goes through `call` too (it also pops,
// so SP is not asserted there -- the return-addr/write assertions carry the teeth for that arm).
//
// Run: node --test games/invaders/translated/test/loc_1868.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1868 } from "../loc_1868.js";

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
    regs, mem, ram, calls: [], pushed: [], tstates: 0, pc: 0x1868, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushed.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; }, // balanced: models callee ret
  };
}

test("loc_1868 ARM A: (0x20ca)==loc_01d9 result -> set 0x20cb=1, ret; 111 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x77;             // loc_01d9 is record-only -> A survives as B
  m.mem.write8(0x20c2, 0x05);  // inr m -> 0x06
  m.mem.write8(0x20c3, 0x07);  // -> C
  m.mem.write8(0x20ca, 0x77);  // == B -> jz taken

  loc_1868(m);

  assert.equal(m.mem.read8(0x20c2), 0x06, "inr m bumped the counter");
  assert.equal(m.mem.read8(0x20cb), 0x01, "loc_1898 sets 0x20cb := 1");
  assert.equal(m.regs.a, 0x01, "A := 1");
  assert.equal(m.regs.b, 0x77, "B := loc_01d9 result");
  assert.equal(m.regs.c, 0x07, "C := (0x20c3)");
  assert.deepEqual(m.calls, [0x01d9], "only loc_01d9 on the equal arm");
  assert.ok(m.pushed.includes(0x1871), "call 0x01d9 pushes return addr 0x1871");
  assert.equal(m.tstates, 111, "equal-arm T total");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.equal(m.regs.sp, 0x2400, "stack fully balanced on the ret arm");
  assert.deepEqual(m.pcSeq, [
    0x186b, 0x186c, 0x186d, 0x186e, 0x01d9, 0x1872, 0x1875, 0x1876,
    0x1898, 0x189a, 0x189d, CALLER_RET,
  ], "step boundaries");
});

test("loc_1868 ARM B: unequal + bit2 clear -> +0x30, store 0x20c7, call loc_1a3b, tail-jmp loc_15d3; 204 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x55;
  m.mem.write8(0x20c2, 0x00);  // inr m -> 0x01, bit2 clear -> jnz not taken -> +0x30
  m.mem.write8(0x20c3, 0x09);  // -> C
  m.mem.write8(0x20ca, 0x66);  // != B (0x55) -> jz not taken
  m.mem.write16(0x20cc, 0x2000); // lhld base

  loc_1868(m);

  assert.equal(m.mem.read8(0x20c2), 0x01, "inr m bumped the counter");
  assert.equal(m.mem.read16(0x20c7), 0x2030, "shld stores base(0x2000)+0x30");
  assert.equal(m.regs.hl, 0x0030, "HL := DE after xchg (DE held 0x0030)");
  assert.equal(m.regs.de, 0x20c5, "DE := HL after xchg (HL held 0x20c5)");
  assert.equal(m.regs.a, 0x00, "A := (0x20c2) & 0x04 = 0");
  assert.equal(m.regs.b, 0x55, "B := loc_01d9 result");
  assert.deepEqual(m.calls, [0x01d9, 0x1a3b, 0x15d3], "loc_01d9, loc_1a3b, then tail-jmp loc_15d3");
  assert.ok(m.pushed.includes(0x1891), "call 0x1a3b pushes return addr 0x1891");
  assert.equal(m.tstates, 204, "unequal-arm T total");
  assert.equal(m.pc, 0x15d3, "tail-jmp lands at loc_15d3");
  assert.deepEqual(m.pcSeq, [
    0x186b, 0x186c, 0x186d, 0x186e, 0x01d9, 0x1872, 0x1875, 0x1876, 0x1879,
    0x187c, 0x187e, 0x1881, 0x1884, 0x1887, 0x1888, 0x188b, 0x188e, 0x1a3b, 0x1892, 0x15d3,
  ], "step boundaries");
});

test("loc_1868 MUTATION: `call 0x01d9` mis-charged 11T (not 17T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.a = 0x77;
  m.mem.write8(0x20c2, 0x05); m.mem.write8(0x20c3, 0x07); m.mem.write8(0x20ca, 0x77);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01d9 ? 11 : c);
  loc_1868(m);
  assert.equal(m.tstates, 105, "mutation loses 6 T (17 -> 11)");
  assert.notEqual(m.tstates, 111, "golden T-state total catches the mutant");
});
