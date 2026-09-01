// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_17c0 (ROM 0x17c0-0x17cc): flag 0x2067 bit0 (rrc->carry) picks
// the input port -- set -> IN 1, clear -> IN 2. Both arms + a T-state mutation.
// Run: node --test games/invaders/translated/test/loc_17c0.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_17c0 } from "../loc_17c0.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x17c0, pcSeq: [],
    io: { ins: {}, portIn(p) { return this.ins[p] & 0xff || 0; } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

test("loc_17c0 bit0 set: IN 1, rets; 47 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x01); // bit0 set -> rrc leaves carry
  m.io.ins[0x01] = 0x5a;

  loc_17c0(m);

  assert.equal(m.regs.a, 0x5a, "A := IN 1");
  assert.equal(m.tstates, 13 + 4 + 10 + 10 + 10, "lda+rrc+jnc(nt)+in+ret");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.deepEqual(m.pcSeq, [0x17c3, 0x17c4, 0x17c7, 0x17c9, CALLER_RET], "step boundaries");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
});

test("loc_17c0 bit0 clear: IN 2, rets; 47 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x02); // bit0 clear -> rrc clears carry -> jnc taken
  m.io.ins[0x02] = 0x3c;

  loc_17c0(m);

  assert.equal(m.regs.a, 0x3c, "A := IN 2");
  assert.equal(m.tstates, 13 + 4 + 10 + 10 + 10, "lda+rrc+jnc(taken)+in+ret");
  assert.deepEqual(m.pcSeq, [0x17c3, 0x17c4, 0x17ca, 0x17cc, CALLER_RET], "step boundaries");
});

test("loc_17c0 MUTATION: `lda` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x17c3 ? 7 : c);
  loc_17c0(m);
  assert.equal(m.tstates, 7 + 4 + 10 + 10 + 10, "mutation loses 6 T");
  assert.notEqual(m.tstates, 47, "golden T-state total catches the mutant");
});
