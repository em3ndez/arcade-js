// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_4b40 (ROM 0x4b40, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine). The
 * mock logs every m.call target and counts every m.ret, so the routine's
 * distinctive control flow can be asserted directly:
 *
 *   - A stays 0x90 (the unconditional `jr 0x4b46` must SKIP `ld a,0x00` @4b44 --
 *     falling through would store the sibling's 0x00 instead), and 0x90 is what
 *     lands at work-RAM 0x8057.
 *   - The three real calls fire in order (0x4c11, 0x4c27, 0x4c37), each having
 *     pushed the correct return address (0x4b4c / 0x4b4f / 0x4b52).
 *   - The closing `jp 0x4c1c` is a TAIL-JUMP: 0x4c1c is entered via m.call, NO
 *     m.ret is executed (0x4c1c's own ret returns to OUR caller), and the PC is
 *     left at 0x4c1c -- never back at the caller's seated return address.
 *   - T-state total = 93 (7 + 12 + 13 + 17*3 + 10); the callees are mocked and
 *     charge nothing here.
 *
 * MUTATION: model the tail-jump as a CALL+RET (m.call(0x4c1c) then m.ret()) --
 * the exact trap the convention warns against. It pops the caller's return and
 * charges a spurious +10 T; the golden ret-count / PC / T-state assertions catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_4b40.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4b40 } from "../loc_4b40.js";

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
    pushes: [], // every push16 value (return addresses seated by calls)
    retCount: 0, // number of m.ret invocations -- MUST stay 0 for a tail-jump
    tstates: 0,
    pc: 0x4b40,
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

// Seat a caller return address so that IF the routine wrongly `ret`ed, the PC
// would visibly land back at CALLER_RET instead of the tail target 0x4c1c.
const CALLER_RET = 0xabcd;
function seatCaller(m) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
}

function run(m) {
  seatCaller(m);
  m.regs.a = 0xff; // poison A: a golden A==0x90 can only come from `ld a,0x90`
  m.pushes.length = 0; // drop the seatCaller push; keep only the routine's own
  loc_4b40(m);
}

function assertGolden(m) {
  assert.equal(
    m.tstates,
    93,
    "T-state total (7 ld a,n + 12 jr + 13 ld(nn),a + 17*3 call + 10 jp)",
  );
  assert.equal(m.regs.a, 0x90, "A stays 0x90 -- the jr skipped `ld a,0x00` @4b44");
  assert.equal(m.ram[0x8057], 0x90, "0x90 (not 0x00) stored to work-RAM 0x8057");
  assert.deepEqual(
    m.calls,
    [0x4c11, 0x4c27, 0x4c37, 0x4c1c],
    "three real calls then the tail-jump target, in order",
  );
  assert.deepEqual(
    m.pushes,
    [0x4b4c, 0x4b4f, 0x4b52],
    "each real call pushed the address of its following instruction",
  );
  assert.equal(m.retCount, 0, "tail-jump: NO ret -- 0x4c1c's ret returns to our caller");
  assert.equal(m.pc, 0x4c1c, "PC left at the tail-jump target, not the caller's return");
}

test("loc_4b40: A=0x90 -> 0x8057, three calls, tail-jump to 0x4c1c, 93 T", () => {
  const m = makeMachine();
  run(m);
  assertGolden(m);
});

// -- MUTATION: tail-jump mis-modelled as CALL+RET ---------------------------------
// The convention (loc_0066 header) warns the tail `jp 0x4c1c` is NOT
// `m.call(0x4c1c); m.ret()`. Simulate that slip by making m.call(0x4c1c) also
// perform a ret. The spurious ret pops the stack top (here 0x4b52, the last real
// call's seated return -- the mock's opaque callees don't pop their own, so on
// hardware this would instead be the CALLER's return) and charges +10 T. The PC
// leaves the tail target 0x4c1c, and the golden ret-count / PC / T-state
// assertions must catch it.
test("loc_4b40 MUTATION: tail-jump mis-modelled as call+ret is caught", () => {
  const m = makeMachine();
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    const r = realCall(addr);
    if (addr === 0x4c1c) m.ret(); // the spurious ret the tail-jump must NOT do
    return r;
  };

  run(m);

  assert.equal(m.retCount, 1, "mutation performed one (spurious) ret");
  assert.notEqual(m.pc, 0x4c1c, "mutation's ret moved the PC off the tail target");
  assert.equal(m.pc, 0x4b52, "spurious ret popped the stack top (last call's return)");
  assert.equal(m.tstates, 103, "mutation charges a spurious +10 T (93 -> 103)");
  assert.throws(
    () => assertGolden(m),
    /tail-jump: NO ret|T-state total|tail-jump target/,
    "the golden tail-jump / T-state assertions must fail on the mutant",
  );
});
