// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1a69 (ROM 0x1a69-0x1a7e): OR-merge blit. Seat B=2 rows of C=3 bytes; DE is a
// contiguous 6-byte source, HL a destination whose rows are 0x20 apart. Assert each dest byte is
// (src | dest), that DE ran straight through, HL landed at base+2*0x20, and the stack rebalanced.
//
// Run: node --test games/invaders/translated/test/loc_1a69.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1a69 } from "../loc_1a69.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1a69, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only (no calls here)
  };
}

// 2 rows * 3 bytes: per outer = push b(11)+push h(11) + 3*(7+7+7+5+5+5+10)=138 + pop h(10)
// + lxi b(10)+dad b(10)+pop b(10)+dcr b(5)+jnz(10) = 215; total = 2*215 + ret(10).
const GOLDEN_T = 2 * 215 + 10;

function seat(m) {
  m.regs.sp = 0x2400; m.push16(CALLER_RET); // pushes park at 0x23fc/0x23fa, clear of the data
  m.regs.b = 0x02; // 2 rows
  m.regs.c = 0x03; // 3 bytes per row
  m.regs.de = 0x3000; // contiguous source
  m.regs.hl = 0x2100; // dest row 0 base; row 1 is +0x20
  const src = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20];
  src.forEach((v, i) => { m.ram[0x3000 + i] = v; });
  m.ram[0x2100] = 0x80; m.ram[0x2101] = 0x40; m.ram[0x2102] = 0x00; // dest row 0
  m.ram[0x2120] = 0x00; m.ram[0x2121] = 0x01; m.ram[0x2122] = 0x02; // dest row 1
}

test("loc_1a69: ORs src into two 0x20-strided dest rows; balances stack; 440 T", () => {
  const m = makeMachine();
  seat(m);

  loc_1a69(m);

  assert.equal(m.mem.read8(0x2100), 0x81, "0x2100 = 0x01|0x80");
  assert.equal(m.mem.read8(0x2101), 0x42, "0x2101 = 0x02|0x40");
  assert.equal(m.mem.read8(0x2102), 0x04, "0x2102 = 0x04|0x00");
  assert.equal(m.mem.read8(0x2120), 0x08, "0x2120 = 0x08|0x00 (row 1, HL += 0x20)");
  assert.equal(m.mem.read8(0x2121), 0x11, "0x2121 = 0x10|0x01");
  assert.equal(m.mem.read8(0x2122), 0x22, "0x2122 = 0x20|0x02");
  assert.equal(m.regs.a, 0x22, "A holds the last OR result");
  assert.equal(m.regs.de, 0x3006, "DE ran straight through all 6 source bytes");
  assert.equal(m.regs.hl, 0x2140, "HL = base + 2*0x20 after the final dad b");
  assert.equal(m.regs.b, 0x00, "B drained to 0 (2 rows)");
  assert.equal(m.regs.c, 0x03, "C restored by pop b each outer pass");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.tstates, GOLDEN_T, "golden T total for 2x3 blit + ret");
  assert.equal(m.regs.sp, 0x2400, "stack fully balanced (push b/h matched by pop h/b), ret popped caller");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
});

test("loc_1a69 MUTATION: not-taken inner jnz mis-charged 11T not 10T is caught", () => {
  const m = makeMachine();
  seat(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a74 ? c + 1 : c); // inner exit jnz -> step 0x1a74, real 10T
  loc_1a69(m);
  assert.equal(m.tstates, GOLDEN_T + 2, "fires once per outer pass (2 passes) -> +2");
  assert.notEqual(m.tstates, GOLDEN_T, "golden T-state total catches the mutant");
});
