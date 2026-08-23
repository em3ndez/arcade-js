// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_1d15 (ROM 0x1d15-0x1d3b): clear 0xbf bytes at 0x8900 (rst 0x10),
// reseed one player -- (0x880e)==0 -> call z,0x1d0d else call nz,0x1ce7 (exactly one fires; the Z
// of `and a` survives loc_1d0d) -- then either finish the continue path and ret, or (0x8802)==0
// delegate the cold teardown loc_1d3c. Self-contained mock; returning callees balance SP += 2 and
// rst 0x10 applies its HL += B / B = 0 memset.
//
// Run: node --test games/pooyan/translated/test/loc_1d15.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1d15 } from "../loc_1d15.js";

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

test("loc_1d15 fall-through: (0x880e)!=0 -> call nz,0x1ce7; (0x8805)=2/(0x881f)=1; 174 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x880e, 0x05); // nonzero -> and a NZ
  m.mem.write8(0x8802, 0x03); // nonzero -> jr z,0x1d3c not taken

  loc_1d15(m);

  assert.equal(m.tstates, 174, "fall-through T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "both balanced calls + ret balance SP");
  assert.deepEqual(m.calls, [0x0010, 0x1ce7], "rst 0x10 fill, then call nz 0x1ce7");
  assert.equal(m.mem.read8(0x8806), 0x00, "(0x8806)=0");
  assert.equal(m.mem.read8(0x880a), 0x00, "(0x880a)=0");
  assert.equal(m.mem.read8(0x881f), 0x01, "(0x881f)=1");
  assert.equal(m.mem.read8(0x8805), 0x02, "(0x8805)=2");
});

test("loc_1d15 delegate: (0x880e)=0 -> call z,0x1d0d; (0x8802)=0 -> jr z delegate loc_1d3c", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x880e, 0x00); // -> call z,0x1d0d taken
  m.mem.write8(0x8802, 0x00); // -> jr z,0x1d3c taken

  loc_1d15(m);

  assert.deepEqual(m.calls, [0x0010, 0x1d0d, 0x1d3c], "fill, call z, then delegate");
  assert.equal(m.pc, 0x1d3c, "tail-delegates to loc_1d3c");
});

test("loc_1d15 MUTATION: dropping the `ld a,(0x880e)` step (0x1d1f) loses 13 T", () => {
  const m = makeMachine(); seatCaller(m); installBalancingCalls(m);
  m.mem.write8(0x880e, 0x05); m.mem.write8(0x8802, 0x03);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1d1f ? 0 : c);
  loc_1d15(m);
  assert.equal(m.tstates, 174 - 13, "mutation loses 13 T");
});
