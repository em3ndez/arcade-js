// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0a25 (ROM 0x0a25-0x0a27): loads HL then tail-falls into loc_0a28.
// Flat-RAM mock, real Regs. The fall-through is a tail hand-off (nothing pushed), so the stub rets
// to model loc_0a28's chain returning to loc_0a25's own caller.
//
// Run: node --test games/pooyan/translated/test/loc_0a25.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0a25 } from "../loc_0a25.js";

const CALLER_RET = 0xabcd;

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
    // tail hand-off: loc_0a28's chain rets to loc_0a25's caller; the stub models that ret.
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0a25: HL = 0x8d41, then tail-delegates to loc_0a28; 20 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0a25(m);

  assert.equal(m.tstates, 20, "ld hl (10) + tail chain ret (10)");
  assert.equal(m.regs.hl, 0x8d41, "HL seeded for loc_0a28");
  assert.equal(m.pc, CALLER_RET, "chain returns to loc_0a25's caller (tail, nothing pushed)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced -- no extra push before the fall-through");
  assert.deepEqual(m.calls, [0x0a28], "delegates to loc_0a28");
  assert.deepEqual(m.pcSeq, [0x0a28, CALLER_RET], "ld hl lands at 0x0a28, then chain rets to caller");
});

test("loc_0a25 MUTATION: ld hl,nn mis-charged 6T (not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0a28 ? 6 : c); // LD HL,nn = 10T
  loc_0a25(m);
  assert.equal(m.tstates, 16, "mutation drops 4 T");
  assert.notEqual(m.tstates, 20, "golden total catches the mis-charged LD HL,nn");
});
