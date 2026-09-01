// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_170e (ROM 0x170e-0x172b): calls 0x09ca, reads the key at mem[HL+1],
// scans the 4-entry threshold table 0x1cb8 (parallel table 0x1aa1) for the first entry >= key,
// stores the matched 0x1aa1-side byte to 0x20cf. The record-only mock leaves the call return on
// the stack, so the final ret pops the pushed 0x1711.
//
// Run: node --test games/invaders/translated/test/loc_170e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_170e } from "../loc_170e.js";

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
    io: { outs: [], portOut(p, v) { this.outs.push([p, v & 0xff]); }, portIn() { return 0; } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

function seat(m) {
  m.regs.sp = 0x2400;
  m.regs.hl = 0x3000; // call 0x09ca leaves HL (record-only); inx h -> 0x3001
  m.ram[0x3001] = 0x50; // the key -> B
  m.ram[0x1cb8] = 0x10; m.ram[0x1cb9] = 0x40; m.ram[0x1cba] = 0x80; m.ram[0x1cbb] = 0x90; // thresholds
  m.ram[0x1aa3] = 0x77; // matched parallel-table byte (HL lands here on the 3rd entry)
}

test("loc_170e: scans to the 3rd threshold (0x80 >= 0x50), stores mem[0x1aa3] to 0x20cf; 204 T", () => {
  const m = makeMachine();
  seat(m);

  loc_170e(m);

  assert.equal(m.mem.read8(0x20cf), 0x77, "matched byte stored to 0x20cf");
  assert.equal(m.regs.a, 0x77, "A holds the matched byte (mov a,m)");
  assert.equal(m.regs.b, 0x50, "B := the key");
  assert.equal(m.regs.c, 0x02, "C := 4 - two loop decrements");
  assert.equal(m.regs.de, 0x1cba, "DE advanced twice to the matching threshold");
  assert.equal(m.regs.hl, 0x1aa3, "HL advanced twice into the parallel table");
  assert.equal(m.tstates, 204, "T total for the two-miss-then-hit scan");
  assert.deepEqual(m.calls, [0x09ca], "the one leading call");
  assert.equal(m.mem.read16(0x23fe), 0x1711, "call 0x09ca pushes return 0x1711");
  assert.equal(m.pc, 0x1711, "record-only ret pops the pushed return 0x1711");
});

test("loc_170e MUTATION: sta 0x20cf mis-charged 7T not 13T is caught", () => {
  const m = makeMachine();
  seat(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x172b ? 7 : c);
  loc_170e(m);
  assert.notEqual(m.tstates, 204, "golden T-state total catches the mis-charged sta");
});
