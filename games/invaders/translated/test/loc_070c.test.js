// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_070c (ROM 0x070c-0x073b): the table scan finds B on the 2nd entry,
// exercising one loop iteration + the match; then B*16 is stored and it delegates to loc_08f1.
// Run: node --test games/invaders/translated/test/loc_070c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_070c } from "../loc_070c.js";

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

function seat(m) {
  m.regs.sp = 0x2400;
  m.mem.write16(0x208d, 0x3000); // lhld source -> HL, then B := mem[0x3000]
  m.mem.write8(0x3000, 0x42);    // the value B searches for
  m.mem.write8(0x1d4c, 0x00);    // table[0]: miss (1st iteration)
  m.mem.write8(0x1d4d, 0x42);    // table[1]: hit (2nd iteration)
  m.mem.write8(0x1d51, 0x77);    // parallel table entry read at the matched HL
}

test("loc_070c: match on 2nd entry -> stores B*16, delegates to 0x08f1; 252 T", () => {
  const m = makeMachine();
  seat(m);

  loc_070c(m);

  assert.equal(m.regs.b, 0x42, "B loaded from the lhld pointer");
  assert.equal(m.regs.c, 0x03, "C decremented once (one loop iteration)");
  assert.equal(m.regs.de, 0x1d4d, "DE advanced to the matched entry");
  assert.equal(m.regs.a, 0x77, "A := parallel-table entry");
  assert.equal(m.regs.hl, 0x0420, "HL := B*16 (0x42 << 4)");
  assert.equal(m.mem.read8(0x20f1), 0x01, "0x20f1 flag set");
  assert.equal(m.mem.read8(0x2087), 0x77, "0x2087 := parallel entry");
  assert.equal(m.mem.read16(0x20f2), 0x0420, "0x20f2 := B*16");
  assert.equal(m.tstates, 252, "T total for the 2nd-entry match path");
  assert.equal(m.pc, 0x08f1, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x0742, 0x08f1], "call 0x0742 then tail-jmp 0x08f1");
  assert.equal(m.mem.read16(0x23fe), 0x0739, "call 0x0742 pushes return 0x0739");
});

test("loc_070c MUTATION: shld 0x20f2 mischarged 13T not 16T is caught", () => {
  const m = makeMachine();
  seat(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0736 ? 13 : c);
  loc_070c(m);
  assert.equal(m.tstates, 249, "mutation loses 3 T");
  assert.notEqual(m.tstates, 252, "golden T-state total catches the mutant");
});
