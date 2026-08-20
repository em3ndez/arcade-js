// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_5544 (ROM 0x5544, Pooyan) -- actor-table scan/seed loop.
 * Live blocks ((ix+0)|(ix+1) != 0) are skipped (IX += DE, djnz); the first free block is seeded
 * ((ix+17) from table 0x5647 via rst 0x20) and initialised by loc_5489, which ends `pop af; ret`
 * and skip-returns PAST loc_5544. No free block -> the djnz falls out and rets at 0x5563.
 *
 * The mock's `call` POPS the return the call site pushed (models the callee `ret`). For loc_0020
 * (rst 0x20) it also reproduces HL += A; A = (HL) (loc_5544 stores that A to (ix+17)). For loc_5489
 * it pops TWICE and sets pc to the second pop -- exactly the `pop af; ret` skip-return; a missing
 * push16 at that call site then makes the final pop miss CALLER_RET and desyncs SP.
 *
 * Paths: FREE-FIRST (seed on iter 1, skip-return), LIVE-then-FREE (one djnz iter, then seed),
 * ALL-LIVE (djnz exhausts -> ret at 0x5563). MUTATION: `add ix,de` mis-charged 7T (not 15T).
 *
 * Run: node --test games/pooyan/translated/test/loc_5544.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5544 } from "../loc_5544.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5544, pcSeq: [],
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
    call(addr) {
      this.calls.push(addr);
      if (addr === 0x5489) {
        // loc_5489 ends `pop af; ret`: drop the return we pushed, then return past loc_5544.
        this.pop16();
        this.pc = this.pop16();
        return undefined;
      }
      this.pop16(); // normal callee `ret` consumes the pushed return
      if (addr === 0x0020) { regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      return undefined;
    },
  };
}

function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const SEED_HEAD = [0x5545, 0x5548, 0x554b, 0x554d, 0x554f, 0x5552, 0x5555, 0x5557, 0x0020, 0x555b, 0x5489];
const T_SEED = 133; // exx 4 + ld a 19 + or 19 + jr nz nt 7 + ld b 7 + ld hl 10 + ld a 13 + and 7 + rst 11 + ld(ix+17) 19 + call 17

test("loc_5544 FREE-FIRST: iter 1 is free -> seed (ix+17) and skip-return via loc_5489", () => {
  const m = makeMachine();
  seat(m);
  m.regs.ix = 0x8c60;
  m.regs.b = 0x01;
  m.mem.write8(0x8c60, 0x00); m.mem.write8(0x8c61, 0x00); // free block
  m.mem.write8(0x8d13, 0x03);                            // index 3 -> table 0x5647+3
  m.mem.write8(0x564a, 0x2a);                            // rst 0x20 result

  loc_5544(m);

  assert.equal(m.tstates, T_SEED, "FREE-FIRST T-state total");
  assert.deepEqual(m.pcSeq, SEED_HEAD, "step boundaries visit loc_0020 and loc_5489");
  assert.deepEqual(m.calls, [0x0020, 0x5489], "one rst-0x20 + one loc_5489");
  assert.equal(m.mem.read8(0x8c77), 0x2a, "(ix+0x17) = table byte from rst 0x20");
  assert.equal(m.pc, CALLER_RET, "loc_5489 skip-return lands on loc_5544's own caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (push16 balanced by the pop af + ret)");
});

test("loc_5544 LIVE-then-FREE: skip one live block (djnz), seed the second", () => {
  const m = makeMachine();
  seat(m);
  m.regs.ix = 0x8c60;
  m.regs.de = 0x0018;
  m.regs.b = 0x03;
  m.mem.write8(0x8c60, 0x01);                            // block 1 live
  m.mem.write8(0x8c78, 0x00); m.mem.write8(0x8c79, 0x00); // block 2 free
  m.mem.write8(0x8d13, 0x03);
  m.mem.write8(0x564a, 0x2a);

  loc_5544(m);

  assert.equal(m.tstates, 86 + T_SEED, "iter1 live (86) + seed (133)");
  assert.deepEqual(m.pcSeq, [
    0x5545, 0x5548, 0x554b, 0x555e, 0x555f, 0x5561, 0x5544, // iter1 live -> djnz taken
    ...SEED_HEAD,                                          // iter2 free -> seed + skip-return
  ]);
  assert.deepEqual(m.calls, [0x0020, 0x5489]);
  assert.equal(m.mem.read8(0x8c8f), 0x2a, "(block2 ix+0x17) seeded");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
});

test("loc_5544 ALL-LIVE: no free block -> djnz exhausts and rets at 0x5563", () => {
  const m = makeMachine();
  seat(m);
  m.regs.ix = 0x8c60;
  m.regs.de = 0x0018;
  m.regs.b = 0x02;
  m.mem.write8(0x8c60, 0x01); // both live
  m.mem.write8(0x8c78, 0x01);

  loc_5544(m);

  assert.equal(m.tstates, 177, "two live iters (86 + 81) + ret 10");
  assert.deepEqual(m.pcSeq, [
    0x5545, 0x5548, 0x554b, 0x555e, 0x555f, 0x5561, 0x5544, // iter1 djnz taken
    0x5545, 0x5548, 0x554b, 0x555e, 0x555f, 0x5561, 0x5563, // iter2 djnz not taken
    CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [], "no block seeded");
  assert.equal(m.pc, CALLER_RET, "ret at 0x5563 to the seated caller");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_5544 MUTATION: `add ix,de` mis-charged 7T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5561 ? 7 : cycles);
  seat(m);
  m.regs.ix = 0x8c60;
  m.regs.de = 0x0018;
  m.regs.b = 0x02;
  m.mem.write8(0x8c60, 0x01);
  m.mem.write8(0x8c78, 0x01);

  loc_5544(m);

  assert.equal(m.tstates, 177 - 16, "mutation drops 8 T per iter across 2 iters");
  assert.throws(() => assert.equal(m.tstates, 177), /177/, "the 177-T golden must fail on the mutant");
});
