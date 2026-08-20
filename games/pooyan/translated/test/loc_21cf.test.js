// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_21cf (ROM 0x21cf, Pooyan) -- per-object state step for the iy
 * record. When (iy+7) bit0 is set it runs the 0x2204 sub-phase (advance (iy+4) by 4 until 0xe8,
 * seeding (iy+f) on the first tick and stepping (iy+1)). Otherwise it primes (iy+0x12)+loc_0ed2
 * once; then, unless (iy+0) bit1 is set (a tail branch to the untranslated 0x2226), it consumes a
 * per-object timer cell (0x8d1b or 0x8d1c, selected by iyl bit3) or decrements (iy+6) by 4. Expiring
 * cells and the borrow fall into the 0x221e clear: HL <- IY, blank 0x18 tiles via rst 0x10 (loc_0010).
 *
 * The mock's `call` POPS the return address the call site pushed -- modelling the callee's `ret`.
 * call 0x0ed2 and rst 0x10 (loc_0010) each push then get popped, staying balanced; the tail branch
 * `jr nz,0x2226` pushes NOTHING and its callee's ret consumes the seated OWN_RET, so the stack
 * unwinds to the pre-seat baseline (0x8780) -- the tail stack-fidelity tooth. 0x2226 is a boundary.
 *
 * Paths: P1 sub-phase ret c (iy1==0); P2 seed (iy1==1); P3 sub-phase -> tail (cp 0xe8 no carry);
 * P4 sub-phase ret c (cp 0xe8 carry); P5 (iy0) bit1 set -> boundary 0x2226; P6 iy12==0 -> call
 * 0x0ed2, cell 0x8d1b!=0 -> clear + tail; P7 iyl bit3=1 -> cell 0x8d1c!=0 -> tail; P8 cell==0,
 * (iy+6)-4 borrow -> tail; P9 cell==0, (iy+6)-4 ok -> store + ret.
 * MUTATION: mis-charge `bit 0,(iy+7)` (20 T) as 16 T -> the 69-T golden of P1 must fail.
 *
 * Run: node --test games/pooyan/translated/test/loc_21cf.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_21cf } from "../loc_21cf.js";

const OWN_RET = 0xabcd;
const BASELINE = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x21cf, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
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
    ret(c = 10) { this.step(this.pop16(), c); },
    // The callee's `ret` pops the return address the call site pushed -- model that pop so a missing
    // push16 (or a mis-modelled tail) desyncs SP and fails the baseline assertion. loc_0ed2/loc_0010
    // preserve every register loc_21cf reads afterward, so no register effect is modelled here.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seat(m, iy = 0x8a00) {
  m.regs.sp = BASELINE;
  m.push16(OWN_RET);
  m.regs.iy = iy;
}

test("loc_21cf P1: (iy+7) bit0 set, (iy+1)==0 -> ret c", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8a07, 0x01); // (iy+7) bit0
  m.mem.write8(0x8a01, 0x00); // (iy+1)==0 -> cp 0x01 carry

  loc_21cf(m);

  assert.equal(m.tstates, 69);
  assert.deepEqual(m.pcSeq, [0x21d3, 0x2204, 0x2207, 0x2209, OWN_RET]);
  assert.equal(m.pc, OWN_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.deepEqual(m.calls, []);
});

test("loc_21cf P2: sub-phase seed (iy+1)==1 -> write (iy+f), inc (iy+1), step (iy+4), ret c", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8a07, 0x01);
  m.mem.write8(0x8a01, 0x01); // ==1 -> ret c not taken, jr nz not taken -> seed
  m.mem.write8(0x8a04, 0x00);

  loc_21cf(m);

  assert.equal(m.tstates, 175);
  assert.deepEqual(m.pcSeq, [
    0x21d3, 0x2204, 0x2207, 0x2209, 0x220a, 0x220c, 0x2210, 0x2213, 0x2216, 0x2218,
    0x221b, 0x221d, OWN_RET,
  ]);
  assert.equal(m.pc, OWN_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8a0f), 0x1b, "(iy+0x0f) seeded");
  assert.equal(m.mem.read8(0x8a01), 0x02, "(iy+1) incremented 1->2");
  assert.equal(m.mem.read8(0x8a04), 0x04, "(iy+4) += 4");
});

