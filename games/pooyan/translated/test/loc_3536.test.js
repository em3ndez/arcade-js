// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_3536 (ROM 0x3536, Pooyan) -- actor frame-hold tick. Calls loc_4006,
 * decrements the (IX+11h) hold and returns nz while holding; on expiry, if (IX+07h)&0xf0 is set it
 * bumps the 0x8d76 counter, wrapping at 3. All non-holding exits tail-call loc_3553 (blank sprite).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`); a
 * missing push16 desyncs the stack (the RET path then lands off the seated caller). loc_4006 and
 * loc_3553 need no register modelling here -- nothing loc_3536 branches on reads their output.
 *
 * Paths: RET_NZ (hold not expired), JRZ ((IX+07h)&0xf0==0), JRC (counter < 3), FALLTHROUGH
 * (counter reached 3 -> dec l + clears -> fall into loc_3553). TEETH: mis-charge `dec (ix+11h)`
 * (23 T) as 19 T -> the 51-T RET_NZ golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_3536.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3536 } from "../loc_3536.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x3536, pcSeq: [],
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
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_3536 RET_NZ: hold not expired -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x05); // dec -> 0x04, NZ

  loc_3536(m);

  assert.equal(m.tstates, 51, "T = call + dec(ix) + ret nz taken");
  assert.deepEqual(m.pcSeq, [0x4006, 0x353c, CALLER_RET]);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(IX + 0x11), 0x04, "hold decremented");
  assert.equal(m.pc, CALLER_RET, "ret nz to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
});

test("loc_3536 JRZ: (IX+07h)&0xf0 == 0 -> tail jr z,0x3553", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01); // dec -> 0, not nz
  m.mem.write8(IX + 0x07, 0x0f); // &0xf0 == 0 -> jr z taken

  loc_3536(m);

  assert.equal(m.tstates, 83, "T = call+dec+retnz(nt)+ld a(ix)+and+jr z(taken)");
  assert.deepEqual(m.pcSeq, [0x4006, 0x353c, 0x353d, 0x3540, 0x3542, 0x3553]);
  assert.deepEqual(m.calls, [0x4006, 0x3553]);
  assert.equal(m.pc, 0x3553, "tail lands on loc_3553");
  // Tail jp reuses the frame: loc_3553's ret consumes the seated CALLER_RET -> SP back to baseline.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to pre-seat baseline (tail call)");
});

test("loc_3536 JRC: counter below 3 -> inc + tail jr c,0x3553", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01); // dec -> 0
  m.mem.write8(IX + 0x07, 0x10); // &0xf0 != 0 -> jr z not taken
  m.mem.write8(0x8d76, 0x00);    // inc -> 1, cp 3 -> carry -> jr c taken

  loc_3536(m);

  assert.equal(m.tstates, 125, "T through jr c taken");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x353c, 0x353d, 0x3540, 0x3542, 0x3544, 0x3547, 0x3548, 0x3549, 0x354b, 0x3553,
  ]);
  assert.deepEqual(m.calls, [0x4006, 0x3553]);
  assert.equal(m.mem.read8(0x8d76), 0x01, "counter bumped");
  assert.equal(m.pc, 0x3553);
  assert.equal(m.regs.sp, 0x8780, "tail call -> baseline");
});

test("loc_3536 FALLTHROUGH: counter reaches 3 -> dec l + clears -> fall into loc_3553", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01); // dec -> 0
  m.mem.write8(IX + 0x07, 0x20); // &0xf0 != 0
  m.mem.write8(0x8d76, 0x05);    // inc -> 6, cp 3 -> no carry -> jr c not taken

  loc_3536(m);

  assert.equal(m.tstates, 148, "T through fall-through into loc_3553");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x353c, 0x353d, 0x3540, 0x3542, 0x3544, 0x3547, 0x3548, 0x3549, 0x354b,
    0x354d, 0x354e, 0x354f, 0x3550, 0x3553,
  ]);
  assert.deepEqual(m.calls, [0x4006, 0x3553]);
  assert.equal(m.mem.read8(0x8d76), 0x06, "counter (0x8d76) untouched after the branch");
  assert.equal(m.mem.read8(0x8d75), 0x00, "companion cell cleared (HL after dec l)");
  assert.equal(m.mem.read8(0x8f20), 0x00, "0x8f20 cleared");
  assert.equal(m.regs.hl, 0x8d75, "dec l moved HL to 0x8d75");
  assert.equal(m.pc, 0x3553);
  assert.equal(m.regs.sp, 0x8780, "tail call -> baseline");
});

test("loc_3536 MUTATION: `dec (ix+11h)` mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x353c ? 19 : cycles);
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x05);

  loc_3536(m);

  assert.equal(m.tstates, 47, "mutation loses 4 T (23 -> 19)");
  assert.throws(() => assert.equal(m.tstates, 51, "RET_NZ golden"), /51/);
});
