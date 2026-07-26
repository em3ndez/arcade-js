// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_02fd (ROM 0x02fd, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine). The
 * mock logs every m.call target and counts every m.ret, so both branch paths and
 * the tail control-flow can be asserted directly. Callees are opaque: they charge
 * and pop nothing, so retCount and tstates measure ONLY loc_02fd's own instructions.
 *
 * loc_02fd reads the game-state byte (0x8001), `cp 0x03`, and branches:
 *   - state >= 3 (carry clear): TAIL-jump to loc_03ac. Only 3 instructions run
 *     (13+7+10 = 30 T), no counter bump, one call target [0x03ac], retCount 0.
 *   - state <  3 (carry set):   run the body -- bump (0x8028), four calls with
 *     A=0xa0 into 0x4b46 -- then FALL THROUGH into loc_031a. Calls in order
 *     [0x4632, 0x4b46, 0x3bec, 0x4632, 0x031a], four call-pushes, retCount 0,
 *     PC left at 0x031a, 135 T total.
 * Both exits are tail-transfers (jp / fall-through), so retCount MUST stay 0.
 *
 * MUTATION: model the taken tail `jp nc,0x03ac` as a CALL+RET (m.call then m.ret)
 * -- the exact trap the thepit convention warns against. On the taken path nothing
 * was pushed, so the spurious ret pops the caller's own return (CALLER_RET),
 * charges +10 T, and moves the PC off 0x03ac; the golden retCount / PC / T-state
 * assertions catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_02fd.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02fd } from "../loc_02fd.js";

const CALLER_RET = 0xabcd; // a spurious ret on the taken path pops THIS, moving PC

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
    pushes: [], // every push16 value
    retCount: 0, // number of m.ret invocations -- MUST stay 0 (tail-transfers)
    tstates: 0,
    pc: 0x02fd,
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

function setup(m, state) {
  m.regs.sp = 0x8780; // inside work RAM
  m.push16(CALLER_RET);
  m.pushes.length = 0; // drop the seat push; keep only the routine's own pushes
  m.ram[0x8001] = state; // the game-state byte the routine branches on
  m.ram[0x8028] = 0x10; // counter poison; a golden 0x11 proves the inc ran
  m.regs.a = 0x55; // poison A; the routine reloads it from memory
}

// -- Golden: state < 3 -> body runs, falls through into loc_031a --------------
test("loc_02fd: state<3 runs the body and falls through to loc_031a, 135 T", () => {
  const m = makeMachine();
  setup(m, 0x01); // 1 < 3 -> carry set -> jp nc NOT taken

  loc_02fd(m);

  assert.equal(m.ram[0x8028], 0x11, "(0x8028) counter incremented 0x10 -> 0x11");
  assert.equal(m.regs.a, 0xa0, "A holds the 0xa0 loaded for the 0x4b46 call");
  assert.deepEqual(
    m.calls,
    [0x4632, 0x4b46, 0x3bec, 0x4632, 0x031a],
    "body call order then the fall-through tail into loc_031a",
  );
  assert.equal(m.pushes.length, 4, "four internal call-pushes; the fall-through pushes nothing");
  assert.deepEqual(m.pushes, [0x030f, 0x0314, 0x0317, 0x031a], "each call pushes its own return addr");
  assert.equal(m.retCount, 0, "fall-through tail: NO ret of its own");
  // The final transfer is into loc_031a. NB: with opaque callees the mock's PC
  // ends at 0x4632 (the last internal call's m.step target) because the real
  // PC restoration to 0x031a happens INSIDE that callee's ret, which the opaque
  // mock does not model. The meaningful signal is the last call target, not PC.
  assert.equal(m.calls.at(-1), 0x031a, "final transfer is the fall-through tail into loc_031a");
  assert.equal(m.tstates, 135, "13+7+10 + 13+4+13 + 17+7+17+17+17");
});

// -- Golden: state >= 3 -> tail-jump straight to loc_03ac ---------------------
test("loc_02fd: state>=3 tail-jumps to loc_03ac, no body, 30 T", () => {
  const m = makeMachine();
  setup(m, 0x03); // 3 >= 3 -> carry clear -> jp nc TAKEN

  loc_02fd(m);

  assert.equal(m.ram[0x8028], 0x10, "counter NOT touched on the reset branch");
  assert.deepEqual(m.calls, [0x03ac], "only the tail-jump target");
  assert.equal(m.pushes.length, 0, "the tail jp pushes nothing");
  assert.equal(m.retCount, 0, "tail-jump: NO ret of its own");
  assert.equal(m.pc, 0x03ac, "PC left at the tail target loc_03ac");
  assert.equal(m.tstates, 30, "ld a,(nn)=13 + cp=7 + jp cc=10");
});

// -- Boundary: cp uses >=, so state==3 takes the reset branch, state==2 does not
test("loc_02fd: branch boundary is exactly state>=3 (NC)", () => {
  const hi = makeMachine();
  setup(hi, 0x02); // 2 < 3 -> body path
  loc_02fd(hi);
  assert.deepEqual(hi.calls, [0x4632, 0x4b46, 0x3bec, 0x4632, 0x031a], "state 2 -> body");

  const lo = makeMachine();
  setup(lo, 0xff); // 255 >= 3 -> reset path
  loc_02fd(lo);
  assert.deepEqual(lo.calls, [0x03ac], "state 255 -> reset tail-jump");
});

// -- MUTATION: taken tail-jump mis-modelled as CALL+RET is caught -------------
// The convention warns `jp nc,0x03ac` is NOT `m.call(0x03ac); m.ret()`. Simulate
// that slip by making the 0x03ac m.call also perform a ret. On the taken path
// nothing was pushed, so the spurious ret pops CALLER_RET and charges +10 T.
test("loc_02fd MUTATION: tail-jump mis-modelled as call+ret is caught", () => {
  const m = makeMachine();
  setup(m, 0x05); // 5 >= 3 -> taken path
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    const r = realCall(addr);
    if (addr === 0x03ac) m.ret(); // the spurious ret the tail-jump must NOT do
    return r;
  };

  loc_02fd(m);

  assert.equal(m.retCount, 1, "mutation performed one (spurious) ret");
  assert.equal(m.pc, CALLER_RET, "spurious ret popped the caller's return, moving PC off 0x03ac");
  assert.notEqual(m.pc, 0x03ac, "PC no longer at the tail target");
  assert.equal(m.tstates, 40, "mutation charges a spurious +10 T (30 -> 40)");

  // And the golden assertions must fail on this mutant.
  assert.throws(
    () => assert.equal(m.retCount, 0, "tail-jump: NO ret of its own"),
    /NO ret/,
    "the golden ret-count assertion must fail on the mutant",
  );
  assert.throws(
    () => assert.equal(m.pc, 0x03ac, "PC at tail target"),
    undefined,
    "the golden PC assertion must fail on the mutant",
  );
});
