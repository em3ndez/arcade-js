// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_15f3 (ROM 0x15f3-0x1610): count non-zero cells over 0x37 bytes from HL into C,
// store the count at 0x2082, and write 0x01 to 0x206b iff the count == 1 (else early rnz). Both arms
// exercised. The mock's call is record-only, so the internal `call 0x1611` leaves its pushed return
// (0x15f6) on the stack and the routine's own ret pops THAT -- final PC = 0x15f6 (documented artifact).
// The zero arm costs 41 T/iter, the non-zero arm 46 T/iter (the extra inr c), over 0x37=55 rows.
//
// Run: node --test games/invaders/translated/test/loc_15f3.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_15f3 } from "../loc_15f3.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x15f3, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_15f3: count==1 -> stores 1 at 0x2082 AND 0x01 at 0x206b", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write16(0x2400, 0x1234); // caller return (survives under the internal push)
  m.regs.hl = 0x3000;            // 0x1611 is record-only; seat the scan pointer
  m.mem.write8(0x3000, 0x05);    // exactly one non-zero cell in [0x3000, 0x3036]

  loc_15f3(m);

  assert.equal(m.mem.read8(0x2082), 0x01, "count (1) stored at 0x2082");
  assert.equal(m.mem.read8(0x206b), 0x01, "count==1 -> 0x01 written to 0x206b");
  assert.equal(m.regs.c, 0x01, "C counted one non-zero cell");
  assert.equal(m.regs.b, 0x00, "B decremented to 0 over 0x37 rows");
  assert.equal(m.regs.hl, 0x206b, "HL left at the mvi m target");
  assert.equal(m.regs.a, 0x01, "A = C = 1 (mov a,c; cpi doesn't alter A)");
  assert.equal(
    m.tstates,
    17 + 10 + (41 * 55 + 5 * 1) + 5 + 13 + 7 + 5 + 10 + 10 + 10,
    "call+lxi+loop(41 zero,46 nonzero over 55)+mov+sta+cpi+rnz(nt)+lxi+mvi+ret",
  );
  assert.deepEqual(m.calls, [0x1611], "one internal call");
  assert.equal(m.pc, 0x15f6, "ARTIFACT: ret pops the internal call's return (0x15f6)");
  assert.equal(m.regs.sp, 0x2400, "SP back above the internal push");
});

test("loc_15f3: count!=1 -> stores count at 0x2082, early rnz, no 0x206b write", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write16(0x2400, 0x1234);
  m.regs.hl = 0x3000;
  m.mem.write8(0x3000, 0x01);
  m.mem.write8(0x3010, 0x01);
  m.mem.write8(0x3020, 0x01); // three non-zero cells -> count = 3

  loc_15f3(m);

  assert.equal(m.mem.read8(0x2082), 0x03, "count (3) stored at 0x2082");
  assert.equal(m.mem.read8(0x206b), 0x00, "count!=1 -> rnz returns before writing 0x206b");
  assert.equal(m.regs.c, 0x03, "C counted three non-zero cells");
  assert.equal(m.regs.hl, 0x3037, "HL left at scan end (0x3000 + 0x37); no lxi h ran");
  assert.equal(
    m.tstates,
    17 + 10 + (41 * 55 + 5 * 3) + 5 + 13 + 7 + 11,
    "loop + mov + sta + cpi + rnz taken(11)",
  );
  assert.equal(m.pc, 0x15f6, "ARTIFACT: ret pops the internal call's return (0x15f6)");
});

test("loc_15f3 MUTATION: sta 0x2082 mis-charged 10T (not 13T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.hl = 0x3000;
  m.mem.write8(0x3000, 0x05); // count == 1 path
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1608 ? 10 : c); // 0x1608 = landing after sta
  loc_15f3(m);
  assert.equal(
    m.tstates,
    17 + 10 + (41 * 55 + 5 * 1) + 5 + 10 + 7 + 5 + 10 + 10 + 10,
    "mutation loses 3 T (sta 13 -> 10)",
  );
  assert.notEqual(
    m.tstates,
    17 + 10 + (41 * 55 + 5 * 1) + 5 + 13 + 7 + 5 + 10 + 10 + 10,
    "golden T-state total catches the mutant",
  );
});
