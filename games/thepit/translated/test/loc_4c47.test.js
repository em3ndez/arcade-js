// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4c47 (ROM 0x4c47-0x4c4c, The Pit): DISABLE sound by
// clearing LS259 latch bit 3 (writes 0x00 to 0xb003). Asserts the exact T-state
// total (30), the instruction-boundary step trace, A = 0x00, the latch effect
// (bit 3 CLEARED while every other bit is untouched -- which proves BOTH the
// 0xb003 address AND the 0x00 value), the ret popping the caller, and the
// hardware-write trace (busOffset present -> the 0xb003 store is recorded).
// Ends with a MUTATION (writes 0x01 like the enable-sound sibling loc_4c4d
// instead of 0x00) proven caught by the latch-bit-3 assertion.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4c47 } from "../loc_4c47.js";

const RET = 0x1234; // sentinel return address pushed before the call
const T_TOTAL = 30; // ld a,n 7 + ld (nn),a 13 + ret 10

// Minimal machine: real Regs + real Pit AddressSpace + Io, plus the
// step/ret/push16/pop16 seam this leaf drives (no m.call here). The real Io is
// used so the 0xb003 write drives the actual LS259 latch.
function makeMachine() {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)

  const m = {
    regs,
    mem,
    io,
    tstates: 0,
    pc: 0x4c47,
    steps: [],
    returned: false,
    step(addr, cycles) {
      this.pc = addr;
      this.tstates += cycles;
      this.steps.push(addr);
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
      this.pc = this.pop16();
      this.tstates += cycles;
      this.returned = true;
    },
    call(addr) {
      throw new Error(`unexpected m.call(0x${addr.toString(16).padStart(4, "0")})`);
    },
  };

  // Start with EVERY latch bit set, so clearing bit 3 is an OBSERVABLE change and
  // a wrong address/value shows up as a different final latch byte.
  io.latch = 0xff;

  m.push16(RET); // the return address loc_4c47's `ret` must pop
  return m;
}

test("writes 0x00 to 0xb003 -> clears sound-enable bit 3, then returns", () => {
  const m = makeMachine();
  m.mem.writeTrace = []; // record hardware writes -> exercises the busOffset path
  m.mem.clock = () => m.tstates;

  loc_4c47(m);

  // instruction-boundary trace + cycles
  assert.deepEqual(m.steps, [0x4c49, 0x4c4c], "step targets");
  assert.equal(m.tstates, T_TOTAL, "T-state total (7 + 13 + 10 = 30)");

  // register + latch effect: only bit 3 cleared, all other bits preserved.
  assert.equal(m.regs.a, 0x00, "A = 0x00");
  assert.equal(m.io.latch, 0xf7, "latch bit 3 cleared (0xff -> 0xf7), other bits intact");
  assert.equal(m.io.latch & 0x08, 0, "sound-enable bit 3 is OFF");

  // hardware-write trace: exactly one write, to 0xb003, value 0x00 (busOffset present).
  assert.equal(m.mem.writeTrace.length, 1, "one hardware write recorded");
  assert.equal(m.mem.writeTrace[0].addr, 0xb003, "hardware write is to 0xb003");
  assert.equal(m.mem.writeTrace[0].value, 0x00, "hardware write value is 0x00");

  // control flow: the ret popped the caller's address
  assert.equal(m.returned, true, "reached the ret");
  assert.equal(m.pc, RET, "final PC = the popped return address");
});

// ---- MUTATION: writes 0x01 (the enable-sound sibling loc_4c4d) not 0x00 ------
// Faithful copy of loc_4c47 that loads 0x01 instead of 0x00. Cycles, step trace
// and the ret are all unchanged -- but bit 3 is now SET (latch stays 0xff), so
// the latch assertion is the only tooth that can reject it, and it must.
function loc_4c47_mut(m) {
  const { regs, mem } = m;
  regs.a = 0x01; // BUG: should be 0x00 (this ENABLES sound instead of disabling)
  m.step(0x4c49, 7);
  mem.write8(0xb003, regs.a, 10);
  m.step(0x4c4c, 13);
  m.ret();
}

test("the assertions have teeth: the write-0x01 mutation is caught", () => {
  const good = makeMachine();
  loc_4c47(good);
  assert.equal(good.io.latch, 0xf7, "real routine clears bit 3"); // control

  const bad = makeMachine();
  loc_4c47_mut(bad);
  // The mutant leaves bit 3 SET (latch unchanged at 0xff): same cycles/steps.
  assert.equal(bad.tstates, T_TOTAL, "mutation preserves the cycle total");
  assert.throws(
    () => assert.equal(bad.io.latch, 0xf7, "latch bit 3 cleared"),
    /latch bit 3 cleared/,
    "the latch assertion must reject the write-0x01 mutant (bit 3 left set)",
  );
});
