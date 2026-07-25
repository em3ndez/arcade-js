// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for sub_4683 (ROM 0x4683) — the "+20 BCD points" scorer that
 * guards on the active-player slot at 0x8001, does a two-byte `daa`-corrected BCD
 * add of BC into the score at 0x8031/0x8034, and TAIL-jumps to sub_46af.
 *
 * There is no built Pit Machine yet, so the routine drives a MINIMAL mock of the
 * Machine surface it touches: a real Regs (so add/adc/daa/dec8/cp flags are the
 * genuine article), a sparse byte store for mem, a `step` that accumulates
 * T-states and records the PC-boundary sequence, a `push16`, a `call` that
 * records dispatch targets (and captures the tail state), and a `ret`.
 *
 * It pins, against the disassembly:
 *   - the guard: slot NOT in {1,2} skips the award and returns via the 0x4672 ret,
 *   - the award: BCD add of 0x20 with inter-byte carry propagation through daa,
 *   - the exact T-state totals (award 138 up to the tail jr; guard 73 incl. ret),
 *   - every m.step target lands on a real instruction boundary (stepcheck),
 *   - the head call 0x4c8f and the tail dispatch to sub_46af (result returned through).
 *
 * TEETH: a twin that DROPS the low-byte `daa` (so 0x8031 keeps 0xA5 and no carry
 * reaches the high byte) MUST be caught by the memory contract.
 *
 * Run: node --test games/thepit/translated/test/sub_4683.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { sub_4683 } from "../sub_4683.js";

const HEAD = 0x4c8f; // the sound/effect kick called at entry
const TAIL = 0x46af; // sub_46af, repaint the digits (tail-jump target)
const SENTINEL = "RET_FROM_46af"; // stands in for sub_46af's return-through

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

function makeMachine(presets = {}) {
  const mem = new MockMem();
  for (const [a, v] of Object.entries(presets)) mem.write8(Number(a), v);
  return {
    regs: new Regs(),
    mem,
    cycles: 0,
    pc: 0x4683,
    pcSeq: [], // every step target, in order
    calls: [], // every m.call target, in order
    pushed: [], // every push16 value
    returned: false,
    tail: null, // captured tail dispatch
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.cycles += cycles;
      this.pcSeq.push(nextAddr);
    },
    push16(v) {
      this.pushed.push(v & 0xffff);
    },
    call(addr) {
      this.calls.push(addr);
      if (addr === TAIL) {
        // tail-jump modelled as `return m.call(0x46af)`: capture state at the jump.
        this.tail = {
          addr,
          cyclesAtJump: this.cycles,
          a: this.regs.a & 0xff,
          f: this.regs.f & 0xff,
        };
        return SENTINEL;
      }
      return undefined; // the head call 0x4c8f (its regs are overwritten downstream)
    },
    ret(cycles = 10) {
      this.returned = true;
      this.cycles += cycles;
      this.pc = "RET";
    },
  };
}

function run(fn, presets) {
  const m = makeMachine(presets);
  const ret = fn(m);
  return { m, ret };
}

// Award-path setup: slot=1 (awards), score 0x1285. Adding 0x20 BCD -> 0x1305,
// which forces a daa carry out of the low byte (0x85+0x20=0xA5 -> daa 0x05 c=1)
// and its propagation into the high byte (0x12 + carry -> 0x13).
const AWARD = { 0x8001: 0x01, 0x8031: 0x85, 0x8034: 0x12 };

// Instruction-boundary sequence of the award path, straight off the disassembly.
const AWARD_PC_SEQ = [
  0x4c8f, 0x4689, 0x468c, 0x468d, 0x468f, 0x4691, 0x4694, 0x4695,
  0x4696, 0x4699, 0x469c, 0x469d, 0x469e, 0x46a1, 0x46af,
];

// The award path's full observable contract (shared by real routine and mutant).
function checkAwardContract(m, ret) {
  const b = (a) => m.mem.read8(a);
  // BCD add with inter-byte carry: 0x1285 + 0x0020 = 0x1305.
  assert.equal(b(0x8031), 0x05, "(0x8031) low BCD byte = 0x05 (0x85+0x20, daa carry out)");
  assert.equal(b(0x8034), 0x13, "(0x8034) high BCD byte = 0x13 (0x12 + inter-byte carry)");
  // control flow: tail-jumped to sub_46af, its result returned through.
  assert.ok(m.tail, "must have tail-jumped");
  assert.equal(m.tail.addr, TAIL, "tail target must be sub_46af (0x46af)");
  assert.equal(ret, SENTINEL, "sub_4683 must return the tail target's result");
  assert.deepEqual(m.calls, [HEAD, TAIL], "exactly the head call then the tail dispatch");
  assert.equal(m.tail.a, 0x13, "A live into the tail jr = high byte 0x13");
  // T-states charged up to and including the tail jr.
  assert.equal(m.tail.cyclesAtJump, 138, "award-path local T-state total = 138");
}

