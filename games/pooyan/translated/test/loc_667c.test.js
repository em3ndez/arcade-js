// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_667c (ROM 0x667c, Pooyan) -- advances an actor while its (ix+0x01)
 * state byte is 0. It adds the step (ix+0x09) into position (ix+0x05), carrying into (ix+0x06); once
 * the carried high byte reaches 0x1d the record is retired (state<-0x02, (ix+0x04)/(ix+0x06) cleared),
 * otherwise it rets. Three paths cover ret-nz, the carry/no-carry add arms and both ret-c arms.
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); this routine
 * makes no calls, so the tooth is the seated caller's return, popped by every terminal ret.
 *
 * Run: node --test games/pooyan/translated/test/loc_667c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_667c } from "../loc_667c.js";

const CALLER_RET = 0xabcd;
const IX = 0x8b00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x667c, pcSeq: [],
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

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.regs.ix = IX;
  m.push16(CALLER_RET);
}

test("loc_667c Path 1: state (ix+0x01)!=0 -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x01, 0x01);

  loc_667c(m);

  assert.equal(m.tstates, 19 + 4 + 11, "Path 1 T = ld a,(ix+1) + and a + ret nz taken");
  assert.deepEqual(m.pcSeq, [0x667f, 0x6680, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "ret unwound the stack to baseline");
});

test("loc_667c Path 2: add no carry, position < 0x1d -> ret c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x01, 0x00);   // state 0 -> continue
  m.mem.write8(IX + 0x05, 0x05);
  m.mem.write8(IX + 0x09, 0x05);   // 0x05+0x05 = 0x0a, no carry -> jr nc taken
  m.mem.write8(IX + 0x06, 0x00);   // high byte 0 < 0x1d -> ret c taken

  loc_667c(m);

  assert.equal(m.tstates, 19+4+5 + 19+19 + 12 + 19+19+7 + 11, "Path 2 T-state total");
  assert.deepEqual(
    m.pcSeq,
    [0x667f, 0x6680, 0x6681, 0x6684, 0x6687, 0x668c, 0x668f, 0x6692, 0x6694, CALLER_RET],
    "no-carry: jr nc taken (skip inc), ret c on high byte 0",
  );
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(IX + 0x05), 0x0a, "position advanced to 0x0a");
  assert.equal(m.mem.read8(IX + 0x06), 0x00, "high byte untouched (no carry)");
  assert.equal(m.regs.sp, 0x8780, "ret unwound the stack to baseline");
});

test("loc_667c Path 3: add carries, high byte hits 0x1d -> retire record", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x01, 0x00);   // state 0 -> continue
  m.mem.write8(IX + 0x05, 0xff);
  m.mem.write8(IX + 0x09, 0x02);   // 0xff+0x02 = 0x101 -> carry, a=0x01 -> jr nc not taken
  m.mem.write8(IX + 0x06, 0x1c);   // inc -> 0x1d; cp 0x1d equal -> ret c not taken

  loc_667c(m);

  assert.equal(
    m.tstates,
    19+4+5 + 19+19 + 7 + 23 + 19+19+7 + 5 + 19+4+19+19 + 10,
    "Path 3 T-state total",
  );
  assert.deepEqual(m.pcSeq, [
    0x667f, 0x6680, 0x6681, 0x6684, 0x6687, 0x6689, 0x668c, 0x668f,
    0x6692, 0x6694, 0x6695, 0x6699, 0x669a, 0x669d, 0x66a0, CALLER_RET,
  ], "carry: inc (ix+6), ret c not taken, run the retire block, ret");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(IX + 0x05), 0x01, "position stored the wrapped sum 0x01");
  assert.equal(m.mem.read8(IX + 0x01), 0x02, "state retired to 0x02");
  assert.equal(m.mem.read8(IX + 0x04), 0x00, "(ix+0x04) cleared");
  assert.equal(m.mem.read8(IX + 0x06), 0x00, "(ix+0x06) cleared");
  assert.equal(m.regs.sp, 0x8780, "ret unwound the stack to baseline");
});

test("loc_667c MUTATION: the ld a,(ix+0x01) mis-charged 18T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x667f ? 18 : cycles);
  seatCaller(m);
  m.mem.write8(IX + 0x01, 0x00);
  m.mem.write8(IX + 0x05, 0xff);
  m.mem.write8(IX + 0x09, 0x02);
  m.mem.write8(IX + 0x06, 0x1c);

  loc_667c(m);

  const golden = 19+4+5 + 19+19 + 7 + 23 + 19+19+7 + 5 + 19+4+19+19 + 10;
  assert.equal(m.tstates, golden - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, golden, "Path 3 T-state total"), /Path 3/);
});
