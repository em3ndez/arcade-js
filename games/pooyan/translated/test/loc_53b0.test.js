// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_53b0 (ROM 0x53b0, Pooyan) -- one-shot spawn/init of the object
 * record at 0x8c30, gated on A!=0 && (0x8d59)==0 && (0x8a5f)==0.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`).
 * For rst 0x20 (loc_0020) it also models A/HL <- (HL+A) so the record fields are deterministic;
 * loc_381e is a pure pop (loc_53b0 reloads A from 0x8907 immediately after it).
 *
 * Paths: the three gate rets (A==0; 0x8d59!=0; 0x8a5f!=0), the main body with the index < 7
 * (jr c taken), and the main body with the index clamped to 6 (jr c not taken). MUTATION: charge
 * `ld (ix+9),a` (19 T) as 7 T -> the 414-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_53b0.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_53b0 } from "../loc_53b0.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x53b0, pcSeq: [],
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
    // Pop the return address the call site pushed. loc_0020 (rst 0x20) then sets HL = HL+A, A = (HL);
    // loc_381e leaves nothing loc_53b0 reads (A is reloaded from 0x8907 right after).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) {
        const nh = (regs.hl + regs.a) & 0xffff;
        regs.hl = nh;
        regs.a = mem.read8(nh);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function setupGatesOpen(m) {
  m.regs.a = 0x01;             // A != 0 -> ret z not taken
  m.mem.write8(0x8d59, 0x00);  // not yet spawned -> ret nz not taken
  m.mem.write8(0x8a5f, 0x00);  // clear -> ret nz not taken
  // rst 0x20 table at 0x5902: A=1 -> (0x5903)
  m.mem.write8(0x5903, 0x25);
}

const PC_MAIN_HEAD = [
  0x53b1, 0x53b2, 0x53b5, 0x53b6, 0x53b7, 0x53ba, 0x53bb, 0x53bc, 0x53bd, 0x53c0,
  0x53c4, 0x53c7, 0x0020, 0x53cb, 0x53cd, 0x53d0, 0x53d4, 0x53d8, 0x53d9, 0x53dc,
  0x53e0, 0x53e3, 0x53e6, 0x53e7, 0x53ea, 0x53ed, 0x381e, 0x53f3, 0x53f5, 0x53f6, 0x53f8,
];

test("loc_53b0 gate: A==0 -> ret z immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;

  loc_53b0(m);

  assert.equal(m.tstates, 4 + 11, "and a + ret z");
  assert.deepEqual(m.pcSeq, [0x53b1, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
});

test("loc_53b0 gate: 0x8d59 already set -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x01;
  m.mem.write8(0x8d59, 0x01); // already spawned

  loc_53b0(m);

  assert.equal(m.tstates, 4 + 5 + 13 + 4 + 11);
  assert.deepEqual(m.pcSeq, [0x53b1, 0x53b2, 0x53b5, 0x53b6, CALLER_RET]);
  assert.deepEqual(m.calls, []);
});

test("loc_53b0 gate: 0x8a5f nonzero -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x01;
  m.mem.write8(0x8d59, 0x00);
  m.mem.write8(0x8a5f, 0x80);

  loc_53b0(m);

  assert.equal(m.tstates, 4 + 5 + 13 + 4 + 5 + 13 + 4 + 11);
  assert.deepEqual(m.pcSeq, [0x53b1, 0x53b2, 0x53b5, 0x53b6, 0x53b7, 0x53ba, 0x53bb, CALLER_RET]);
  assert.deepEqual(m.calls, []);
});

test("loc_53b0 main: index < 7 (jr c taken) -> full record init", () => {
  const m = makeMachine();
  seatCaller(m);
  setupGatesOpen(m);
  m.mem.write8(0x8907, 0x04); // srl->2, inc->3, cp7 -> carry (jr c taken), index 3
  m.mem.write8(0x540a, 0x99); // (0x5407)[3]

  loc_53b0(m);

  assert.equal(m.tstates, 414, "main path (jr c taken) T-state total");
  assert.deepEqual(m.pcSeq, [...PC_MAIN_HEAD, 0x53fc, 0x53ff, 0x5402, 0x0020, 0x5406, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x0020, 0x381e, 0x0020]);
  // record fields at 0x8c30
  assert.equal(m.mem.read8(0x8c39), 0x25, "(ix+9) from rst 0x20 table");
  assert.equal(m.mem.read8(0x8c3a), 0xdb, "(ix+0xa) = neg(0x25)");
  assert.equal(m.mem.read8(0x8c30), 0x01, "(ix+0)=1");
  assert.equal(m.mem.read8(0x8c32), 0x0b, "(ix+2)=0x0b");
  assert.equal(m.mem.read8(0x8c33), 0x00, "(ix+3)=0");
  assert.equal(m.mem.read8(0x8c34), 0x04, "(ix+4)=0x04");
  assert.equal(m.mem.read8(0x8c35), 0x00, "(ix+5)=0");
  assert.equal(m.mem.read8(0x8c36), 0x00, "(ix+6)=0");
  assert.equal(m.mem.read8(0x8d4b), 0xff, "0x8d4b = cpl(0)");
  assert.equal(m.mem.read8(0x8d59), 0x01, "spawn latch set");
  assert.equal(m.mem.read8(0x8d5c), 0x03, "index stored");
  assert.equal(m.mem.read8(0x8d5d), 0x99, "0x8d5d from (0x5407)[3]");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to pre-seat baseline (every push16 matched a callee ret + final ret popped CALLER_RET)");
});

test("loc_53b0 main: index >= 7 clamped to 6 (jr c not taken)", () => {
  const m = makeMachine();
  seatCaller(m);
  setupGatesOpen(m);
  m.mem.write8(0x8907, 0x10); // srl->8, inc->9, cp7 -> no carry (jr c not taken) -> clamp to 6
  m.mem.write8(0x540d, 0x77); // (0x5407)[6]

  loc_53b0(m);

  assert.equal(m.tstates, 416, "clamp path (jr c not taken) T-state total");
  assert.deepEqual(m.pcSeq, [...PC_MAIN_HEAD, 0x53fa, 0x53fc, 0x53ff, 0x5402, 0x0020, 0x5406, CALLER_RET]);
  assert.equal(m.mem.read8(0x8d5c), 0x06, "index clamped to 6");
  assert.equal(m.mem.read8(0x8d5d), 0x77, "0x8d5d from (0x5407)[6]");
});

test("loc_53b0 MUTATION: `ld (ix+9),a` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x53cb ? 7 : cycles);
  seatCaller(m);
  setupGatesOpen(m);
  m.mem.write8(0x8907, 0x04);
  m.mem.write8(0x540a, 0x99);

  loc_53b0(m);

  assert.equal(m.tstates, 402, "mutation loses 12 T (19 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 414, "main path T-state total"), /414/);
});
