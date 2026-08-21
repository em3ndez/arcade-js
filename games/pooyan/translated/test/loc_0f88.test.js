// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for translated loc_0f88 (ROM 0x0f88-0x0f91, Pooyan) -- the tile-command trampoline:
// emit tile 0x82 via loc_0ea2, then load index 0x1c and tail into loc_0fc3. The popping mock balances
// the push16+call and pops the caller ret on the final tail, so SP lands back at the 0x8780 baseline.
//
// Run: node --test games/pooyan/translated/test/loc_0f88.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f88 } from "../loc_0f88.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0f88, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_0f88: A=0x82 via loc_0ea2, then A=0x1c tail into loc_0fc3", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0f88(m);

  assert.equal(m.tstates, 7 + 17 + 7 + 10, "loc_0f88 T total");
  assert.deepEqual(m.pcSeq, [0x0f8a, 0x0ea2, 0x0f8f, 0x0fc3]);
  assert.equal(m.pc, 0x0fc3, "tail into loc_0fc3");
  assert.deepEqual(m.calls, [0x0ea2, 0x0fc3]);
  assert.equal(m.regs.a, 0x1c, "A holds the second tile index at the tail");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_0f88 MUTATION: call 0x0ea2 mischarged 16T (not 17T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x0ea2 ? 16 : c);

  loc_0f88(m);

  const golden = 7 + 17 + 7 + 10;
  assert.equal(m.tstates, golden - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, golden, "loc_0f88 T total"), /loc_0f88/);
});
