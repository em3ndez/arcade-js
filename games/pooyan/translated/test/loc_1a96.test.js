// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1a96 (ROM 0x1a96, Pooyan) -- the phase-exhausted handler reached
 * when loc_1a64's 0x8908 phase count hits 0. It calls loc_0f92, bumps 0x880a once (player 0) or twice
 * (player 1, 0x880d nonzero), clears 0x89fc / 0x8931 / 0x8932, tails a call to loc_1ab2 and rets.
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); a call site
 * missing its push16 desyncs the stack, so the terminal ret pops garbage (off-by-two SP, wrong PC) --
 * the stack tooth. Two path tests cover both player branches; a positive control mutates one T-state
 * via a wrapped m.step and confirms the tstates golden fires, then restores.
 *
 * Run: node --test games/pooyan/translated/test/loc_1a96.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1a96 } from "../loc_1a96.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1a96, pcSeq: [],
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
    // The callee's `ret` pops the return the call site pushed -- model that pop so the stack stays
    // balanced. loc_0f92/loc_1ab2 leave no register loc_1a96 branches on, so the stub only pops;
    // a missing push16 then desyncs SP and the terminal ret pops garbage.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// pcSeq shared prefix through `and a` on 0x880d (0x1aa0).
const HEAD = [0x0f92, 0x1a9c, 0x1a9f, 0x1aa0];
// ...and the common tail after the inc(s): xor a, the three clears, the loc_1ab2 call, the ret.
const TAIL = [0x1aa4, 0x1aa5, 0x1aa8, 0x1aab, 0x1aae, 0x1ab2, CALLER_RET];

test("loc_1a96 Path 1: player 0 (0x880d==0) -> single inc of 0x880a", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x880d, 0x00);
  m.mem.write8(0x880a, 0x05);
  m.mem.write8(0x89fc, 0x11);
  m.mem.write8(0x8931, 0x22);
  m.mem.write8(0x8932, 0x33);

  loc_1a96(m);

  assert.deepEqual(m.pcSeq, [...HEAD, 0x1aa3, ...TAIL], "player 0 skips the extra inc");
  assert.equal(m.tstates, 17 + 10 + 13 + 4 + 12 + 11 + 4 + 13 + 13 + 13 + 17 + 10);
  assert.equal(m.mem.read8(0x880a), 0x06, "0x880a bumped once");
  assert.equal(m.mem.read8(0x89fc), 0x00, "0x89fc cleared");
  assert.equal(m.mem.read8(0x8931), 0x00, "0x8931 cleared");
  assert.equal(m.mem.read8(0x8932), 0x00, "0x8932 cleared");
  assert.deepEqual(m.calls, [0x0f92, 0x1ab2]);
  assert.equal(m.pc, CALLER_RET, "terminal ret lands on the caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced back to the pre-seat baseline");
});

test("loc_1a96 Path 2: player 1 (0x880d!=0) -> double inc of 0x880a", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x880d, 0x01);
  m.mem.write8(0x880a, 0x05);

  loc_1a96(m);

  assert.deepEqual(m.pcSeq, [...HEAD, 0x1aa2, 0x1aa3, ...TAIL], "player 1 takes both incs");
  assert.equal(m.tstates, 17 + 10 + 13 + 4 + 7 + 11 + 11 + 4 + 13 + 13 + 13 + 17 + 10);
  assert.equal(m.mem.read8(0x880a), 0x07, "0x880a bumped twice");
  assert.deepEqual(m.calls, [0x0f92, 0x1ab2]);
  assert.equal(m.pc, CALLER_RET, "terminal ret lands on the caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced back to the pre-seat baseline");
});

test("positive control: a mutated jr-z T-state breaks the player-0 tstates golden", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x880d, 0x00);
  m.mem.write8(0x880a, 0x05);

  // Wrap m.step so the jr-z-taken step (to 0x1aa3) charges 7 instead of the real 12.
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1aa3 ? 7 : cycles);

  loc_1a96(m);

  const golden = 17 + 10 + 13 + 4 + 12 + 11 + 4 + 13 + 13 + 13 + 17 + 10;
  assert.notEqual(m.tstates, golden, "control: the mutated jr-z T-state must break the golden");
  assert.equal(m.tstates, golden - 5, "control charged 7 not 12 for the taken jr z");
});