test("loc_21cf P3: sub-phase (iy+1)>=2, (iy+4)+4 no carry -> tail (rst 0x10)", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8a07, 0x01);
  m.mem.write8(0x8a01, 0x05); // >=2 -> jr nz taken (skip seed)
  m.mem.write8(0x8a04, 0xf0); // 0xf0+4 = 0xf4, cp 0xe8 -> no carry -> tail

  loc_21cf(m);

  assert.equal(m.tstates, 189);
  assert.deepEqual(m.pcSeq, [
    0x21d3, 0x2204, 0x2207, 0x2209, 0x220a, 0x2213, 0x2216, 0x2218, 0x221b, 0x221d,
    0x221e, 0x2220, 0x2221, 0x2223, 0x2224, 0x0010, OWN_RET,
  ]);
  assert.equal(m.pc, OWN_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.deepEqual(m.calls, [0x0010]);
  assert.equal(m.mem.read8(0x8a04), 0xf4, "(iy+4) += 4 stored before the tail");
});

test("loc_21cf P4: sub-phase (iy+1)>=2, (iy+4)+4 carry -> ret c", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8a07, 0x01);
  m.mem.write8(0x8a01, 0x05);
  m.mem.write8(0x8a04, 0x10); // 0x10+4 = 0x14, cp 0xe8 -> carry -> ret c

  loc_21cf(m);

  assert.equal(m.tstates, 138);
  assert.deepEqual(m.pcSeq, [
    0x21d3, 0x2204, 0x2207, 0x2209, 0x220a, 0x2213, 0x2216, 0x2218, 0x221b, 0x221d, OWN_RET,
  ]);
  assert.equal(m.pc, OWN_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8a04), 0x14);
});

test("loc_21cf P5: (iy+7) bit0 clear, (iy+0) bit1 set -> tail branch to boundary 0x2226", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8a07, 0x00);       // bit0 clear -> main body
  m.mem.write8(0x8a12, 0x05);       // (iy+0x12)!=0 -> skip loc_0ed2 prime
  m.mem.write8(0x8a00, 0x02);       // (iy+0) bit1 set -> jr nz,0x2226

  loc_21cf(m);

  assert.equal(m.tstates, 94);
  assert.deepEqual(m.pcSeq, [0x21d3, 0x21d5, 0x21d8, 0x21d9, 0x21e1, 0x21e5, 0x2226]);
  assert.equal(m.pc, 0x2226, "tail branch lands on the boundary routine");
  assert.equal(m.regs.sp, BASELINE, "boundary's ret consumes the seated OWN_RET (tail)");
  assert.deepEqual(m.calls, [0x2226]);
});

test("loc_21cf P6: (iy+0x12)==0 -> inc + call 0x0ed2; cell 0x8d1b!=0 -> clear + tail", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8a07, 0x00);
  m.mem.write8(0x8a12, 0x00);       // ==0 -> inc (iy+0x12) + call 0x0ed2
  m.mem.write8(0x8a00, 0x00);       // (iy+0) bit1 clear
  m.mem.write8(0x8d1b, 0x07);       // iyl bit3=0 -> cell 0x8d1b, non-zero -> clear + jr 0x221e

  loc_21cf(m);

  assert.equal(m.tstates, 259);
  assert.deepEqual(m.pcSeq, [
    0x21d3, 0x21d5, 0x21d8, 0x21d9, 0x21db, 0x21de, 0x0ed2, 0x21e5, 0x21e7, 0x21e9,
    0x21eb, 0x21ee, 0x21f1, 0x21f2, 0x21f3, 0x21f5, 0x21f7, 0x221e, 0x2220, 0x2221,
    0x2223, 0x2224, 0x0010, OWN_RET,
  ]);
  assert.equal(m.pc, OWN_RET);
  assert.equal(m.regs.sp, BASELINE, "push16(0x21e1)/call + rst/ret all balanced");
  assert.deepEqual(m.calls, [0x0ed2, 0x0010]);
  assert.equal(m.mem.read8(0x8a12), 0x01, "(iy+0x12) primed 0->1");
  assert.equal(m.mem.read8(0x8d1b), 0x00, "expired cell cleared");
});

