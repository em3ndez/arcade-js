// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_10c2 (ROM 0x10c2, Pooyan) -- adjust counter B by A (entry carry =
 * direction), store to 0x8f62, then render three 2-digit fields via loc_1131 (bin->BCD) + loc_1119
 * (draw). The 0x10c5 increment loop is inlined (it has no external callers -- verified: no CALL/JP
 * and no word pointer to 0x10c5 anywhere in the ROM), so there is no loc_10c5 file.
 *
 * The mock's `call` POPS the pushed return address (models each callee's ret); loc_1131 additionally
 * models its net effect (A = B as BCD low 2 digits, C = hundreds, B = 0) because loc_10c2 reads C at
 * 0x1102. loc_1119/loc_0f44 outputs are never consumed, so they only pop. A call site missing its
 * push16 then desyncs the stack and the final ret misses CALLER_RET (SP/pc teeth).
 *
 * Path A: inc branch (carry set), 2 loop iters (back-edge taken), jr c taken, jr z(0x10f5) taken.
 * Path B: dec branch (carry clear), 2 iters, jr c not taken (2nd loc_1131), jr z(0x10f5) & jr z(0x1104)
 *         both not taken (third field + 0x85f2 mirror). Path C: inc branch 1 iter (back-edge not
 *         taken), jr c taken, jr z(0x10f5) not taken, jr z(0x1104) taken. TEETH: mis-charge `sla b`
 *         (8 T) as 4 T -> the 267-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_10c2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_10c2 } from "../loc_10c2.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x10c2, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Each callee's ret pops the return address the call site pushed -- model that pop (a missing
    // push16 then desyncs SP/pc). loc_1131 converts B -> BCD in A with the hundreds count in C
    // (loc_10c2 reads C at 0x1102); loc_1119/loc_0f44 outputs are not consumed, so they only pop.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x1131) {
        const n = regs.b & 0xff;
        const rem = n % 100;
        regs.a = ((Math.floor(rem / 10) << 4) | (rem % 10)) & 0xff; // BCD of low 2 digits
        regs.c = Math.floor(n / 100);                               // hundreds carry count
        regs.b = 0;
      }
      return undefined;
    },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_10c2 Path A: inc branch (carry set), 2 iters, jr c + jr z(0x10f5) taken", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0xfe; m.regs.b = 0x00; m.regs.c = 0x01;
  m.regs.f = (m.regs.f | 0x01) & 0xff; // carry set on entry -> jr nc not taken (inc branch)
  m.mem.write8(0x8f5e, 0x05);  // < 0x0a -> jr c taken (skip 2nd loc_1131)
  m.mem.write8(0x8f60, 0x00);  // zero -> jr z(0x10f5) taken (skip third field)
  m.mem.write8(0x8f5c, 0x03);

  loc_10c2(m);

  assert.equal(m.tstates, 267, "Path A T-state total");
  assert.deepEqual(m.pcSeq, [
    0x10c3, 0x10c5, 0x10c6, 0x10c7, 0x10c5, 0x10c6, 0x10c7, 0x10c9, 0x10d0, 0x10d1, 0x10d4,
    0x10d6, 0x1131, 0x10dc, 0x1119, 0x10e2, 0x10e4, 0x10ea, 0x10ed, 0x1119, 0x10f3, 0x10f4,
    0x10f5, 0x1111, 0x1114, 0x1115, 0x0f44, CALLER_RET,
  ], "Path A step boundaries (visits call targets)");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, [0x1131, 0x1119, 0x1119, 0x0f44], "one loc_1131, two loc_1119, one loc_0f44");
  assert.equal(m.mem.read8(0x8f62), 0x02, "counter B (=2) stored");
  assert.equal(m.mem.read8(0x8f5c), 0x04, "0x8f5c bumped 0x03 -> 0x04");
  assert.equal(m.mem.read8(0x85f2), 0x00, "0x85f2 untouched (third field skipped)");
});

