// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_1d3c (ROM 0x1d3c-0x1d6d): cold-teardown -- zero the 0x8806/0x880a/
// 0x880d/0x880e/0x8e51 block, set 0x8805=1 / 0x881f=1 / 0x8f3f=1, run loc_02b9 + loc_0ecf, then
// copy the 0x1e4c table (each byte >>1) into 0x89f0.. until the 0x7f terminator. Self-contained
// mock; returning callees balance SP += 2.
//
// Run: node --test games/pooyan/translated/test/loc_1d3c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1d3c } from "../loc_1d3c.js";

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

test("loc_1d3c: writes reset block, copies one byte >>1 then 0x7f terminator; 249 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x1e4c, 0x10); // first table byte -> srl -> 0x08
  m.mem.write8(0x1e4d, 0x7f); // terminator

  loc_1d3c(m);

  assert.equal(m.tstates, 249, "T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
  assert.deepEqual(m.calls, [0x02b9, 0x0ecf], "delegates");
  assert.equal(m.mem.read8(0x89f0), 0x08, "(0x89f0) = 0x10 >> 1");
  assert.equal(m.mem.read8(0x8805), 0x01, "(0x8805)=1");
  assert.equal(m.mem.read8(0x881f), 0x01, "(0x881f)=1");
  assert.equal(m.mem.read8(0x8f3f), 0x01, "(0x8f3f)=1");
  assert.equal(m.mem.read8(0x8e51), 0x00, "(0x8e51)=0");
  assert.equal(m.pcSeq.filter((p) => p === 0x1d63).length, 2, "loop body runs twice (1 copy + terminator)");
});

test("loc_1d3c MUTATION: dropping the `srl a` step (0x1d68) loses 8 T", () => {
  const m = makeMachine(); seatCaller(m); installBalancingCalls(m);
  m.mem.write8(0x1e4c, 0x10); m.mem.write8(0x1e4d, 0x7f);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1d68 ? 0 : c);
  loc_1d3c(m);
  assert.equal(m.tstates, 249 - 8, "mutation loses 8 T");
});