test("loc_21cf P7: iyl bit3=1 -> cell 0x8d1c!=0 -> clear + tail", () => {
  const m = makeMachine();
  seat(m, 0x8a08);                  // iyl=0x08 -> bit3 set -> inc hl to 0x8d1c
  m.mem.write8(0x8a08 + 0x07, 0x00);
  m.mem.write8(0x8a08 + 0x12, 0x05); // !=0 -> skip loc_0ed2
  m.mem.write8(0x8a08 + 0x00, 0x00); // bit1 clear
  m.mem.write8(0x8d1c, 0x03);        // cell 0x8d1c non-zero

  loc_21cf(m);

  assert.equal(m.tstates, 225);
  assert.deepEqual(m.pcSeq, [
    0x21d3, 0x21d5, 0x21d8, 0x21d9, 0x21e1, 0x21e5, 0x21e7, 0x21e9, 0x21eb, 0x21ee,
    0x21f0, 0x21f1, 0x21f2, 0x21f3, 0x21f5, 0x21f7, 0x221e, 0x2220, 0x2221, 0x2223,
    0x2224, 0x0010, OWN_RET,
  ]);
  assert.equal(m.pc, OWN_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.deepEqual(m.calls, [0x0010]);
  assert.equal(m.mem.read8(0x8d1c), 0x00, "0x8d1c selected (inc hl) and cleared");
});

test("loc_21cf P8: cell==0, (iy+6)-4 borrow -> tail (no store)", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8a07, 0x00);
  m.mem.write8(0x8a12, 0x05);
  m.mem.write8(0x8a00, 0x00);
  m.mem.write8(0x8d1b, 0x00);        // cell zero -> loc_21f9
  m.mem.write8(0x8a06, 0x02);        // 0x02 - 4 -> borrow -> jr c,0x221e

  loc_21cf(m);

  assert.equal(m.tstates, 245);
  assert.deepEqual(m.pcSeq, [
    0x21d3, 0x21d5, 0x21d8, 0x21d9, 0x21e1, 0x21e5, 0x21e7, 0x21e9, 0x21eb, 0x21ee,
    0x21f1, 0x21f2, 0x21f3, 0x21f9, 0x21fc, 0x21fe, 0x221e, 0x2220, 0x2221, 0x2223,
    0x2224, 0x0010, OWN_RET,
  ]);
  assert.equal(m.pc, OWN_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.deepEqual(m.calls, [0x0010]);
  assert.equal(m.mem.read8(0x8a06), 0x02, "(iy+6) unchanged on the borrow path");
});

test("loc_21cf P9: cell==0, (iy+6)-4 ok -> store (iy+6) + ret", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8a07, 0x00);
  m.mem.write8(0x8a12, 0x05);
  m.mem.write8(0x8a00, 0x00);
  m.mem.write8(0x8d1b, 0x00);
  m.mem.write8(0x8a06, 0x40);        // 0x40 - 4 = 0x3c, no borrow -> store + ret

  loc_21cf(m);

  assert.equal(m.tstates, 212);
  assert.deepEqual(m.pcSeq, [
    0x21d3, 0x21d5, 0x21d8, 0x21d9, 0x21e1, 0x21e5, 0x21e7, 0x21e9, 0x21eb, 0x21ee,
    0x21f1, 0x21f2, 0x21f3, 0x21f9, 0x21fc, 0x21fe, 0x2200, 0x2203, OWN_RET,
  ]);
  assert.equal(m.pc, OWN_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8a06), 0x3c, "(iy+6) = 0x40 - 4");
});

test("loc_21cf MUTATION: `bit 0,(iy+7)` mis-charged 16T (not 20T) is caught by the 69-T golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x21d3 ? 16 : c);
  seat(m);
  m.mem.write8(0x8a07, 0x01);
  m.mem.write8(0x8a01, 0x00); // path P1

  loc_21cf(m);

  assert.equal(m.tstates, 65, "mutation loses 4 T (20 -> 16)");
  assert.throws(
    () => assert.equal(m.tstates, 69, "P1 T-state total"),
    /69/,
    "the 69-T golden must fail on the mutant",
  );
});
