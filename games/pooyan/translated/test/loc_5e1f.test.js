// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_5e1f (ROM 0x5e1f, Pooyan) -- the proximity trigger.
 * Five path tests cover every branch outcome:
 *   RETZ0   (HL)=0 -> ret z at 0x5e21
 *   RETZ5   (HL)=5 -> ret z at 0x5e24
 *   RETNC_X 0x881f!=0 (jr nz taken), dx>=2 (sub borrow -> neg) -> ret nc at 0x5e47
 *   RETNC_Y 0x881f==0 (jr nz not taken), dx<2, dy>=9 (Y sub borrow -> neg) -> ret nc at 0x5e54
 *   FULL    both distances small (both jr nc taken, both ret nc not taken) -> writes, two calls,
 *           then `pop af; ret` returning past the immediate caller
 * The mock's `call` POPS the pushed return (models the callee `ret`); loc_381e / loc_0f15 leave
 * nothing loc_5e1f reads back, so the mock only pops. Stack seated GRANDCALLER_RET then CALLER_RET:
 * the early `ret cc` paths return to CALLER_RET (GRAND_RET still seated); FULL's `pop af; ret` drops
 * CALLER_RET and returns to GRAND_RET, fully unwinding. TOOTH: `pop ix` mis-charged 10T (not 14T).
 *
 * Run: node --test games/pooyan/translated/test/loc_5e1f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5e1f } from "../loc_5e1f.js";

const CALLER_RET = 0xabcd;
const GRAND_RET = 0x1234;
const IX = 0x8a00; // original IX (read at 0x5e33/0x5e38) -- distinct from HL
const IY = 0x8b00;
const HL = 0x8c50; // (HL) read; becomes IX on the FULL path

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5e1f, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seat(m) {
  m.regs.sp = 0x8780;
  m.push16(GRAND_RET);
  m.push16(CALLER_RET);
  m.regs.ix = IX;
  m.regs.iy = IY;
  m.regs.hl = HL;
}

test("loc_5e1f RETZ0: (HL)=0 -> ret z at 0x5e21; 22 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(HL, 0x00);

  loc_5e1f(m);

  assert.equal(m.tstates, 22);
  assert.deepEqual(m.pcSeq, [0x5e20, 0x5e21, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "returns to immediate caller");
  assert.equal(m.regs.sp, 0x877e, "GRAND_RET still seated");
  assert.deepEqual(m.calls, []);
});

