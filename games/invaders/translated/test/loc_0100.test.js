// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0100 (ROM 0x0100-0x013a): exercises the full active path -- 0x2002
// clear (no bail to 0x1538), object at (0x2067:0x2006) active (body runs), B!=0 (cnz 0x013b
// taken), blit via 0x15d3, then loc_0136 clears 0x2000. The record-only mock leaves the internal
// call returns on the stack, so the final ret pops 0x0136 (the last pushed return).
//
// Run: node --test games/invaders/translated/test/loc_0100.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0100 } from "../loc_0100.js";

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

function seat(m) {
  m.regs.sp = 0x2400;
  m.regs.c = 0x00; // untouched by this routine, kept for a clean final HL check
  m.ram[0x2002] = 0x00; // not busy -> no bail to 0x1538
  m.ram[0x2006] = 0x50; // object index (low byte)
  m.ram[0x2067] = 0x20; // object page (high byte) -> HL 0x2050
  m.ram[0x2050] = 0x01; // object active -> body runs (jz not taken)
  m.ram[0x2004] = 0xab; // sprite id byte read at 0x0119
  m.ram[0x2005] = 0x02; // orientation byte -> B!=0 -> cnz 0x013b taken
  m.ram[0x200b] = 0x78; m.ram[0x200c] = 0x56; // lhld 0x200b -> HL 0x5678
}

test("loc_0100: active path with cnz+blit, clears 0x2000; 286 T", () => {
  const m = makeMachine();
  seat(m);

  loc_0100(m);

  assert.equal(m.mem.read8(0x2000), 0x00, "loc_0136 clears 0x2000");
  assert.equal(m.regs.a, 0x00, "A ends 0 (xra a)");
  assert.equal(m.regs.b, 0x10, "B := 0x10 (mvi b before the blit)");
  assert.equal(m.regs.de, 0x1c55, "DE := 0x1c00 + (0xaa ror3), after xchg");
  assert.equal(m.regs.hl, 0x5678, "HL := lhld 0x200b");
  assert.equal(m.tstates, 286, "T total for the cnz-taken active path");
  assert.deepEqual(m.calls, [0x013b, 0x15d3], "cnz 0x013b then call 0x15d3");
  assert.equal(m.mem.read16(0x23fe), 0x012e, "cnz 0x013b pushes return 0x012e");
  assert.equal(m.mem.read16(0x23fc), 0x0136, "call 0x15d3 pushes return 0x0136");
  assert.equal(m.pc, 0x0136, "record-only ret pops the last internal return 0x0136");
});

test("loc_0100 BAIL arm: 0x2002 set -> delegate to 0x1538, no body", () => {
  const m = makeMachine();
  seat(m);
  m.ram[0x2002] = 0x01; // busy -> jnz 0x1538 taken

  loc_0100(m);

  assert.deepEqual(m.calls, [0x1538], "delegates straight to loc_1538");
  assert.equal(m.pc, 0x1538, "last step lands at the bail target");
  assert.equal(m.tstates, 10 + 7 + 4 + 10, "lxi+mov+ana+jnz(taken) only");
  assert.equal(m.mem.read8(0x2000), 0x00, "body never runs -> 0x2000 untouched (0)");
});

test("loc_0100 MUTATION: cnz 0x013b mis-charged 11T (not-taken) not 17T is caught", () => {
  const m = makeMachine();
  seat(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x013b ? 11 : c);
  loc_0100(m);
  assert.notEqual(m.tstates, 286, "golden T-state total catches the mis-charged cnz");
});
