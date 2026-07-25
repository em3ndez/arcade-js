// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_4c63 (ROM 0x4c63, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. The mock logs every m.call target
 * and counts every m.ret so the stub's distinctive control flow can be asserted:
 *
 *   - A becomes 0x05 (the routine's own `ld a,0x05`, overwriting poisoned 0xff),
 *     and since the tail target is mocked opaque, loc_4ca5's `or 0x80` never runs
 *     here, so A stays exactly 0x05.
 *   - The `jr 0x4ca5` is a TAIL-JUMP: 0x4ca5 is entered via m.call, NO m.ret is
 *     executed (loc_4ca5's own ret returns to OUR caller), and the PC is left at
 *     0x4ca5 -- never back at the caller's seated return address.
 *   - T-state total = 19 (7 ld a,n + 12 jr); the mocked callee charges nothing.
 *
 * MUTATION: model the tail-jump as CALL+RET (m.call(0x4ca5) then m.ret()) -- the
 * exact trap the convention warns against. The spurious ret pops the caller's
 * return and charges a spurious +10 T; the golden ret-count / PC / T-state
 * assertions catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_4c63.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4c63 } from "../loc_4c63.js";

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
    retCount: 0, // number of m.ret invocations -- MUST stay 0 for a tail-jump
    tstates: 0,
    pc: 0x4c63,
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
    },
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

// Seat a caller return address so that IF the routine wrongly `ret`ed, the PC
// would visibly land back at CALLER_RET instead of the tail target 0x4ca5.
const CALLER_RET = 0xabcd;
function seatCaller(m) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
}

function run(m) {
  seatCaller(m);
  m.regs.a = 0xff; // poison A: a golden A==0x05 can only come from `ld a,0x05`
  loc_4c63(m);
}

function assertGolden(m) {
  assert.equal(m.tstates, 19, "T-state total (7 ld a,n + 12 jr)");
  assert.equal(m.regs.a, 0x05, "A == 0x05 -- the routine's own ld a,0x05 (poison overwritten)");
  assert.deepEqual(m.calls, [0x4ca5], "single tail-jump target loc_4ca5, via m.call");
  assert.equal(m.retCount, 0, "tail-jump: NO ret -- loc_4ca5's ret returns to our caller");
  assert.equal(m.pc, 0x4ca5, "PC left at the tail-jump target, not the caller's return");
}

test("loc_4c63: A=0x05, tail-jump to loc_4ca5, 19 T, no ret", () => {
  const m = makeMachine();
  run(m);
  assertGolden(m);
});

// -- MUTATION: tail-jump mis-modelled as CALL+RET ---------------------------------
// The convention (loc_4b40 / loc_0066 headers) warns the tail `jr 0x4ca5` is NOT
// `m.call(0x4ca5); m.ret()`. Simulate that slip by making m.call(0x4ca5) also
// perform a ret. The spurious ret pops the stack top (here CALLER_RET -- this stub
// pushes nothing of its own) and charges +10 T. The PC leaves the tail target
// 0x4ca5, and the golden ret-count / PC / T-state assertions must catch it.
test("loc_4c63 MUTATION: tail-jump mis-modelled as call+ret is caught", () => {
  const m = makeMachine();
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    const r = realCall(addr);
    if (addr === 0x4ca5) m.ret(); // the spurious ret the tail-jump must NOT do
    return r;
  };

  run(m);

  assert.equal(m.retCount, 1, "mutation performed one (spurious) ret");
  assert.notEqual(m.pc, 0x4ca5, "mutation's ret moved the PC off the tail target");
  assert.equal(m.pc, CALLER_RET, "spurious ret popped the caller's return address");
  assert.equal(m.tstates, 29, "mutation charges a spurious +10 T (19 -> 29)");
  assert.throws(
    () => assertGolden(m),
    /tail-jump: NO ret|T-state total|tail-jump target/,
    "the golden tail-jump / T-state assertions must fail on the mutant",
  );
});