test("loc_10c2 Path B: dec branch (carry clear), jr c not taken, jr z(0x1104) not taken -> 0x85f2 mirror", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x02; m.regs.b = 0x00; m.regs.c = 0x08;
  m.regs.f = m.regs.f & ~0x01 & 0xff; // carry clear on entry -> jr nc taken (dec branch)
  m.mem.write8(0x8f5e, 0x20);  // >= 0x0a -> jr c not taken (2nd loc_1131)
  m.mem.write8(0x8f60, 0x50);  // nonzero -> jr z(0x10f5) not taken (third field)
  m.mem.write8(0x8f5c, 0x00);

  loc_10c2(m);

  assert.equal(m.tstates, 392, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x10c3, 0x10cb, 0x10cc, 0x10cd, 0x10cb, 0x10cc, 0x10cd, 0x10cf, 0x10d0, 0x10d1, 0x10d4,
    0x10d6, 0x1131, 0x10dc, 0x1119, 0x10e2, 0x10e4, 0x10e6, 0x10e7, 0x1131, 0x10ed, 0x1119,
    0x10f3, 0x10f4, 0x10f5, 0x10f7, 0x10f8, 0x10fa, 0x10fb, 0x10fc, 0x10fe, 0x1131, 0x1102,
    0x1103, 0x1104, 0x1106, 0x1107, 0x110a, 0x110d, 0x110e, 0x1119, 0x1114, 0x1115, 0x0f44,
    CALLER_RET,
  ], "Path B step boundaries (dec branch, three loc_1131)");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, [0x1131, 0x1119, 0x1131, 0x1119, 0x1131, 0x1119, 0x0f44],
    "three loc_1131, three loc_1119, one loc_0f44");
  // dec loop: B 0x00 -> 0xfe, A -> 0xfe stored, then 0x10fa add 0x50+0xfe = 0x4e rewrites 0x8f62
  assert.equal(m.mem.read8(0x8f62), 0x4e, "0x8f62 rewritten by the third field add");
  assert.equal(m.mem.read8(0x85f2), 0x01, "hundreds carry (C=1) mirrored to 0x85f2");
  assert.equal(m.mem.read8(0x8f5c), 0x01, "0x8f5c bumped 0x00 -> 0x01");
  assert.equal(m.regs.e, 0x60, "E holds the third field's BCD (loc_1131 of 0xa0)");
});

test("loc_10c2 Path C: inc branch 1 iter, jr z(0x10f5) not taken, jr z(0x1104) taken (C==0)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0xff; m.regs.b = 0x00; m.regs.c = 0x03;
  m.regs.f = (m.regs.f | 0x01) & 0xff; // carry set -> inc branch
  m.mem.write8(0x8f5e, 0x05);  // < 0x0a -> jr c taken
  m.mem.write8(0x8f60, 0x05);  // nonzero -> third field; small so 2*5=10 -> C==0 -> jr z(0x1104) taken
  m.mem.write8(0x8f5c, 0x00);

  loc_10c2(m);

  assert.equal(m.tstates, 347, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [
    0x10c3, 0x10c5, 0x10c6, 0x10c7, 0x10c9, 0x10d0, 0x10d1, 0x10d4, 0x10d6, 0x1131, 0x10dc,
    0x1119, 0x10e2, 0x10e4, 0x10ea, 0x10ed, 0x1119, 0x10f3, 0x10f4, 0x10f5, 0x10f7, 0x10f8,
    0x10fa, 0x10fb, 0x10fc, 0x10fe, 0x1131, 0x1102, 0x1103, 0x1104, 0x110a, 0x110d, 0x110e,
    0x1119, 0x1114, 0x1115, 0x0f44, CALLER_RET,
  ], "Path C step boundaries (jr z(0x1104) taken -> skip 0x85f2)");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, [0x1131, 0x1119, 0x1119, 0x1131, 0x1119, 0x0f44],
    "two loc_1131, three loc_1119, one loc_0f44");
  assert.equal(m.mem.read8(0x8f62), 0x06, "0x8f62 = 5(0x8f60) + 1(stored B)");
  assert.equal(m.mem.read8(0x85f2), 0x00, "0x85f2 untouched (C==0 -> jr z taken)");
  assert.equal(m.mem.read8(0x8f5c), 0x01, "0x8f5c bumped");
});

test("loc_10c2 MUTATION: `sla b` mis-charged 4T (not 8T) is caught by the golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x10d6 ? 4 : cycles);
  seatCaller(m);
  m.regs.a = 0xfe; m.regs.b = 0x00; m.regs.c = 0x01;
  m.regs.f = (m.regs.f | 0x01) & 0xff;
  m.mem.write8(0x8f5e, 0x05);
  m.mem.write8(0x8f60, 0x00);
  m.mem.write8(0x8f5c, 0x03);

  loc_10c2(m);

  assert.equal(m.tstates, 263, "mutation loses 4 T (8 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 267, "Path A T-state total"),
    /267/,
    "the 267-T golden must fail on the mutant",
  );
});
