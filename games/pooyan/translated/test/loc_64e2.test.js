// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for translated loc_64e2 (ROM 0x64e2, Pooyan) -- the fountain/spawn subtree driver:
// loc_6b13, then dispatch the 0x8c78 record (loc_64fb), the 0x8ae0 bird pass (loc_66c5), and
// loc_6822. Straight-line; no branches. Each push16+call is stack-neutral under the popping mock,
// so a missing push16 would desync SP and the final ret would pop garbage -- the stack tooth.
//
// Run: node --test games/pooyan/translated/test/loc_64e2.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_64e2 } from "../loc_64e2.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x64e2, pcSeq: [],
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

test("loc_64e2: seeds loc_6b13, IX loads, dispatch calls, ret; exact seq + T + SP", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_64e2(m);

  assert.equal(m.tstates, 17 + 14 + 17 + 14 + 14 + 17 + 17 + 10, "straight-line T total");
  assert.deepEqual(m.pcSeq, [0x6b13, 0x64e9, 0x64fb, 0x64f0, 0x64f4, 0x66c5, 0x6822, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [0x6b13, 0x64fb, 0x66c5, 0x6822]);
  assert.equal(m.regs.ix, 0x8ae0, "IX left at the bird-table base (last load)");
  assert.equal(m.regs.iy, 0x8c78, "IY = fountain record base");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_64e2 MUTATION: ld ix,0x8c78 mischarged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x64e9 ? 10 : cycles);
  seatCaller(m);

  loc_64e2(m);

  const golden = 17 + 14 + 17 + 14 + 14 + 17 + 17 + 10;
  assert.equal(m.tstates, golden - 4, "mutation loses 4 T");
  assert.throws(() => assert.equal(m.tstates, golden, "straight-line T total"), /straight-line/);
});
