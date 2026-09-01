// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0a5f (ROM 0x0a5f-0x0a7f): if [0x20ef]!=0 run helpers 0x18fa/0x097c
// (B saved through C) then write the fetched byte + markers at 0x20f1-0x20f3; either way leave
// HL=0x2062 and ret. The `call` override records AND balances the stack (the real callees ret),
// so the tail `ret` lands on the seated caller. Pins both arms, the writes, T-states, pushes.
//
// Run: node --test games/invaders/translated/test/loc_0a5f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0a5f } from "../loc_0a5f.js";

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
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushed.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seat(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); m.pushed = []; m.calls = []; m.tstates = 0; m.pcSeq = []; m.pc = 0; }
// callee that immediately rets: record + pop the return address a real `ret` would.
function installBal(m) { m.call = (a) => { m.calls.push(a); m.regs.sp = (m.regs.sp + 2) & 0xffff; return undefined; }; }

test("loc_0a5f: [0x20ef]!=0 -> helpers + write 0x20f1-0x20f3, HL=0x2062; 157 T", () => {
  const m = makeMachine();
  seat(m);
  installBal(m);
  m.mem.write8(0x20ef, 0x01);        // non-zero -> jz not taken
  m.regs.b = 0x05;                    // saved through C, restored
  m.regs.hl = 0x2500;                 // 0x097c would set HL; here it is seated for `mov a,m`
  m.mem.write8(0x2500, 0x42);

  loc_0a5f(m);

  assert.equal(m.mem.read8(0x20f3), 0x00, "(0x20f3) := 0");
  assert.equal(m.mem.read8(0x20f2), 0x42, "(0x20f2) := fetched byte");
  assert.equal(m.mem.read8(0x20f1), 0x01, "(0x20f1) := 1");
  assert.equal(m.regs.hl, 0x2062, "HL := 0x2062");
  assert.equal(m.regs.b, 0x05, "B restored from C");
  assert.equal(m.regs.a, 0x42, "A holds the fetched byte");
  assert.deepEqual(m.calls, [0x18fa, 0x097c], "the two helpers, in order");
  assert.deepEqual(m.pushed, [0x0a6c, 0x0a71], "call return addresses");
  assert.equal(m.tstates, 157, "full non-zero-arm T total");
  assert.equal(m.pc, CALLER_RET, "rets to the seated caller");
});

test("loc_0a5f: [0x20ef]==0 -> jz taken, only HL=0x2062; 47 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x20ef, 0x00);

  loc_0a5f(m);

  assert.equal(m.regs.hl, 0x2062, "HL := 0x2062");
  assert.deepEqual(m.calls, [], "no helpers on the zero arm");
  assert.equal(m.tstates, 13 + 4 + 10 + 10 + 10, "lda+ana+jz+lxi+ret");
  assert.equal(m.pc, CALLER_RET, "rets to the seated caller");
});

test("loc_0a5f MUTATION: `call 0x18fa` mis-charged 11T (not 17T) is caught", () => {
  const m = makeMachine();
  seat(m);
  installBal(m);
  m.mem.write8(0x20ef, 0x01);
  m.regs.hl = 0x2500;
  const rs = m.step.bind(m);
  m.step = (n, c) => rs(n, n === 0x18fa ? 11 : c);
  loc_0a5f(m);
  assert.equal(m.tstates, 157 - 6, "mutation loses 6 T (17 -> 11)");
  assert.notEqual(m.tstates, 157, "golden T-state total catches the mutant");
});
