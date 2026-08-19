// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for the translated loc_02ef (Pooyan ROM 0x02EF) -- the sprite display-list
 * builder. It copies four groups of object records into the list at 0x8840 (three via loc_032a,
 * one via loc_0343), decrements the two frame counters 0x8898 / 0x889c, then reads 0x881F:
 * non-zero -> `ret nz`; zero -> `call 0x0378` and `ret`.
 *
 * Self-contained mock (real Regs, flat RAM, seated caller). This routine MAKES calls, so the mock's
 * `call` pops the return address the routine pushed (simulating each leaf's own `ret`), keeping SP
 * balanced so the final `ret` recovers the seated caller -- exactly what the real Machine does.
 *
 * Path A (0x881F != 0): four sub-copies, both counters ticked, `ret nz` taken (242 T).
 * Path B (0x881F == 0): same prefix, then `call 0x0378` and `ret` (263 T).
 *
 * TEETH: mis-charge the first `call 0x032a` (CD = 17 T) as a `jp` (10 T) -- a plausible call/jp
 * mix-up. The golden 242 must catch it.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02ef } from "../loc_02ef.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x02ef, pcSeq: [],
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
    // A leaf callee runs and RETs, netting SP unchanged: record the target, pop the return address.
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function setupCounters(m) {
  m.mem.write8(0x8898, 0x05);
  m.mem.write8(0x889c, 0x03);
}

// Each entry is where an instruction LANDS (not the call's pushed return address).
const EXPECTED_PC_SEQ_A = [
  0x02f2, 0x02f6, 0x02f9, 0x02fb, 0x032a, // setup + call 1 (loc_032a)
  0x0302, 0x0304, 0x032a,                 // setup + call 2 (loc_032a)
  0x030b, 0x030d, 0x0343,                 // setup + call 3 (loc_0343)
  0x0314, 0x0316, 0x032a,                 // setup + call 4 (loc_032a)
  0x031c, 0x031d, 0x0320, 0x0321, 0x0324, 0x0325,
  CALLER_RET,                             // ret nz taken
];

test("loc_02ef Path A: 0x881F live -> four sub-copies, counters ticked, ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  setupCounters(m);
  m.mem.write8(0x881f, 0x07); // non-zero -> ret nz taken
  loc_02ef(m);

  assert.equal(m.tstates, 242, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "ends via ret nz (seated caller recovered)");
  assert.deepEqual(m.calls, [0x032a, 0x032a, 0x0343, 0x032a], "the four record-copy calls, in order");
  assert.equal(m.mem.read8(0x8898), 0x04, "counter 0x8898 decremented");
  assert.equal(m.mem.read8(0x889c), 0x02, "counter 0x889c decremented");
  assert.equal(m.regs.a, 0x07, "A = (0x881F), unchanged by `and a`");
  assert.equal(m.regs.sp, 0x8780, "SP balanced back to the caller frame");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_A, "step boundaries match the disassembly");
});

test("loc_02ef Path B: 0x881F == 0 -> call 0x0378 then ret", () => {
  const m = makeMachine();
  seatCaller(m);
  setupCounters(m);
  m.mem.write8(0x881f, 0x00); // zero -> fall through to call 0x0378
  loc_02ef(m);

  assert.equal(m.tstates, 263, "Path B: 231 + 5 (ret nz not taken) + 17 (call) + 10 (ret)");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x032a, 0x032a, 0x0343, 0x032a, 0x0378], "0x0378 pass runs");
  assert.equal(m.mem.read8(0x8898), 0x04);
  assert.equal(m.mem.read8(0x889c), 0x02);
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
});

test("loc_02ef MUTATION: first `call 0x032a` mis-charged 10T (as a jp) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x032a) { first = false; return realStep(nextAddr, 10); }
    return realStep(nextAddr, cycles);
  };
  seatCaller(m);
  setupCounters(m);
  m.mem.write8(0x881f, 0x07);
  loc_02ef(m);
  assert.equal(m.tstates, 235, "mutation loses 7 T (17 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 242, "Path A T-state total"), /T-state total/);
});
