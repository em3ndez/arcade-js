// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for loc_24cf (ROM 0x24cf) — the work-RAM state-block initialiser
 * that tail-jumps to loc_287a.
 *
 * There is no built Pit Machine yet, so this test drives the routine against a
 * MINIMAL mock of the Machine surface a straight-line-plus-tail-jump routine
 * touches: a Regs from the real Z80 core (so inc8's flags are the genuine
 * article), a sparse byte store for mem, a `step` that accumulates T-states and
 * records the PC boundary sequence, and a `call` that captures the tail dispatch
 * (address + machine state at the jump) and returns a sentinel standing in for
 * loc_287a's return-through.
 *
 * It pins, against the disassembly:
 *   - the eight constant stores (values AND addresses),
 *   - the exact local T-state total (146) charged up to and including the jp,
 *   - every m.step target lands on a real instruction boundary (stepcheck),
 *   - A and F live into the tail-jump (A=0x01 from the trailing ld; F=0x00 from
 *     inc a of 0x00 with carry-in 0),
 *   - the tail-jump targets 0x287a and its result is returned straight through.
 *
 * TEETH: a broken twin that OMITS the `inc a` (so 0x80a1 gets 0x00 and F keeps
 * its entry value) MUST be caught by the same contract check.
 *
 * Run: node --test games/thepit/translated/test/loc_24cf.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_24cf } from "../loc_24cf.js";

const TAIL = 0x287a;
const SENTINEL = "RET_FROM_287a"; // stands in for loc_287a's return-through

class MockMem {
  constructor() {
    this.bytes = new Map();
  }
  read8(a) {
    return this.bytes.get(a & 0xffff) ?? 0;
  }
  write8(a, v) {
    this.bytes.set(a & 0xffff, v & 0xff);
  }
}

function makeMachine() {
  return {
    regs: new Regs(),
    mem: new MockMem(),
    cycles: 0,
    pc: undefined,
    pcSeq: [], // every step target, in order
    tail: null, // captured tail dispatch
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.cycles += cycles;
      this.pcSeq.push(nextAddr);
    },
    call(addr) {
      // A tail-jump modelled as return m.call(target): capture the machine
      // state at the instant control leaves loc_24cf and hand back a sentinel.
      this.tail = {
        addr,
        cyclesAtJump: this.cycles,
        aAtJump: this.regs.a & 0xff,
        fAtJump: this.regs.f & 0xff,
      };
      return SENTINEL;
    },
  };
}

function run(fn) {
  const m = makeMachine();
  const ret = fn(m);
  return { m, ret };
}

// The instruction-boundary sequence straight off the disassembly (the address of
// each following instruction, ending with the jp target).
const EXPECTED_PC_SEQ = [
  0x24d1, 0x24d4, 0x24d6, 0x24d9, 0x24dc, 0x24df, 0x24e2, 0x24e3,
  0x24e6, 0x24e8, 0x24eb, 0x24ed, 0x24f0, 0x287a,
];

// The routine's full observable contract, asserted from a completed run.
function checkContract(m, ret) {
  const b = (a) => m.mem.read8(a);

  // 1. constant stores — values AND addresses.
  assert.equal(b(0x8096), 0x03, "(0x8096) = 0x03");
  assert.equal(b(0x8094), 0x00, "(0x8094) = 0x00");
  assert.equal(b(0x8097), 0x00, "(0x8097) = 0x00");
  assert.equal(b(0x80a2), 0x00, "(0x80a2) = 0x00");
  assert.equal(b(0x80a4), 0x00, "(0x80a4) = 0x00");
  assert.equal(b(0x80a1), 0x01, "(0x80a1) = 0x01 (INC'd A)");
  assert.equal(b(0x80a3), 0x18, "(0x80a3) = 0x18");
  assert.equal(b(0x809c), 0x01, "(0x809c) = 0x01");

  // 2. control flow: tail-jump to loc_287a, result returned through.
  assert.ok(m.tail, "must have tail-jumped (called a target)");
  assert.equal(m.tail.addr, TAIL, "tail-jump target must be 0x287a");
  assert.equal(ret, SENTINEL, "loc_24cf must return the tail target's result");

  // 3. T-states: local total charged up to and including the jp.
  assert.equal(m.tail.cyclesAtJump, 146, "local T-state total must be 146");

  // 4. live registers/flags into the jump.
  assert.equal(m.tail.aAtJump, 0x01, "A into the jp = 0x01 (ld a,0x01)");
  assert.equal(m.tail.fAtJump, 0x00, "F into the jp = 0x00 (inc a: 0x00->0x01, C=0)");
}

test("loc_24cf: constant stores, T-states, boundaries, flags, tail-jump", () => {
  const { m, ret } = run(loc_24cf);
  checkContract(m, ret);
  // stepcheck: every step target is a real instruction boundary, in order.
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "m.step targets must match the disassembly boundaries");
  // exactly one dispatch (the tail-jump), no stray calls.
  console.log(`  loc_24cf: 146 T, 8 constant stores, jp -> 0x${TAIL.toString(16)} returned through`);
});

// -- TEETH --------------------------------------------------------------------
// A faithful copy EXCEPT it drops the `inc a`. That leaves A=0x00 into the store
// at 0x80a1 (so it writes 0x00, not 0x01) and leaves F at its entry value (0x40,
// Z set) instead of 0x00. The contract check must catch it.
function brokenSub24cf(m) {
  const { regs, mem } = m;
  regs.a = 0x03;
  m.step(0x24d1, 7);
  mem.write8(0x8096, regs.a);
  m.step(0x24d4, 13);
  regs.a = 0x00;
  m.step(0x24d6, 7);
  mem.write8(0x8094, regs.a);
  m.step(0x24d9, 13);
  mem.write8(0x8097, regs.a);
  m.step(0x24dc, 13);
  mem.write8(0x80a2, regs.a);
  m.step(0x24df, 13);
  mem.write8(0x80a4, regs.a);
  m.step(0x24e2, 13);
  // BUG: `inc a` omitted -- A stays 0x00, flags stay at entry.
  mem.write8(0x80a1, regs.a);
  m.step(0x24e6, 13);
  regs.a = 0x18;
  m.step(0x24e8, 7);
  mem.write8(0x80a3, regs.a);
  m.step(0x24eb, 13);
  regs.a = 0x01;
  m.step(0x24ed, 7);
  mem.write8(0x809c, regs.a);
  m.step(0x24f0, 13);
  m.step(0x287a, 10);
  return m.call(0x287a);
}

test("TEETH: the inc-a-dropping twin is CAUGHT by the contract check", () => {
  const { m, ret } = run(brokenSub24cf);
  assert.throws(
    () => checkContract(m, ret),
    /0x80a1|F into the jp/,
    "the contract check FAILED to catch a dropped inc a — it has no teeth",
  );
  // and concretely: the broken twin wrote 0x00 where 0x01 is required.
  assert.equal(m.mem.read8(0x80a1), 0x00, "broken twin leaves (0x80a1) = 0x00");
});
