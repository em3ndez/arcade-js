// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0abf (ROM 0x0abf-0x0ace): dispatch on the low bits of [0x20c1] via
// successive RRC -- bit0 -> 0x0abb, bit1 -> 0x1868, bit2 -> 0x0aab (conditional tail-jumps),
// else ret. Seats [0x20c1] to run each arm. Pins the delegate target, T-states, and the ret.
//
// Run: node --test games/invaders/translated/test/loc_0abf.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0abf } from "../loc_0abf.js";

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

test("loc_0abf: [0x20c1]=0 -> no low bit set, falls through to ret; 65 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x20c1, 0x00);

  loc_0abf(m);

  assert.deepEqual(m.calls, [], "no dispatch");
  assert.equal(m.tstates, 13 + 4 + 10 + 4 + 10 + 4 + 10 + 10, "lda + 3x(rrc+jc) + ret");
  assert.equal(m.pc, CALLER_RET, "rets to the seated caller");
  assert.deepEqual(m.pcSeq, [0x0ac2, 0x0ac3, 0x0ac6, 0x0ac7, 0x0aca, 0x0acb, 0x0ace, CALLER_RET], "boundaries");
});

test("loc_0abf: [0x20c1] bit0 set -> jc 0x0abb (delegate); 27 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x20c1, 0x01);

  loc_0abf(m);

  assert.deepEqual(m.calls, [0x0abb], "bit0 dispatches to loc_0abb");
  assert.equal(m.tstates, 13 + 4 + 10, "lda + rrc + jc(taken)");
  assert.equal(m.pc, 0x0abb, "lands at the delegate target");
});

test("loc_0abf: [0x20c1] bit2 set -> jc 0x0aab (third arm); 55 T", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x20c1, 0x04);

  loc_0abf(m);

  assert.deepEqual(m.calls, [0x0aab], "bit2 dispatches to loc_0aab after two clear rrc");
  assert.equal(m.tstates, 13 + 4 + 10 + 4 + 10 + 4 + 10, "lda + 3x rrc + 3rd jc taken");
  assert.equal(m.pc, 0x0aab, "lands at the third delegate target");
});

test("loc_0abf MUTATION: first `rrc` mis-charged 7T (not 4T) is caught", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x20c1, 0x00);
  const rs = m.step.bind(m);
  m.step = (n, c) => rs(n, n === 0x0ac3 ? 7 : c);
  loc_0abf(m);
  assert.equal(m.tstates, 65 + 3, "mutation adds 3 T (4 -> 7)");
  assert.notEqual(m.tstates, 65, "golden T-state total catches the mutant");
});
