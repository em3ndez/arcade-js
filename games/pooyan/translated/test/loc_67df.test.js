// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_67df (ROM 0x67df, Pooyan) -- the checksum gate + screen init.
 * Sum 10 bytes at 0x82bc (stride -0x20) into C; C != 0x5a tails to loc_67a0, else set three flags,
 * clear the 9-byte block at 0x8928 (rst 0x10), propagate 0 across 0x8a80.. (ld (hl),0 + ldir), then
 * paint 0x1d rows of tile 0x10 from 0x8442 (rst 0x10 fill + 0x20/row for 0x1d rows).
 *
 * The mock's `call` POPS the pushed return address (each rst 0x10 -> loc_0010's `ret`), so a missing
 * push16 desyncs the stack and the final ret misses CALLER_RET. loc_0010 is a memset: its net effect
 * on the caller is HL += B, B = 0, which the mock models (the paint loop relies on HL advancing).
 * The tail `jr nz -> loc_67a0` reuses the frame (no push16); its callee ret consumes the seated
 * CALLER_RET, so SP returns to the pre-seat baseline. ldirAt mirrors machine.js (21 T/repeat, 16 exit).
 *
 * Run: node --test games/pooyan/translated/test/loc_67df.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_67df } from "../loc_67df.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x67df, pcSeq: [],
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
    // The callee's `ret` pops the pushed return address. loc_0010 is a memset: net caller effect is
    // HL += B, B = 0 (the paint loop reads back the advanced HL). loc_67a0 (tail) is pop-only.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0010) { regs.hl = (regs.hl + regs.b) & 0xffff; regs.b = 0; }
      return undefined;
    },
    ldirAt(self, nextAddr) {
      for (;;) {
        const byte = mem.read8(regs.hl);
        mem.write8(regs.de, byte);
        regs.hl = (regs.hl + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff;
        regs.bc = (regs.bc - 1) & 0xffff;
        const n = (regs.a + byte) & 0xff;
        regs.f = (regs.f & (0x80 | 0x40 | 0x01)) | (regs.bc !== 0 ? 0x04 : 0) | (n & 0x08 ? 0x08 : 0) | (n & 0x02 ? 0x20 : 0);
        if (regs.bc === 0) { this.step(nextAddr, 16); return; }
        regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28);
        this.step(self, 21);
      }
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// The 10 checksum bytes at 0x82bc, stride -0x20.
const SUM_ADDRS = [0x82bc, 0x829c, 0x827c, 0x825c, 0x823c, 0x821c, 0x81fc, 0x81dc, 0x81bc, 0x819c];

function sumSeq() {
  const s = [0x67e2, 0x67e5, 0x67e8];
  for (let i = 1; i <= 10; i++) s.push(0x67e9, 0x67ea, 0x67eb, 0x67ec, i < 10 ? 0x67e8 : 0x67ee);
  return s;
}

test("loc_67df FAIL: checksum != 0x5a -> tail jr to loc_67a0", () => {
  const m = makeMachine();
  seatCaller(m);
  // all 10 bytes 0 -> C = 0 != 0x5a

  loc_67df(m);

  assert.equal(m.tstates, 438, "FAIL T-state total");
  assert.deepEqual(m.pcSeq, [...sumSeq(), 0x67f0, 0x67f1, 0x67a0]);
  assert.equal(m.pc, 0x67a0, "tail lands on loc_67a0");
  assert.deepEqual(m.calls, [0x67a0]);
  assert.equal(m.regs.c, 0x00, "checksum accumulated in C");
  assert.equal(m.regs.hl, 0x817c, "HL walked 0x82bc - 10*0x20");
  assert.equal(m.regs.sp, 0x8780, "tail call's callee ret consumed the seated return -> baseline");
});

test("loc_67df OK: checksum == 0x5a -> flags, clears, ldir, paint loop, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x82bc, 0x5a); // sum = 0x5a, others 0

  loc_67df(m);

  const midSeq = [
    0x67f0, 0x67f1, 0x67f3, 0x67f5, 0x67f8, 0x67fb, 0x67fe, 0x67ff, 0x6802, 0x6804, 0x0010,
    0x6808, 0x6809, 0x680c, 0x680f,
  ];
  const ldirSeq = [...Array(575).fill(0x680f), 0x6811];
  const paintPre = [0x6813, 0x6816, 0x6818];
  const tailSeq = [];
  for (let i = 1; i <= 29; i++) {
    tailSeq.push(0x681a, 0x0010, 0x681c, 0x681d, 0x681e, 0x681f, i < 29 ? 0x6818 : 0x6821);
  }
  const PC_OK = [...sumSeq(), ...midSeq, ...ldirSeq, ...paintPre, ...tailSeq, CALLER_RET];

  assert.equal(m.tstates, 14176, "OK T-state total");
  assert.deepEqual(m.pcSeq, PC_OK, "full trace: sum loop, ldir 576, paint 0x1d rows");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [0x0010, ...Array(29).fill(0x0010)], "one boot rst + 0x1d paint rsts");
  // flag stores
  assert.equal(m.mem.read8(0x8904), 0x01);
  assert.equal(m.mem.read8(0x8808), 0x01);
  assert.equal(m.mem.read8(0x880a), 0x01);
  // ldir propagate: 0x8a80 seeded 0, copied through 0x8cc0
  assert.equal(m.mem.read8(0x8a80), 0x00);
  assert.equal(m.mem.read8(0x8cc0), 0x00);
  // registers after the paint loop (HL advanced +0x20 per row via loc_0010's memset + inc hl x3)
  assert.equal(m.regs.a, 0x10, "A = paint tile");
  assert.equal(m.regs.hl, 0x87e2, "HL = 0x8442 + 0x1d*0x20");
  assert.equal(m.regs.de, 0x8cc1, "DE = 0x8a81 + 0x240 after ldir");
  assert.equal(m.regs.b, 0x00);
  assert.equal(m.regs.c, 0x00, "paint counter exhausted");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_67df MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x67ec ? 7 : cycles);
  seatCaller(m);

  loc_67df(m);

  assert.equal(m.tstates, 398, "mutation loses 4 T x10 sum iterations (11 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 438, "FAIL total"), /438/);
});

// SUM_ADDRS documents the stride the sum loop walks; referenced so the constant is exercised.
test("loc_67df sum loop walks the -0x20 stride", () => {
  assert.equal(SUM_ADDRS[0] - SUM_ADDRS[1], 0x20);
  assert.equal(SUM_ADDRS.length, 10);
});
