// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated sub_4b10 (ROM 0x4b10, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. The `hwWrites` log records the
 * (addr,value,busOffset) of every store so the hardware write to 0xB000 can be
 * asserted directly.
 *
 * Asserts the T-state total (42), that A stays 0x00 (the unconditional jr must
 * SKIP the `ld a,0x01` at 0x4b14 -- landing there would write 0x01 instead), the
 * store of 0x00 to the LS259 latch at 0xB000 with the ld-(nn),a bus offset of 10,
 * the return to the caller, plus a deliberate MUTATION the T-state assertion must
 * catch (the unconditional jr mis-charged as a not-taken conditional jr, 7T).
 *
 * Run: node --test games/thepit/translated/test/sub_4b10.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { sub_4b10 } from "../sub_4b10.js";

// Minimal machine matching the surface sub_4b10 uses: regs, mem (with a hardware
// write log capturing the busOffset), step, ret, push16/pop16.
function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const hwWrites = [];
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v, busOffset) => {
      ram[a & 0xffff] = v & 0xff;
      hwWrites.push({ addr: a & 0xffff, value: v & 0xff, busOffset });
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
    hwWrites,
    calls: [],
    tstates: 0,
    pc: 0x4b10,
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
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // sub_4b10 makes no calls
    },
  };
}

// Simulate the caller's CALL: seat a return address on the stack so the routine's
// `ret` pops a known value. (Do the seating store BEFORE clearing the hwWrites log
// so the assertion only sees the routine's own store.)
const CALLER_RET = 0xabcd;
function seatCaller(m) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
}

function run(m) {
  seatCaller(m);
  // Poison A so a golden A==0 result can only come from the routine's own
  // `ld a,0x00`, and prove the jr skipped the `ld a,0x01` (which would leave 0x01).
  m.regs.a = 0xff;
  m.hwWrites.length = 0; // drop the seatCaller push; keep only the routine's store
  sub_4b10(m);
}

function assertGolden(m) {
  assert.equal(m.tstates, 42, "T-state total (7 ld a,n + 12 jr + 13 ld(nn),a + 10 ret)");
  assert.equal(m.regs.a, 0x00, "A stays 0x00 -- the jr skipped `ld a,0x01` @4b14");
  assert.equal(m.pc, CALLER_RET, "ret popped the caller's return address");
  assert.deepEqual(m.calls, [], "no calls -- store then ret");
  assert.equal(m.hwWrites.length, 1, "exactly one store -- the latch write");
  const w = m.hwWrites[0];
  assert.equal(w.addr, 0xb000, "store lands on the LS259 latch address 0xB000");
  assert.equal(w.value, 0x00, "latch bit 0 (NMI mask) written 0 -- NOT 0x01");
  assert.equal(w.busOffset, 10, "ld (nn),a write-bus offset is 10");
}

test("sub_4b10: writes A=0x00 to the 0xB000 control latch, 42 T, rets", () => {
  const m = makeMachine();
  run(m);
  assertGolden(m);
});

// -- MUTATION: the T-state total must have teeth ----------------------------------
// Mis-charge the UNCONDITIONAL `jr 0x4b16` (18 dd, 12 T) as if it were a NOT-TAKEN
// conditional jr (7 T) -- a very plausible slip, since a taken conditional jr and
// an unconditional jr are both 12T while a not-taken one is 7T. Confirm the golden
// T-state assertion catches the 5-cycle loss.
test("sub_4b10 MUTATION: unconditional jr mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) =>
    realStep(nextAddr, nextAddr === 0x4b16 ? 7 : cycles); // the jr step

  run(m);

  assert.equal(m.tstates, 37, "mutation loses exactly 5 T (12 -> 7)");
  assert.throws(
    () => assertGolden(m),
    /T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
