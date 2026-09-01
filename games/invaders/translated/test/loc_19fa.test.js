// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_19fa (ROM 0x19fa-0x1a05): call loc_14cb with B:=0x10 until H==0x35,
// then ret. The mock records m.call rather than running loc_14cb (which would pop its return), so
// the final `ret` pops the internal call's pushed 0x19ff -- a record-only artifact pinned below.
// Run: node --test games/invaders/translated/test/loc_19fa.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_19fa } from "../loc_19fa.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_19fa: H already 0x35 -> one pass then ret; 56 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.h = 0x35; // cpi 0x35 -> Z on the first pass

  loc_19fa(m);

  assert.equal(m.regs.b, 0x10, "B := 0x10");
  assert.equal(m.regs.a, 0x35, "A := H");
  assert.equal(m.tstates, 7 + 17 + 5 + 7 + 10 + 10, "T total: one pass + ret");
  assert.deepEqual(m.calls, [0x14cb], "one call to loc_14cb");
  assert.equal(m.mem.read16(0x23fe), 0x19ff, "call 0x14cb pushes return 0x19ff");
  assert.equal(m.pc, 0x19ff, "record-only ret pops the internal call's return");
  assert.equal(m.regs.sp, 0x2400, "SP balanced (one push, one ret pop)");
});

test("loc_19fa: loops until H reaches 0x35 (loc_14cb hook sets H on pass 2); 102 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.h = 0x00;
  let n = 0;
  const realCall = m.call.bind(m);
  m.call = (addr) => { n += 1; m.regs.h = n >= 2 ? 0x35 : 0x00; return realCall(addr); };

  loc_19fa(m);

  assert.deepEqual(m.calls, [0x14cb, 0x14cb], "two passes: H != 0x35 then H == 0x35");
  assert.equal(m.tstates, 46 + 46 + 10, "T total: 2 passes (46 each) + ret");
});

test("loc_19fa MUTATION: `cpi 0x35` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.h = 0x35;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a02 ? 4 : c); // 0x1a02 is the addr AFTER cpi 0x35
  loc_19fa(m);
  assert.notEqual(m.tstates, 56, "golden T-state total catches the mutant");
});
