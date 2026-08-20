// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_221e (ROM 0x221e, Pooyan) -- the object-clear helper.
 * HL <- IY via push iy/pop hl, B=0x18, A=0, then rst 0x10 (fill helper loc_0010) blanks 0x18
 * tiles at (HL); ret. Straight-line, one path.
 *
 * The mock's `call` POPS the return address the rst pushed (modelling loc_0010's `ret`); loc_221e
 * uses no register loc_0010 clobbers afterward, so the mock models only the pop. Because the mock
 * pops, dropping the push16 before the rst desyncs the stack (the mock pops the seated CALLER_RET,
 * then the final `ret` pops garbage) -- the SP-baseline + final-pc asserts have real teeth.
 *
 * TEETH: mis-charge `push iy` (15 T) as 11 T -> the 57-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_221e.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_221e } from "../loc_221e.js";

const CALLER_RET = 0xabcd;
const IY = 0x8d00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x221e, pcSeq: [],
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
    // loc_0010's `ret` pops the return address the rst pushed at 0x2224 -- model that pop so the
    // stack stays balanced (a missing push16 then desyncs SP and fails the test).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_MAIN = [0x2220, 0x2221, 0x2223, 0x2224, 0x0010, CALLER_RET];

test("loc_221e: HL<-IY, blank 0x18 tiles via rst 0x10, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.iy = IY;

  loc_221e(m);

  assert.equal(m.tstates, 57, "T-state total: push iy 15 + pop hl 10 + ld b 7 + xor a 4 + rst 11 + ret 10");
  assert.deepEqual(m.pcSeq, PC_MAIN, "step boundaries visit the rst target 0x0010 then the caller ret");
  assert.equal(m.pc, CALLER_RET, "ret returns to the seated caller");
  assert.deepEqual(m.calls, [0x0010], "single call: the rst 0x10 fill helper");
  assert.equal(m.regs.hl, IY, "HL loaded from IY via push iy/pop hl");
  assert.equal(m.regs.b, 0x18, "B = 0x18 (fill count)");
  assert.equal(m.regs.a, 0x00, "A = 0 (xor a, the fill byte)");
  assert.equal(m.regs.fZ, true, "xor a sets Z");
  // The rst's push16 is matched by loc_0010's ret (mock pop), and the final ret pops the seated
  // CALLER_RET -- the stack fully unwinds to baseline. A missing push16 would leave SP off by 2.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (every push16 matched a callee ret)");
});

test("loc_221e MUTATION: `push iy` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x2220 ? 11 : cycles);
  seatCaller(m);
  m.regs.iy = IY;

  loc_221e(m);

  assert.equal(m.tstates, 53, "mutation loses 4 T (15 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 57, "T-state total"),
    /57/,
    "the 57-T golden must fail on the mutant",
  );
});
