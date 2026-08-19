// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0010 (ROM 0x0010-0x0014): the rst 0x10 memset helper.
// Self-contained mock machine (real Regs for exact flags, flat 64K RAM, step/call/ret/push16/pop16
// mirroring the pooyan Machine). The routine ends in `ret`, so the seated caller's return proves
// the exit. Run: node --test games/pooyan/translated/test/loc_0010.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0010 } from "../loc_0010.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0010: fill 3 bytes with 0xff at 0x8900, HL advances, B->0; 83 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0xff;
  m.regs.b = 3;
  m.regs.hl = 0x8900;

  loc_0010(m);

  assert.equal(m.tstates, 83, "loc_0010 T-state total (3 * (7+6) + 13+13+8 djnz + 10 ret)");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.ram[0x8900], 0xff, "byte 0 filled");
  assert.equal(m.ram[0x8901], 0xff, "byte 1 filled");
  assert.equal(m.ram[0x8902], 0xff, "byte 2 filled");
  assert.equal(m.ram[0x8903], 0x00, "byte 3 untouched");
  assert.equal(m.regs.hl, 0x8903, "HL = base + count");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.deepEqual(m.pcSeq,
    [0x0011, 0x0012, 0x0010, 0x0011, 0x0012, 0x0010, 0x0011, 0x0012, 0x0014, CALLER_RET],
    "step boundaries (loop lands 0x0010 twice, falls to 0x0014)");
});

test("loc_0010: B=1 -> single write, no loop-back; 31 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x5a;
  m.regs.b = 1;
  m.regs.hl = 0x8420;

  loc_0010(m);

  assert.equal(m.tstates, 31, "one body (7+6) + djnz-not-taken 8 + ret 10 = 31");
  assert.equal(m.ram[0x8420], 0x5a, "single byte filled");
  assert.equal(m.regs.hl, 0x8421, "HL advanced once");
  assert.deepEqual(m.pcSeq, [0x0011, 0x0012, 0x0014, CALLER_RET], "no loop-back to 0x0010");
});

test("loc_0010 MUTATION: djnz-taken mis-charged 8T (not 13T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0xff;
  m.regs.b = 3;
  m.regs.hl = 0x8900;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0010 ? 8 : c); // the taken-djnz landing under-charged
  loc_0010(m);
  assert.equal(m.tstates, 73, "two taken djnz lose 5 T each (13 -> 8)");
  assert.notEqual(m.tstates, 83, "golden T-state total catches the taken/not-taken confusion");
});
