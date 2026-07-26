// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_0278 (ROM 0x0278, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine). The
 * mock logs every m.call target and counts every m.ret, so this routine's
 * distinctive control flow — one ordinary call plus four TAIL-JUMP exits — can be
 * asserted directly.
 *
 * loc_0278 guards on (0x8001), decrements (0x802b), calls 0x4632 (which RETURNS),
 * then dispatches by whether (0x8001)==1. It has NO ret of its own; every exit is
 * a jump whose callee returns to OUR caller — so retCount MUST stay 0 and the
 * only return address ever pushed is the ordinary call's (0x028a). Four paths:
 *
 *   A. (0x8001) >= 3           : jp nc  -> loc_03ac,  30 T, (0x802b) untouched
 *   B. (0x8001) != 1 (and <3)  : jr nz  -> loc_02a1, 106 T, after call 0x4632
 *   C. (0x8001) == 1, 802c!=0  : jp nz  -> loc_02ca, 158 T, (0x802d)=0,(0x8002)=1
 *   D. (0x8001) == 1, 802c==0  : jp     -> loc_0371, 168 T, (0x802d)=0,(0x8002)=1
 *
 * MUTATION: model a TAIL-JUMP as a CALL+RET (m.call(target) then m.ret()) -- the
 * exact trap the thepit convention warns against. The spurious ret pops the
 * caller's seated return and charges +10 T; the golden ret-count / PC / T-state
 * assertions catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_0278.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0278 } from "../loc_0278.js";

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
    pushes: [], // every push16 value -- only the ordinary call pushes here
    retCount: 0, // number of m.ret invocations -- MUST stay 0 for tail-jumps
    tstates: 0,
    pc: 0x0278,
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
function setup(m, mode, c802b, c802c) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
  m.pushes.length = 0; // drop the seat push; keep only the routine's own
  m.ram[0x8001] = mode;
  m.ram[0x802b] = c802b;
  m.ram[0x802c] = c802c;
  m.ram[0x802d] = 0x77; // poison: path C/D must write 0 here
  m.ram[0x8002] = 0x77; // poison: path C/D must write 1 here
  m.regs.a = 0x55; // poison A: a golden A can only come from the routine's loads
}

// -- Path A: (0x8001) >= 3 -> jp nc,0x03ac, 30 T, nothing else touched --------
test("loc_0278 path A: (0x8001)>=3 -> tail-jump 0x03ac, 30 T, (0x802b) untouched", () => {
  const m = makeMachine();
  setup(m, 0x03, 0x05, 0x00); // cp 0x03 -> NC (3 >= 3)
  loc_0278(m);
  assert.deepEqual(m.calls, [0x03ac], "bail tail-jump to loc_03ac via jp nc");
  assert.equal(m.retCount, 0, "tail-jump: NO ret -- callee returns to our caller");
  assert.deepEqual(m.pushes, [], "bailed before the ordinary call: nothing pushed");
  assert.equal(m.ram[0x802b], 0x05, "(0x802b) untouched -- bailed before the dec");
  assert.equal(m.pc, 0x03ac, "PC left at the tail target, not the caller's return");
  assert.equal(m.tstates, 30, "13+7+10");
});

// -- Path B: (0x8001) != 1 (and < 3) -> jr nz,0x02a1, 106 T -------------------
test("loc_0278 path B: (0x8001)=2 -> dec (0x802b), call 0x4632, tail-jump 0x02a1, 106 T", () => {
  const m = makeMachine();
  setup(m, 0x02, 0x05, 0x00);
  loc_0278(m);
  assert.equal(m.ram[0x802b], 0x04, "(0x802b) decremented 5 -> 4");
  assert.deepEqual(m.calls, [0x4632, 0x02a1], "ordinary call 0x4632, then tail-jump 0x02a1");
  assert.deepEqual(m.pushes, [0x028a], "only the ordinary call pushed a return (0x028a)");
  assert.equal(m.retCount, 0, "no ret -- the jr nz is a tail-jump");
  assert.equal(m.ram[0x802d], 0x77, "(0x802d) not written on the !=1 path");
  assert.equal(m.pc, 0x02a1, "PC at the tail target loc_02a1");
  assert.equal(m.tstates, 106, "13+7+10+13+4+13+17+13+4+12(jr taken)");
});