test("award: BCD +0x20 with daa carry propagation, then tail-jump to sub_46af", () => {
  const { m, ret } = run(sub_4683, AWARD);
  checkAwardContract(m, ret);
  // the head call pushed the correct return address.
  assert.deepEqual(m.pushed, [0x4686], "call 0x4c8f pushed return address 0x4686");
  // stepcheck: every step boundary matches the disassembly, in order.
  assert.deepEqual(m.pcSeq, AWARD_PC_SEQ, "m.step targets must match the disassembly boundaries");
  assert.equal(m.returned, false, "the tail-jump does not go through m.ret() here");
  console.log(`  sub_4683 award: 138 T, 0x1285+0x20=0x1305, tail -> 0x${TAIL.toString(16)}`);
});

test("guard: slot NOT in {1,2} skips the award and returns via the 0x4672 ret", () => {
  // slot=5 -> dec a=4, cp 0x02 -> NC -> jr taken to the bare ret; no score change.
  const { m, ret } = run(sub_4683, { 0x8001: 0x05, 0x8031: 0x85, 0x8034: 0x12 });
  assert.equal(m.mem.read8(0x8031), 0x85, "low byte unchanged (award skipped)");
  assert.equal(m.mem.read8(0x8034), 0x12, "high byte unchanged (award skipped)");
  assert.equal(m.returned, true, "returned via the shared ret at 0x4672");
  assert.equal(ret, undefined, "guard path returns nothing (early return)");
  assert.equal(m.tail, null, "no tail-jump on the guard path");
  assert.deepEqual(m.calls, [HEAD], "only the head call fired");
  // 17 + 10 + 13 + 4 + 7 + 12(jr taken) + 10(ret) = 73 T
  assert.equal(m.cycles, 73, "guard-path total = 73 T");
  assert.deepEqual(
    m.pcSeq,
    [0x4c8f, 0x4689, 0x468c, 0x468d, 0x468f, 0x4672],
    "guard boundaries: head call, scorer prefix, then the 0x4672 ret slot",
  );
  console.log("  sub_4683 guard: 73 T, jr nc -> ret @0x4672, score untouched");
});

test("slot=2 also awards (boundary of the cp 0x02 guard)", () => {
  // slot=2 -> dec a=1, cp 0x02 -> carry set -> jr NOT taken -> award.
  const { m } = run(sub_4683, { 0x8001: 0x02, 0x8031: 0x00, 0x8034: 0x00 });
  assert.equal(m.mem.read8(0x8031), 0x20, "0x00 + 0x20 = 0x20 (slot 2 awards)");
  assert.ok(m.tail, "slot 2 reaches the tail-jump");
});

// -- TEETH --------------------------------------------------------------------
// A faithful copy EXCEPT it DROPS the low-byte `daa` (regs.daa() at 0x4695),
// keeping its m.step so timing/boundaries are identical. Then 0x85+0x20=0xA5 is
// stored raw (not 0x05) and no carry reaches the high byte (0x12 stays 0x12).
// Only the memory contract can catch it -- proving those assertions have teeth.
function brokenSub4683(m) {
  const { regs, mem } = m;
  m.push16(0x4686);
  m.step(0x4c8f, 17);
  m.call(0x4c8f);
  regs.bc = 0x0020;
  m.step(0x4689, 10);
  regs.a = mem.read8(0x8001);
  m.step(0x468c, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x468d, 4);
  regs.cp(0x02);
  m.step(0x468f, 7);
  if (regs.fNC) {
    m.step(0x4672, 12);
    m.ret();
    return;
  }
  m.step(0x4691, 7);
  regs.a = mem.read8(0x8031);
  m.step(0x4694, 13);
  regs.add(regs.c);
  m.step(0x4695, 4);
  // BUG: `daa` omitted -- low byte stored raw (0xA5), no BCD carry to the high byte.
  m.step(0x4696, 4);
  mem.write8(0x8031, regs.a);
  m.step(0x4699, 13);
  regs.a = mem.read8(0x8034);
  m.step(0x469c, 13);
  regs.adc(regs.b);
  m.step(0x469d, 4);
  regs.daa();
  m.step(0x469e, 4);
  mem.write8(0x8034, regs.a);
  m.step(0x46a1, 13);
  m.step(0x46af, 12);
  return m.call(0x46af);
}

test("TEETH: the daa-dropping twin is CAUGHT by the memory contract", () => {
  const { m, ret } = run(brokenSub4683, AWARD);
  assert.throws(
    () => checkAwardContract(m, ret),
    /0x8031|0x8034/,
    "the contract FAILED to catch a dropped daa -- it has no teeth",
  );
  // concretely: the broken twin stored the un-corrected 0xA5 and kept the high byte 0x12.
  assert.equal(m.mem.read8(0x8031), 0xa5, "broken twin leaves (0x8031) = 0xA5 (no daa)");
  assert.equal(m.mem.read8(0x8034), 0x12, "broken twin: no inter-byte carry, (0x8034) = 0x12");
});
