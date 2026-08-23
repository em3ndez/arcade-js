// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_1c03 (ROM 0x1c03-0x1c52): a (0x8808) phase-timer gate. Not expired ->
// ret nz. Expired -> 3x loc_05b2 (sound), loc_075d + loc_03e9 (paint), rst 0x38, (0x880a)=0x0e,
// then the (0x89fc) gate: clear -> ret z; set -> build the (0x89fd) stride-2 pointer and copy the
// 0x1754 table (rl a per byte) into 0x89f0.. until the 0x5a terminator. Self-contained mock;
// returning callees balance SP += 2.
//
// Run: node --test games/pooyan/translated/test/loc_1c03.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1c03 } from "../loc_1c03.js";

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
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }
function installBalancingCalls(m) {
  m.call = (a) => {
    m.calls.push(a);
    m.regs.sp = (m.regs.sp + 2) & 0xffff;
    if (a === 0x0010) { m.regs.hl = (m.regs.hl + m.regs.b) & 0xffff; m.regs.b = 0; }
    return undefined;
  };
}

test("loc_1c03 not expired: dec (0x8808) NZ -> ret nz; 32 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8808, 0x05); // -> dec to 0x04, NZ

  loc_1c03(m);

  assert.equal(m.tstates, 32, "not-expired T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.mem.read8(0x8808), 0x04, "phase timer decremented");
  assert.deepEqual(m.calls, [], "no work before the timer expires");
  assert.deepEqual(m.pcSeq, [0x1c06, 0x1c07, CALLER_RET], "boundaries");
});

test("loc_1c03 expired, (0x89fc)=0: sounds+paint+rst38, (0x880a)=0x0e -> ret z; 211 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8808, 0x01); // -> dec to 0, expired
  m.mem.write8(0x89fc, 0x00); // gate clear -> ret z

  loc_1c03(m);

  assert.equal(m.tstates, 211, "expired ret-z T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
  assert.deepEqual(m.calls, [0x05b2, 0x05b2, 0x05b2, 0x075d, 0x03e9, 0x0038], "3 sounds, paint pair, rst 0x38");
  assert.equal(m.mem.read8(0x8808), 0x00, "phase timer expired");
  assert.equal(m.mem.read8(0x880a), 0x0e, "(0x880a) advanced to 0x0e");
});

test("loc_1c03 expired, (0x89fc)!=0: builds (0x89fd) ptr + copies 0x1754 table rl-a until 0x5a; 391 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8808, 0x01); // expired
  m.mem.write8(0x89fc, 0x01); // gate set, B=1 -> pointer advances one stride-2 step
  m.mem.write8(0x1754, 0x08); // first table byte (cp 0x5a -> C set) -> rl -> 0x11
  m.mem.write8(0x1755, 0x5a); // terminator

  loc_1c03(m);

  assert.equal(m.tstates, 391, "expired copy-loop T-state total");
  assert.equal(m.pc, CALLER_RET, "loop exits via ret z at the 0x5a terminator");
  assert.deepEqual(m.calls, [0x05b2, 0x05b2, 0x05b2, 0x075d, 0x03e9, 0x0038, 0x0fc1], "adds loc_0fc1 on this arm");
  assert.equal(m.mem.read8(0x880a), 0x0e, "(0x880a)=0x0e");
  assert.equal(m.mem.read8(0x89fd), 0x47, "(0x89fd) low = 0x8045 + 2");
  assert.equal(m.mem.read8(0x89fe), 0x80, "(0x89fe) high");
  assert.equal(m.mem.read8(0x89ff), 0x07, "(0x89ff) seeded 0x07");
  assert.equal(m.mem.read8(0x89f0), 0x11, "(0x89f0) = rl(0x08) with C from the cp");
  assert.equal(m.pcSeq.filter((p) => p === 0x1c48).length, 2, "copy loop reads two bytes (1 copy + terminator)");
});

test("loc_1c03 MUTATION: dropping the `rl a` step (0x1c4d) loses 8 T", () => {
  const m = makeMachine(); seatCaller(m); installBalancingCalls(m);
  m.mem.write8(0x8808, 0x01); m.mem.write8(0x89fc, 0x01);
  m.mem.write8(0x1754, 0x08); m.mem.write8(0x1755, 0x5a);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1c4d ? 0 : c);
  loc_1c03(m);
  assert.equal(m.tstates, 391 - 8, "mutation loses 8 T");
});