test("loc_5e1f RETZ5: (HL)=5 -> ret z at 0x5e24; 34 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(HL, 0x05);

  loc_5e1f(m);

  assert.equal(m.tstates, 34);
  assert.deepEqual(m.pcSeq, [0x5e20, 0x5e21, 0x5e22, 0x5e24, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
});

test("loc_5e1f RETNC_X: jr nz taken, |dx|>=2 (neg) -> ret nc at 0x5e47; 181 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(HL, 0x02);       // state != 0,5
  m.mem.write8(0x881f, 0x01);   // jr nz taken -> e=0x09,d=0x00
  m.mem.write8(IX + 0x00, 0x00); // e = 0x00 + 0x09 = 0x09
  m.mem.write8(IX + 0x02, 0x00); // d = 0x00
  m.mem.write8(IY + 0x00, 0x00); // dx: 0x00 - 0x09 = borrow -> neg -> 0x09 >= 2

  loc_5e1f(m);

  assert.equal(m.tstates, 181);
  assert.deepEqual(m.pcSeq, [
    0x5e20, 0x5e21, 0x5e22, 0x5e24, 0x5e25, 0x5e27, 0x5e29, 0x5e2c, 0x5e2d, 0x5e33,
    0x5e36, 0x5e37, 0x5e38, 0x5e3b, 0x5e3c, 0x5e3d, 0x5e40, 0x5e41, 0x5e43, 0x5e45, 0x5e47,
    CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
});

test("loc_5e1f RETNC_Y: jr nz not taken, dx<2, |dy|>=9 (neg) -> ret nc at 0x5e54; 244 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(HL, 0x02);
  m.mem.write8(0x881f, 0x00);   // jr nz not taken -> e=0xf7,d=0x10
  m.mem.write8(IX + 0x00, 0x09); // e = 0x09 + 0xf7 = 0x00
  m.mem.write8(IX + 0x02, 0x00); // d = 0x00 + 0x10 = 0x10
  m.mem.write8(IY + 0x00, 0x00); // dx: 0x00 - 0x00 = 0x00 -> jr nc taken, cp2 -> continue
  m.mem.write8(IY + 0x02, 0xf8); // dy: 0xf8+0x08=0x00; 0x00-0x10 borrow -> neg -> 0x10 >= 9

  loc_5e1f(m);

  assert.equal(m.tstates, 244);
  assert.deepEqual(m.pcSeq, [
    0x5e20, 0x5e21, 0x5e22, 0x5e24, 0x5e25, 0x5e27, 0x5e29, 0x5e2c, 0x5e2d, 0x5e2f, 0x5e31, 0x5e33,
    0x5e36, 0x5e37, 0x5e38, 0x5e3b, 0x5e3c, 0x5e3d, 0x5e40, 0x5e41, 0x5e45, 0x5e47,
    0x5e48, 0x5e4b, 0x5e4d, 0x5e4e, 0x5e50, 0x5e52, 0x5e54,
    CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
});

const PC_FULL = [
  0x5e20, 0x5e21, 0x5e22, 0x5e24, 0x5e25, 0x5e27, 0x5e29, 0x5e2c, 0x5e2d, 0x5e2f, 0x5e31, 0x5e33,
  0x5e36, 0x5e37, 0x5e38, 0x5e3b, 0x5e3c, 0x5e3d, 0x5e40, 0x5e41, 0x5e45, 0x5e47,
  0x5e48, 0x5e4b, 0x5e4d, 0x5e4e, 0x5e52, 0x5e54, 0x5e55, 0x5e57, 0x5e5a, 0x5e5b, 0x5e5d, 0x5e60,
  0x381e,                                 // call 0x381e -> target
  0x5e67, 0x5e6b, 0x5e6f, 0x5e73,
  0x0f15,                                 // call 0x0f15 -> target
  0x5e77, GRAND_RET,
];

function setupFull(m) {
  seat(m);
  m.mem.write8(HL, 0x02);
  m.mem.write8(0x881f, 0x00);   // jr nz not taken -> e=0xf7,d=0x10
  m.mem.write8(IX + 0x00, 0x09); // e = 0x00
  m.mem.write8(IX + 0x02, 0x00); // d = 0x10
  m.mem.write8(IY + 0x00, 0x00); // dx = 0 -> jr nc taken, continue
  m.mem.write8(IY + 0x02, 0x08); // dy: 0x08+0x08=0x10; 0x10-0x10=0x00 -> jr nc taken, cp9 continue
}

test("loc_5e1f FULL: hit -> writes + loc_381e + loc_0f15, pop af; ret to grandcaller; 420 T", () => {
  const m = makeMachine();
  setupFull(m);

  loc_5e1f(m);

  assert.equal(m.tstates, 420, "FULL T-state total");
  assert.deepEqual(m.pcSeq, PC_FULL, "step boundaries visit both call targets, end at grandcaller");
  assert.equal(m.pc, GRAND_RET, "pop af + ret returns past the immediate caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, [0x381e, 0x0f15]);
  assert.equal(m.mem.read8(0x8d32), 0x01, "trigger flag set");
  // IX retargeted to HL (0x8c50) before the field writes
  assert.equal(m.mem.read8(HL + 0x11), 0x0a);
  assert.equal(m.mem.read8(HL + 0x00), 0x00);
  assert.equal(m.mem.read8(HL + 0x01), 0x01);
  assert.equal(m.mem.read8(HL + 0x02), 0x02);
  assert.equal(m.regs.ix, HL, "IX = HL after push hl / pop ix");
});

test("loc_5e1f MUTATION: `pop ix` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5e5d ? 10 : cycles);
  setupFull(m);

  loc_5e1f(m);

  assert.equal(m.tstates, 416, "mutation loses 4 T (14 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 420, "FULL T-state total"), /420/);
});
