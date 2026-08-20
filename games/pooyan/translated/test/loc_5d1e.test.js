// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_5d1e (ROM 0x5d1e, Pooyan) -- the animation-hold countdown.
 * Leaf routine (no calls). Six path tests cover every branch outcome:
 *   A  gate open (ix+0x0b bit0), active, armed, dec !=0-underflow, phase nonzero -> re-arm + ret
 *   B  as A but phase hits 0 -> (ix+0x16)=0
 *   C  gate via 0x8907 bit0 set -> ret nz at 0x5d29
 *   D  0x8907 bit0 clear, object inactive -> ret z at 0x5d2e
 *   F  active but not armed -> ret z at 0x5d33
 *   G  dec (ix+0x12) still nonzero -> ret nz at 0x5d37
 * Full pcSeq (leaf: entries are step boundaries; last = the seated caller return), T-state total,
 * and memory writes are asserted. TOOTH: mis-charge `dec (ix+0x12)` 11T (not 23T) -> golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_5d1e.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5d1e } from "../loc_5d1e.js";

const CALLER_RET = 0xabcd;
const IX = 0x8c30;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5d1e, pcSeq: [],
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

function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); m.regs.ix = IX; }

test("loc_5d1e A: gate open, active, armed, phase nonzero -> re-arm + ret; 195 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(IX + 0x0b, 0x01); // bit0 set -> jr nz taken
  m.mem.write8(IX + 0x00, 0x01); // active
  m.mem.write8(IX + 0x16, 0x02); // armed (bit1)
  m.mem.write8(IX + 0x12, 0x01); // dec -> 0x00 (ret nz not taken)
  m.mem.write8(IX + 0x13, 0x02); // phase & 3 = 2 (nonzero)

  loc_5d1e(m);

  assert.equal(m.tstates, 195, "Path A T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5d22, 0x5d2a, 0x5d2e, 0x5d2f, 0x5d33, 0x5d34, 0x5d37, 0x5d38,
    0x5d3b, 0x5d3d, 0x5d3f, 0x5d40, 0x5d43, 0x5d47, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(IX + 0x12), 0x00, "hold timer decremented to 0");
  assert.equal(m.mem.read8(IX + 0x13), 0x01, "phase stepped 2 -> 1");
  assert.equal(m.mem.read8(IX + 0x16), 0x01, "re-armed");
});

test("loc_5d1e B: phase hits zero -> (ix+0x16)=0; 177 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(IX + 0x0b, 0x01);
  m.mem.write8(IX + 0x00, 0x01);
  m.mem.write8(IX + 0x16, 0x02);
  m.mem.write8(IX + 0x12, 0x01);
  m.mem.write8(IX + 0x13, 0x00); // phase & 3 = 0 -> jr z taken

  loc_5d1e(m);

  assert.equal(m.tstates, 177, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5d22, 0x5d2a, 0x5d2e, 0x5d2f, 0x5d33, 0x5d34, 0x5d37, 0x5d38,
    0x5d3b, 0x5d3d, 0x5d48, 0x5d4c, CALLER_RET,
  ]);
  assert.equal(m.mem.read8(IX + 0x16), 0x00, "disarmed at phase end");
  assert.equal(m.mem.read8(IX + 0x13), 0x00, "phase untouched");
});

test("loc_5d1e C: 0x8907 bit0 set -> ret nz at 0x5d29; 59 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(IX + 0x0b, 0x00); // bit0 clear -> jr nz not taken
  m.mem.write8(0x8907, 0x01);    // bit0 set -> ret nz taken

  loc_5d1e(m);

  assert.equal(m.tstates, 59, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [0x5d22, 0x5d24, 0x5d27, 0x5d29, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
});

test("loc_5d1e D: 0x8907 bit0 clear, object inactive -> ret z at 0x5d2e; 84 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(IX + 0x0b, 0x00);
  m.mem.write8(0x8907, 0x00); // bit0 clear -> ret nz not taken
  m.mem.write8(IX + 0x00, 0x00); // inactive -> ret z taken

  loc_5d1e(m);

  assert.equal(m.tstates, 84, "Path D T-state total");
  assert.deepEqual(m.pcSeq, [0x5d22, 0x5d24, 0x5d27, 0x5d29, 0x5d2a, 0x5d2e, CALLER_RET]);
});

test("loc_5d1e F: active but not armed -> ret z at 0x5d33; 88 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(IX + 0x0b, 0x01);
  m.mem.write8(IX + 0x00, 0x01);
  m.mem.write8(IX + 0x16, 0x00); // bit1 clear -> ret z taken

  loc_5d1e(m);

  assert.equal(m.tstates, 88, "Path F T-state total");
  assert.deepEqual(m.pcSeq, [0x5d22, 0x5d2a, 0x5d2e, 0x5d2f, 0x5d33, CALLER_RET]);
});

test("loc_5d1e G: hold timer still running -> ret nz at 0x5d37; 116 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(IX + 0x0b, 0x01);
  m.mem.write8(IX + 0x00, 0x01);
  m.mem.write8(IX + 0x16, 0x02);
  m.mem.write8(IX + 0x12, 0x05); // dec -> 0x04 (ret nz taken)

  loc_5d1e(m);

  assert.equal(m.tstates, 116, "Path G T-state total");
  assert.deepEqual(m.pcSeq, [0x5d22, 0x5d2a, 0x5d2e, 0x5d2f, 0x5d33, 0x5d34, 0x5d37, CALLER_RET]);
  assert.equal(m.mem.read8(IX + 0x12), 0x04, "timer decremented but still nonzero");
});

test("loc_5d1e MUTATION: `dec (ix+0x12)` mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5d37 ? 11 : cycles);
  seat(m);
  m.mem.write8(IX + 0x0b, 0x01);
  m.mem.write8(IX + 0x00, 0x01);
  m.mem.write8(IX + 0x16, 0x02);
  m.mem.write8(IX + 0x12, 0x01);
  m.mem.write8(IX + 0x13, 0x02);

  loc_5d1e(m);

  assert.equal(m.tstates, 183, "mutation loses 12 T (23 -> 11)");
  assert.throws(() => assert.equal(m.tstates, 195, "Path A T-state total"), /195/);
});
