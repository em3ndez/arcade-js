// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0988 (ROM 0x0988-0x09ac): if pending flag (0x20f1) is clear, ret; else
// clear it and add the 2-byte BCD delta at (0x20f2) into the 2-byte accumulator at (HL, from the
// record 0x09ca sets) with DAA, load the next pointer from (HL+2/HL+3) into HL, tail-jump 0x09ad.
// Expected values derived from dk.asm. The mock's call is record-only (see the pop-psw artifact
// below).
//
// Run: node --test games/invaders/translated/test/loc_0988.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0988 } from "../loc_0988.js";

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

test("loc_0988 PATH A: pending flag clear -> ret; 45 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write16(0x2400, 0x1234); // caller return (survives under the internal push)
  m.mem.write8(0x20f1, 0x00);

  loc_0988(m);

  assert.equal(m.regs.a, 0x00, "A := (0x20f1) == 0");
  assert.equal(m.tstates, 17 + 13 + 4 + 11, "call(17)+lda(13)+ana(4)+rz taken(11)");
  assert.deepEqual(m.calls, [0x09ca], "only the leading 0x09ca");
  assert.equal(m.mem.read16(0x23fe), 0x098b, "call 0x09ca pushes return addr 0x098b");
  assert.equal(m.pc, 0x098b, "ARTIFACT: ret pops the internal call's return, not the caller's");
  assert.equal(m.regs.sp, 0x2400, "SP back above the internal push");
  assert.deepEqual(m.pcSeq, [0x09ca, 0x098e, 0x098f, 0x098b], "step boundaries");
});

test("loc_0988 PATH B: flag set -> BCD add 25+25=50, next ptr, tail-jump 0x09ad; 195 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2500;           // accumulator base (0x09ca is record-only, so HL is seated)
  m.mem.write8(0x20f1, 0x01);   // pending set
  m.mem.write16(0x20f2, 0x0025);// delta -> DE = 0x0025 after lhld/xchg
  m.mem.write8(0x2500, 0x25);   // acc low
  m.mem.write8(0x2501, 0x00);   // acc high
  m.mem.write8(0x2502, 0x40);   // next ptr low
  m.mem.write8(0x2503, 0x25);   // next ptr high

  loc_0988(m);

  assert.equal(m.mem.read8(0x20f1), 0x00, "pending flag cleared (xra/sta)");
  assert.equal(m.mem.read8(0x2500), 0x50, "acc low := 0x25 + 0x25 (BCD) = 0x50");
  assert.equal(m.mem.read8(0x2501), 0x00, "acc high := 0x00 + carry(0) = 0x00");
  assert.equal(m.regs.de, 0x0050, "DE := running BCD sum (E then D via mov e,a/mov d,a)");
  assert.equal(m.regs.hl, 0x2540, "HL := next pointer from (HL+2/HL+3)");
  assert.equal(m.regs.a, 0x40, "A holds next-ptr low (last mov a,m)");
  assert.equal(
    m.tstates,
    17 + 13 + 4 + 5 + 4 + 13 + 11 + 16 + 4 + 10 + 7 + 4 + 4 + 7 + 5 + 5 + 7 + 4 + 4 + 7 + 5 + 5 + 7 + 5 + 7 + 5 + 10,
    "195 T",
  );
  assert.deepEqual(
    m.calls,
    [0x09ca, 0x09ad],
    "leading 0x09ca then the tail-jump into 0x09ad",
  );
  assert.equal(m.mem.read16(0x23fe), 0x098b, "call 0x09ca pushes return addr 0x098b");
  assert.equal(m.regs.sp, 0x23fe, "push h / pop h balance; only the 0x09ca push remains");
  assert.equal(m.pc, 0x09ad, "tail-jump lands at 0x09ad");
});

test("loc_0988 MUTATION: lhld mis-charged 10T not 16T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2500;
  m.mem.write8(0x20f1, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0998 ? 10 : c);
  loc_0988(m);
  assert.equal(m.tstates, 189, "mutation loses 6 T (lhld 16 -> 10)");
  assert.notEqual(m.tstates, 195, "golden T-state total catches the mutant");
});
