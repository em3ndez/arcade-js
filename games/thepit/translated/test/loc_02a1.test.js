// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_02a1 (ROM 0x02a1, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine). The
 * mock logs every m.call target and counts every m.ret, so this routine's
 * distinctive control flow can be asserted directly.
 *
 * loc_02a1 sequences the sub-phase byte at (0x8002) and dispatches by TAIL-JUMP.
 * It has NO ret — all four exits are jumps whose callee returns to OUR caller —
 * so retCount MUST stay 0 and no return address is ever pushed. The four paths:
 *
 *   1. (0x8002)==1, (0x802d)!=0 : bump (0x8002)->2, `jp nz,0x02ca`   -> loc_02ca, 71 T
 *   2. (0x8002)!=1, (0x802c)!=0 : set  (0x8002)->1, `jr nz,0x02ca`   -> loc_02ca, 81 T
 *   3. (0x8002)!=1, both 0      : set  (0x8002)->2, `jp z,0x0371`    -> loc_0371, 123 T
 *   4. (0x8002)!=1, 802c=0,802d!=0: set (0x8002)->2, jp z NOT taken  -> loc_02ca, 123 T
 *
 * MUTATION: model the tail-jump as a CALL+RET (m.call(target) then m.ret()) --
 * the exact trap the thepit convention warns against. The spurious ret pops the
 * caller's seated return and charges +10 T; the golden ret-count / PC / T-state
 * assertions catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_02a1.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02a1 } from "../loc_02a1.js";

const CALLER_RET = 0xabcd; // a wrong ret would visibly land the PC here

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
    },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs,
    mem,
    ram,
    calls: [], // every m.call target, in order
    pushes: [], // every push16 value -- a tail-jump pushes NOTHING
    retCount: 0, // number of m.ret invocations -- MUST stay 0 for tail-jumps
    tstates: 0,
    pc: 0x02a1,
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
    },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
      this.pushes.push(v & 0xffff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) {
      this.retCount += 1;
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callees are opaque here; they charge/pop nothing
    },
  };
}

// Seat a caller return so that IF the routine wrongly `ret`ed, the PC would
// visibly land back at CALLER_RET instead of the tail target.
function setup(m, phase, c802c, c802d) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
  m.pushes.length = 0; // drop the seat push; keep only the routine's own (none)
  m.ram[0x8002] = phase;
  m.ram[0x802c] = c802c;
  m.ram[0x802d] = c802d;
  m.regs.a = 0x55; // poison A: a golden A can only come from the routine's loads
}

// -- Path 1: (0x8002)==1 && (0x802d)!=0 -> jp nz,0x02ca, 71 T -----------------
test("loc_02a1 path1: phase 1, 802d!=0 -> (0x8002)=2, tail-jump 0x02ca, 71 T", () => {
  const m = makeMachine();
  setup(m, 0x01, 0x00, 0x07);
  loc_02a1(m);
  assert.equal(m.ram[0x8002], 0x02, "(0x8002) bumped 1 -> 2 by inc a");
  assert.deepEqual(m.calls, [0x02ca], "tail-jump target loc_02ca via jp nz");
  assert.equal(m.retCount, 0, "tail-jump: NO ret -- callee returns to our caller");
  assert.deepEqual(m.pushes, [], "a jump pushes no return address");
  assert.equal(m.pc, 0x02ca, "PC left at the tail target, not the caller's return");
  assert.equal(m.tstates, 71, "13+7+7+4+13+13+4+10");
});

// -- Path 2: (0x8002)!=1 && (0x802c)!=0 -> jr nz,0x02ca, 81 T -----------------
test("loc_02a1 path2: phase 0, 802c!=0 -> (0x8002)=1, tail-jump 0x02ca, 81 T", () => {
  const m = makeMachine();
  setup(m, 0x00, 0x09, 0x00);
  loc_02a1(m);
  assert.equal(m.ram[0x8002], 0x01, "(0x8002) set to 1 at loc_02b3");
  assert.deepEqual(m.calls, [0x02ca], "tail-jump target loc_02ca via jr nz");
  assert.equal(m.retCount, 0, "no ret");
  assert.equal(m.pc, 0x02ca, "PC at tail target");
  assert.equal(m.tstates, 81, "13+7+12(jr taken)+7+13+13+4+12(jr taken)");
});

// -- Path 3: (0x8002)!=1, 802c==0, 802d==0 -> jp z,0x0371, 123 T --------------
test("loc_02a1 path3: phase 5, both 0 -> (0x8002)=2, tail-jump 0x0371, 123 T", () => {
  const m = makeMachine();
  setup(m, 0x05, 0x00, 0x00);
  loc_02a1(m);
  assert.equal(m.ram[0x8002], 0x02, "(0x8002) set to 2 before the jp z");
  assert.deepEqual(m.calls, [0x0371], "tail-jump target loc_0371 via jp z");
  assert.equal(m.retCount, 0, "no ret");
  assert.equal(m.pc, 0x0371, "PC at loc_0371");
  assert.equal(m.tstates, 123, "13+7+12+7+13+13+4+7+7+13+13+4+10");
});

// -- Path 4: (0x8002)!=1, 802c==0, 802d!=0 -> jp z NOT taken -> loc_02ca ------
test("loc_02a1 path4: phase 5, 802c=0, 802d!=0 -> fall-through to 0x02ca, 123 T", () => {
  const m = makeMachine();
  setup(m, 0x05, 0x00, 0x03);
  loc_02a1(m);
  assert.equal(m.ram[0x8002], 0x02, "(0x8002) set to 2");
  assert.deepEqual(m.calls, [0x02ca], "jp z NOT taken -> fall into loc_02ca");
  assert.equal(m.retCount, 0, "no ret");
  assert.equal(m.pc, 0x02ca, "PC at loc_02ca (fall-through, jp z still 10 T)");
  assert.equal(m.tstates, 123, "same 123 T -- jp z costs 10 whether taken or not");
});

// -- MUTATION: tail-jump mis-modelled as CALL+RET is caught -------------------
// The convention warns the tail `jp`/`jr` into loc_02ca/loc_0371 is NOT
// `m.call(target); m.ret()`. Simulate that slip by making the tail m.call also
// perform a ret. The spurious ret pops the caller's seated return (CALLER_RET,
// since the mock's opaque callees don't pop their own) and charges +10 T. The
// golden ret-count / PC / T-state assertions must catch it.
test("loc_02a1 MUTATION: tail-jump mis-modelled as call+ret is caught", () => {
  const m = makeMachine();
  setup(m, 0x01, 0x00, 0x07); // path 1: tail-jump to 0x02ca
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    const r = realCall(addr);
    if (addr === 0x02ca) m.ret(); // the spurious ret the tail-jump must NOT do
    return r;
  };

  loc_02a1(m);

  assert.equal(m.retCount, 1, "mutation performed one (spurious) ret");
  assert.equal(m.pc, CALLER_RET, "spurious ret popped the caller's seated return");
  assert.notEqual(m.pc, 0x02ca, "mutation's ret moved the PC off the tail target");
  assert.equal(m.tstates, 81, "mutation charges a spurious +10 T (71 -> 81)");

  // And the golden assertions from path 1 must fail on this mutant.
  assert.throws(
    () => {
      assert.equal(m.retCount, 0, "tail-jump: NO ret");
    },
    /NO ret/,
    "the golden ret-count assertion must fail on the mutant",
  );
});
