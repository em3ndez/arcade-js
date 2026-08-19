// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0e00 (ROM 0x0e00-0x0e45): the new-board actor-table reset.
// Flat-RAM mock (real Regs). rst 0x10 (0x0010) and call 0x02e3 are both pattern-A/plain-ret sites,
// so the stub pops the pushed return via m.ret() -- a record-only stub would hide a stack bug.
//
// Run: node --test games/pooyan/translated/test/loc_0e00.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0e00 } from "../loc_0e00.js";

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
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0e00 full body: 0x8806 != 0 -> seeds actors, clears 0x8f## flags; 333 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8807, 0x55); // cabinet byte -> both actor slots
  m.mem.write8(0x8820, 0x33); // colour byte
  m.mem.write8(0x8806, 0x01); // != 0 -> full body, not the early ret z
  for (const a of [0x8f3f, 0x8f30, 0x8f0e, 0x8f0f]) m.mem.write8(a, 0xee); // sentinel, must be cleared

  loc_0e00(m);

  assert.equal(m.tstates, 333, "full-path T-state total (incl. two stub rets)");
  assert.equal(m.pc, CALLER_RET, "returns via the 0x0e45 ret");
  assert.deepEqual(m.calls, [0x0010, 0x02e3], "rst 0x10 memset then call 0x02e3");
  // zero-fill stores
  for (const a of [0x880a, 0x89e1, 0x89e2, 0x89e3, 0x8f5b]) assert.equal(m.mem.read8(a), 0, `(${a.toString(16)}) cleared`);
  // seeded actor slots
  assert.equal(m.mem.read8(0x8948), 0x55); assert.equal(m.mem.read8(0x8988), 0x55);
  assert.equal(m.mem.read8(0x8941), 0x20); assert.equal(m.mem.read8(0x8981), 0x20);
  assert.equal(m.mem.read8(0x8940), 0x33); assert.equal(m.mem.read8(0x8980), 0x33);
  // late clears (ret z not taken)
  for (const a of [0x8f3f, 0x8f30, 0x8f0e, 0x8f0f]) assert.equal(m.mem.read8(a), 0, `(${a.toString(16)}) cleared`);
  assert.equal(m.regs.b, 0xbf, "B = fill count");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq,
    [0x0e03, 0x0e04, 0x0e07, 0x0e0a, 0x0e0d, 0x0e10, 0x0e13, 0x0e15, 0x0010, 0x0e16,
     0x0e19, 0x0e1c, 0x0e1f, 0x0e21, 0x0e24, 0x0e27, 0x0e2a, 0x0e2d, 0x0e30, 0x02e3,
     0x0e33, 0x0e36, 0x0e37, 0x0e38, 0x0e39, 0x0e3c, 0x0e3f, 0x0e42, 0x0e45, CALLER_RET],
    "full-path op boundaries");
});

test("loc_0e00 early ret: 0x8806 == 0 -> ret z, 0x8f## flags untouched; 273 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8807, 0x11);
  m.mem.write8(0x8820, 0x22);
  m.mem.write8(0x8806, 0x00); // == 0 -> early ret z
  for (const a of [0x8f3f, 0x8f30, 0x8f0e, 0x8f0f]) m.mem.write8(a, 0x7d); // sentinel, must survive

  loc_0e00(m);

  assert.equal(m.tstates, 273, "early-return T-state total (ret z taken)");
  assert.equal(m.pc, CALLER_RET, "ret z returns to caller");
  assert.deepEqual(m.calls, [0x0010, 0x02e3], "still ran the rst + call before the gate");
  for (const a of [0x8f3f, 0x8f30, 0x8f0e, 0x8f0f]) assert.equal(m.mem.read8(a), 0x7d, `(${a.toString(16)}) NOT cleared on early ret`);
  assert.ok(!m.pcSeq.includes(0x0e38), "0x0e38 body skipped (ret z taken)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_0e00 MUTATION: ret z at 0x0e37 mis-charged 5T (not-taken) on the taken path is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00); // taken path -> ret z should charge 11
  const realRet = m.ret.bind(m);
  let firstBody = 0;
  // Force the final routine ret (the ret z) to charge 5 instead of 11.
  m.ret = (c = 10) => { firstBody++; return realRet(firstBody === 3 ? 5 : c); };

  loc_0e00(m);

  assert.equal(m.tstates, 267, "mutation loses 6 T (11 -> 5)");
  assert.notEqual(m.tstates, 273, "golden T-state total catches the mutant");
});