// -- Path C: (0x8001)==1, (0x802c)!=0 -> jp nz,0x02ca, 158 T ------------------
test("loc_0278 path C: (0x8001)=1, 802c!=0 -> (0x802d)=0,(0x8002)=1, tail-jump 0x02ca, 158 T", () => {
  const m = makeMachine();
  setup(m, 0x01, 0x05, 0x09); // 802c!=0
  loc_0278(m);
  assert.equal(m.ram[0x802b], 0x04, "(0x802b) decremented");
  assert.equal(m.ram[0x802d], 0x00, "(0x802d) cleared to 0 (A was 0 after dec)");
  assert.equal(m.ram[0x8002], 0x01, "(0x8002) set to 1 by inc a");
  assert.deepEqual(m.calls, [0x4632, 0x02ca], "ordinary call, then tail-jump 0x02ca via jp nz");
  assert.deepEqual(m.pushes, [0x028a], "only the ordinary call pushed");
  assert.equal(m.retCount, 0, "no ret");
  assert.equal(m.pc, 0x02ca, "PC at loc_02ca");
  assert.equal(m.tstates, 158, "94(thru dec)+7(jr not taken)+13+4+13+13+4+10(jp nz taken)");
});

// -- Path D: (0x8001)==1, (0x802c)==0 -> jp 0x0371, 168 T --------------------
test("loc_0278 path D: (0x8001)=1, 802c==0 -> jp nz NOT taken -> tail-jump 0x0371, 168 T", () => {
  const m = makeMachine();
  setup(m, 0x01, 0x05, 0x00); // 802c==0
  loc_0278(m);
  assert.equal(m.ram[0x802d], 0x00, "(0x802d) cleared to 0");
  assert.equal(m.ram[0x8002], 0x01, "(0x8002) set to 1");
  assert.deepEqual(m.calls, [0x4632, 0x0371], "ordinary call, then tail-jump 0x0371 via jp");
  assert.equal(m.retCount, 0, "no ret");
  assert.equal(m.pc, 0x0371, "PC at loc_0371");
  assert.equal(m.tstates, 168, "148(thru and a)+10(jp nz not taken)+10(jp)");
});

// -- MUTATION: tail-jump mis-modelled as CALL+RET is caught -------------------
// The convention warns the tail `jp nc` into loc_03ac is NOT `m.call(target);
// m.ret()`. Simulate that slip by making the tail m.call also perform a ret. The
// spurious ret pops the caller's seated return (CALLER_RET, since the mock's
// opaque callees don't pop their own) and charges +10 T. The golden ret-count /
// PC / T-state assertions must catch it.
test("loc_0278 MUTATION: tail-jump mis-modelled as call+ret is caught", () => {
  const m = makeMachine();
  setup(m, 0x03, 0x05, 0x00); // path A: tail-jump to 0x03ac
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    const r = realCall(addr);
    if (addr === 0x03ac) m.ret(); // the spurious ret the tail-jump must NOT do
    return r;
  };

  loc_0278(m);

  assert.equal(m.retCount, 1, "mutation performed one (spurious) ret");
  assert.equal(m.pc, CALLER_RET, "spurious ret popped the caller's seated return");
  assert.notEqual(m.pc, 0x03ac, "mutation's ret moved the PC off the tail target");
  assert.equal(m.tstates, 40, "mutation charges a spurious +10 T (30 -> 40)");

  // And the golden assertions from path A must fail on this mutant.
  assert.throws(
    () => {
      assert.equal(m.retCount, 0, "tail-jump: NO ret");
    },
    /NO ret/,
    "the golden ret-count assertion must fail on the mutant",
  );
});
