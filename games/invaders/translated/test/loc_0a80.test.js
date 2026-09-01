// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0a80 (ROM 0x0a80-0x0a92): set 0x20c1=2, spin (loc_0a85) strobing OUT 0x06
// while [0x20cb]==0, then clear A and 0x20c1 and ret. The mock records OUT via io.portOut. A read
// hook drives the loop across iterations (single-threaded: no ISR writes 0x20cb). Pins the strobe
// count, the RAM writes, T-states, and the ret.
//
// Run: node --test games/invaders/translated/test/loc_0a80.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0a80 } from "../loc_0a80.js";

const CALLER_RET = 0xbe2f;

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
    regs, mem, ram, calls: [], pushed: [], tstates: 0, pc: 0, pcSeq: [],
    io: { outs: [], portOut(p, v) { this.outs.push([p, v]); }, portIn() { return 0; } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushed.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seat(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); m.pushed = []; m.calls = []; m.tstates = 0; m.pcSeq = []; m.pc = 0; }

test("loc_0a80: [0x20cb]!=0 -> one OUT 0x06 strobe, clears A and 0x20c1, rets; 84 T", () => {
  const m = makeMachine();
  seat(m);
  m.ram[0x20cb] = 0x01; // release condition already met

  loc_0a80(m);

  assert.deepEqual(m.io.outs, [[0x06, 0x02]], "one OUT 0x06 with A=0x02");
  assert.equal(m.ram[0x20c1], 0x00, "0x20c1 cleared on release");
  assert.equal(m.regs.a, 0x00, "A cleared by xra a");
  assert.equal(m.tstates, 7 + 13 + (10 + 13 + 4 + 10) + 4 + 13 + 10, "prologue + 1 loop pass + epilogue");
  assert.equal(m.pc, CALLER_RET, "rets to the seated caller");
  assert.deepEqual(m.calls, [], "no delegations");
});

test("loc_0a80: spins while [0x20cb]==0 -> two strobes before release; 121 T", () => {
  const m = makeMachine();
  seat(m);
  let n = 0;
  const rd = m.mem.read8;
  m.mem.read8 = (a) => (a === 0x20cb ? (n++ === 0 ? 0x00 : 0x01) : rd(a));

  loc_0a80(m);

  // 2nd strobe outputs 0: `lda 0x20cb` inside the loop clobbers A with iter-1's read (0) before it.
  assert.deepEqual(m.io.outs, [[0x06, 0x02], [0x06, 0x00]], "strobed OUT 0x06 twice (A clobbered by lda)");
  assert.equal(m.ram[0x20c1], 0x00, "0x20c1 cleared on release");
  assert.equal(m.tstates, 7 + 13 + 2 * (10 + 13 + 4 + 10) + 4 + 13 + 10, "prologue + 2 loop passes + epilogue");
  assert.equal(m.pc, CALLER_RET, "rets to the seated caller");
});

test("loc_0a80 MUTATION: `out 0x06` mis-charged 4T (not 10T) is caught", () => {
  const m = makeMachine();
  seat(m);
  m.ram[0x20cb] = 0x01;
  const rs = m.step.bind(m);
  m.step = (n, c) => rs(n, n === 0x0a87 ? 4 : c);
  loc_0a80(m);
  assert.equal(m.tstates, 84 - 6, "mutation loses 6 T (10 -> 4)");
  assert.notEqual(m.tstates, 84, "golden T-state total catches the mutant");
});
