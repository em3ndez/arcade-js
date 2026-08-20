// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5150 (ROM 0x5150, Pooyan) -- advance the board/attract script.
 * Guarded on 0x8d6d being clear (ret nz) and the phase 0x8901 >= 7 (ret c). It fetches a script row
 * via loc_0c45 (table 0x519a), scans its stride-2 {threshold,value} records for the phase (jr z match,
 * ret nc when past the last), then latches the guard/value and resolves two data pointers through
 * loc_0c45 (tables 0x5264 / 0x52b0) into 0x8d71 / 0x8d6f.
 *
 * The mock's `call` POPS the pushed return (modelling loc_0c45's `ret`) and reproduces loc_0c45's DE/HL
 * result (DE = table word at base + 2*A, HL = base + 2*A + 1) from RAM so the scan and pointer stores are
 * driven by data the test lays down. A missing push16 at any call site then desyncs SP -- the stack tooth.
 *
 * Run: node --test games/pooyan/translated/test/loc_5150.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5150 } from "../loc_5150.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5150, pcSeq: [],
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
    // loc_0c45's `ret` pops the return address the call site pushed (model that pop -> a missing push16
    // desyncs SP). loc_0c45 also sets DE = word[base + 2*A] and HL = base + 2*A + 1; reproduce that from
    // RAM so the scan pointer (after `ex de,hl`) and the two data pointers come from test-laid data.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0c45) {
        const p = (regs.hl + ((regs.a & 0xff) * 2)) & 0xffff;
        regs.de = mem.read8(p) | (mem.read8((p + 1) & 0xffff) << 8);
        regs.hl = (p + 1) & 0xffff;
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_FOUND2 = [
  0x5153, 0x5154, 0x5155, 0x5158, 0x515b, 0x515d, 0x0c45, 0x5161, 0x5164, 0x5166, 0x5167,
  0x5168, 0x516a, 0x516b, 0x516c, 0x516d, 0x5167, // record0: no match, no ret -> loop back
  0x5168, 0x516f,                                 // record1: jr z match
  0x5172, 0x5173, 0x5174, 0x5175, 0x5178, 0x517b, 0x0c45,
  0x517f, 0x5182, 0x5183, 0x5187, 0x5188, 0x518b, 0x0c45,
  0x5192, 0x5193, 0x5196, 0x5199, CALLER_RET,
];

function setupFound2(m) {
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x00);          // guard clear -> not busy
  m.mem.write8(0x8907, 0x00);          // row index 0
  m.mem.write16(0x519a, 0x6000);       // row-table[0] -> scan row at 0x6000
  m.mem.write8(0x8901, 0x08);          // phase
  m.mem.write8(0x6000, 0x20);          // record0 threshold (> phase) -> loop iterates
  m.mem.write8(0x6002, 0x08);          // record1 threshold == phase -> match
  m.mem.write8(0x6003, 0x05);          // record1 value
  m.mem.write16(0x526e, 0x6100);       // table 0x5264 [idx 5] -> data ptr 0x6100
  m.mem.write8(0x6100, 0x99);          // data byte read at 0x517e
  m.mem.write16(0x52ba, 0x6200);       // table 0x52b0 [idx 5] -> data ptr 0x6200
}

test("loc_5150 FOUND: match on the 2nd record -> latch + resolve two pointers", () => {
  const m = makeMachine();
  setupFound2(m);

  loc_5150(m);

  assert.equal(m.tstates, 367, "FOUND(2nd) T-state total");
  assert.deepEqual(m.pcSeq, PC_FOUND2, "loop iterates once then matches; both loc_0c45 calls visited");
  assert.equal(m.pc, CALLER_RET, "final ret to the seated caller");
  assert.deepEqual(m.calls, [0x0c45, 0x0c45, 0x0c45], "row lookup + two data lookups");
  assert.equal(m.mem.read8(0x8d6d), 0x08, "guard latched = matched phase");
  assert.equal(m.mem.read8(0x8d74), 0x05, "row value latched");
  assert.equal(m.mem.read8(0x8d73), 0x99, "data byte stored");
  assert.equal(m.mem.read8(0x8d71), 0x01, "0x8d71 = (data ptr + 1) low");
  assert.equal(m.mem.read8(0x8d72), 0x61, "0x8d72 = (data ptr + 1) high");
  assert.equal(m.mem.read8(0x8d6f), 0x00, "0x8d6f low");
  assert.equal(m.mem.read8(0x8d70), 0x62, "0x8d70 high");
  assert.equal(m.mem.read8(0x8d7b), 0x00, "0x8d7b cleared");
  assert.equal(m.mem.read8(0x8d7e), 0x00, "0x8d7e cleared");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (three push16 matched three callee rets)");
});

test("loc_5150 busy: guard 0x8d6d set -> ret nz immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x01);

  loc_5150(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ld + and + ret nz");
  assert.deepEqual(m.pcSeq, [0x5153, 0x5154, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5150 ret c: phase below 7 -> return after the row lookup", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x00);
  m.mem.write8(0x8907, 0x00);
  m.mem.write16(0x519a, 0x6000);
  m.mem.write8(0x8901, 0x03); // < 7 -> cp 0x07 sets carry -> ret c

  loc_5150(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 10 + 13 + 7 + 17 + 4 + 13 + 7 + 11, "through the row lookup then ret c");
  assert.deepEqual(m.pcSeq, [
    0x5153, 0x5154, 0x5155, 0x5158, 0x515b, 0x515d, 0x0c45, 0x5161, 0x5164, 0x5166, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x0c45], "only the row lookup ran");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5150 ret nc: phase past the row's last record -> return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d6d, 0x00);
  m.mem.write8(0x8907, 0x00);
  m.mem.write16(0x519a, 0x6000);
  m.mem.write8(0x8901, 0x08);
  m.mem.write8(0x6000, 0x05); // threshold < phase -> cp clears carry, nonzero -> ret nc

  loc_5150(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 10 + 13 + 7 + 17 + 4 + 13 + 7 + 5 + 7 + 7 + 11, "scan ends on ret nc");
  assert.deepEqual(m.pcSeq, [
    0x5153, 0x5154, 0x5155, 0x5158, 0x515b, 0x515d, 0x0c45, 0x5161, 0x5164, 0x5166,
    0x5167, 0x5168, 0x516a, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x0c45]);
  assert.equal(m.mem.read8(0x8d6d), 0x00, "no match -> guard untouched");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5150 MUTATION: `ld (0x8d71),de` mis-charged 16T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5187 ? 16 : cycles);
  setupFound2(m);

  loc_5150(m);

  assert.equal(m.tstates, 363, "mutation loses 4 T (20 -> 16)");
  assert.throws(
    () => assert.equal(m.tstates, 367, "FOUND(2nd) T-state total"),
    /367/,
    "the 367-T golden must fail on the mutant",
  );
});
