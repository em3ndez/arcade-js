// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_60d9 (ROM 0x60d9, Pooyan) -- picks actor slot 0x8d1c (or 0x8d1b
 * when I==0 via `ld a,i` parity), marks (slot+0)=1, inits a fresh record at HL through the real
 * call 0x619f (DE=0x0404), sets DE=0xfffd, then tail-jumps the scan continuation 0x611f (boundary).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`); the
 * real call 0x619f consumes the pushed 0x60ed, and the closing tail-jump to 0x611f consumes the
 * seated CALLER_RET (loc_60d9 hands its frame to the scan chain). loc_60d9 reads nothing back from
 * 0x619f, so the mock models no register effect. push16(0x60ed) balances against those two pops:
 * SP returns to the pre-seat baseline 0x8780 -- a missing push16 leaves it off by 2.
 *
 * Path A (I != 0): jr nz keeps IY=0x8d1c, T=103. Path B (I == 0): dec iy -> 0x8d1b, T=108.
 * TOOTH: mis-charge `call 0x619f` (17 T) as 10 T -> the 103-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_60d9.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_60d9 } from "../loc_60d9.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x60d9, pcSeq: [],
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
    // The callee's `ret` pops the address the call site pushed -- model that pop so the stack stays
    // balanced (a missing push16 then desyncs SP and fails the baseline tooth). loc_60d9 reads no
    // register back from 0x619f, so no net register effect is modelled here.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_A = [0x60dd, 0x60df, 0x60e3, 0x60e7, 0x60ea, 0x619f, 0x60f0, 0x611f];

test("loc_60d9 Path A: I != 0 -> keep slot 0x8d1c, init record, tail-jump 0x611f", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x0a;     // I != 0 -> ld a,i sets NZ -> jr nz taken
  m.regs.iff2 = false;

  loc_60d9(m);

  assert.equal(m.tstates, 103, "Path A T-state total");
  assert.deepEqual(m.pcSeq, PC_A, "step boundaries visit the call target 0x619f + tail 0x611f");
  assert.equal(m.pc, 0x611f, "tail-jump lands on 0x611f");
  assert.deepEqual(m.calls, [0x619f, 0x611f], "real call 0x619f then tail 0x611f");
  assert.equal(m.regs.iy, 0x8d1c, "IY kept (I != 0)");
  assert.equal(m.mem.read8(0x8d1c), 0x01, "(slot+0) marked 1");
  assert.equal(m.regs.de, 0xfffd, "DE reloaded to 0xfffd after the call");
  // Tail-jump: 0x611f's chain rets to the seated CALLER_RET, so the stack unwinds to the pre-seat
  // baseline. A call site missing its push16 would leave SP off by 2 here -- the stack-fidelity tooth.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (push16 matched by the two pops)");
});

test("loc_60d9 Path B: I == 0 -> dec iy to 0x8d1b", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.i = 0x00;     // I == 0 -> ld a,i sets Z -> jr nz not taken -> dec iy
  m.regs.iff2 = false;

  loc_60d9(m);

  assert.equal(m.tstates, 108, "Path B T-state total (adds dec iy)");
  assert.deepEqual(m.pcSeq, [0x60dd, 0x60df, 0x60e1, 0x60e3, 0x60e7, 0x60ea, 0x619f, 0x60f0, 0x611f]);
  assert.equal(m.pc, 0x611f, "tail-jump lands on 0x611f");
  assert.deepEqual(m.calls, [0x619f, 0x611f]);
  assert.equal(m.regs.iy, 0x8d1b, "IY decremented (I == 0)");
  assert.equal(m.mem.read8(0x8d1b), 0x01, "(slot+0) marked 1 at the decremented slot");
  assert.equal(m.regs.de, 0xfffd);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_60d9 MUTATION: `call 0x619f` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x619f ? 10 : cycles);
  seatCaller(m);
  m.regs.i = 0x0a;
  m.regs.iff2 = false;

  loc_60d9(m);

  assert.equal(m.tstates, 96, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 103, "Path A T-state total"),
    /103/,
    "the 103-T golden must fail on the mutant",
  );
});
