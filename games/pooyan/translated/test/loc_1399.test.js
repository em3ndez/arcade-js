// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1399 (ROM 0x1399, Pooyan) -- state dispatch on (ix+0x06).
 *   a<7    -> tail loc_1389        (jr c)
 *   a>=0x14 -> tail loc_1391       (jr nc)
 *   else timer 0x8d6b nonzero -> dec (hl); ret
 *   else timer zero, B>=0x80 -> ret nc
 *   else timer zero, B<0x80  -> rst 0x20 (loc_0020: A<-mem[HL+A]) picks table 0x13d3[(0x8907)&7],
 *        ld (de),a writes it back to 0x8d6b (DE via ex de,hl), then FALL THROUGH into loc_13bc.
 *
 * The mock's `call` POPS (models the callee's ret consuming the pushed/seated return); for loc_0020
 * it also models A<-mem[(HL+A)] and HL<-HL+A. The one push16 is the rst's return-addr push (0x13bb),
 * balanced by loc_0020's pop; the fall-through tail m.call(loc_13bc) then pops the seated caller, so
 * every path ends at SP baseline. loc_13bc is NOT in this batch -> a flagged boundary.
 *
 * Paths CJR (a<7, T=38), NCJR (a>=0x14, T=52), DEC (timer!=0, T=96), RETNC (timer==0 B>=0x80, T=102),
 * RST (timer==0 B<0x80, T=148). MUTATION: ld a,(ix+0x06) mis-charged 13T (not 19T) is caught.
 *
 * Run: node --test games/pooyan/translated/test/loc_1399.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1399 } from "../loc_1399.js";

const CALLER_RET = 0xabcd;
const BASE = 0x8780;
const TABLE = [0x28, 0x28, 0x20, 0x20, 0x18, 0x18, 0x10, 0x10]; // rst 0x20 lookup table @ 0x13d3

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1399, pcSeq: [],
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
    // Pop the return address the site pushed/seated (models the callee's ret). loc_0020 additionally
    // sets HL<-HL+A then A<-mem[HL]; the tail targets (loc_1389/1391/13bc) only unwind the stack.
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

function seatCaller(m) { m.regs.sp = BASE; m.push16(CALLER_RET); m.regs.ix = 0x8b00; }

test("loc_1399 CJR: (ix+0x06)<7 -> tail loc_1389", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8b06, 0x03);

  loc_1399(m);

  assert.equal(m.tstates, 38, "ld a(19) + cp(7) + jr c taken(12)");
  assert.deepEqual(m.pcSeq, [0x139c, 0x139e, 0x1389]);
  assert.equal(m.pc, 0x1389);
  assert.deepEqual(m.calls, [0x1389]);
  assert.equal(m.regs.sp, BASE, "tail unwinds to baseline");
});

test("loc_1399 NCJR: (ix+0x06)>=0x14 -> tail loc_1391", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8b06, 0x20);

  loc_1399(m);

  assert.equal(m.tstates, 52, "ld a(19)+cp7(7)+jr c not(7)+cp14(7)+jr nc taken(12)");
  assert.deepEqual(m.pcSeq, [0x139c, 0x139e, 0x13a0, 0x13a2, 0x1391]);
  assert.equal(m.pc, 0x1391);
  assert.deepEqual(m.calls, [0x1391]);
  assert.equal(m.regs.sp, BASE, "tail unwinds to baseline");
});

test("loc_1399 DEC: 7<=a<0x14, timer 0x8d6b nonzero -> dec (hl); ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8b06, 0x10);
  m.mem.write8(0x8d6b, 0x05); // nonzero -> Z clear -> jr z not taken

  loc_1399(m);

  assert.equal(m.tstates, 96);
  assert.deepEqual(m.pcSeq, [
    0x139c, 0x139e, 0x13a0, 0x13a2, 0x13a4, 0x13a7, 0x13a8, 0x13a9, 0x13ab, 0x13ac, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d6b), 0x04, "timer decremented");
  assert.equal(m.regs.sp, BASE);
});

test("loc_1399 RETNC: timer zero, B>=0x80 -> ret nc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8b06, 0x10);
  m.mem.write8(0x8d6b, 0x00); // zero -> jr z taken
  m.regs.b = 0x80;            // ld a,b; cp 0x80 -> C clear -> ret nc taken

  loc_1399(m);

  assert.equal(m.tstates, 102);
  assert.deepEqual(m.pcSeq, [
    0x139c, 0x139e, 0x13a0, 0x13a2, 0x13a4, 0x13a7, 0x13a8, 0x13a9,
    0x13ad, 0x13ae, 0x13b0, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, BASE);
});

test("loc_1399 RST: timer zero, B<0x80 -> rst 0x20 lookup + fall through into loc_13bc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8b06, 0x10);
  m.mem.write8(0x8d6b, 0x00); // jr z taken
  m.regs.b = 0x00;            // B<0x80 -> ret nc not taken
  m.mem.write8(0x8907, 0x03); // (0x8907)&7 = 3 -> table[3]
  for (let i = 0; i < TABLE.length; i++) m.mem.write8(0x13d3 + i, TABLE[i]);

  loc_1399(m);

  assert.equal(m.tstates, 148);
  assert.deepEqual(m.pcSeq, [
    0x139c, 0x139e, 0x13a0, 0x13a2, 0x13a4, 0x13a7, 0x13a8, 0x13a9,
    0x13ad, 0x13ae, 0x13b0, 0x13b1, 0x13b2, 0x13b5, 0x13b8, 0x13ba,
    0x0020, 0x13bc,
  ]);
  assert.equal(m.pc, 0x13bc, "fall-through tail lands on loc_13bc");
  assert.deepEqual(m.calls, [0x0020, 0x13bc], "rst -> loc_0020, then tail loc_13bc");
  assert.equal(m.mem.read8(0x8d6b), 0x20, "table[3]=0x20 written back to 0x8d6b via (de)");
  assert.equal(m.regs.hl, 0x13d6, "loc_0020 advanced HL by the index");
  // push16(0x13bb) balanced by loc_0020's pop; tail m.call(loc_13bc) pops the seated caller.
  assert.equal(m.regs.sp, BASE, "every push16 matched a callee ret -> baseline");
});

test("loc_1399 MUTATION: ld a,(ix+0x06) mis-charged 13T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x139c ? 13 : c); // ld a,(ix+d) is 19T, not 13T
  seatCaller(m);
  m.mem.write8(0x8b06, 0x03);

  loc_1399(m);

  assert.equal(m.tstates, 32, "mutation loses 6 T (19 -> 13)");
  assert.throws(() => assert.equal(m.tstates, 38, "Path CJR T-state total"), /38/);
});
