// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_73ce (ROM 0x73ce-0x73e2): eagle-record state 2 (retire). Clears the record
// (HL:=IX, rst 0x10 fill) then decrements (0x8f3c); pins the ret-nz path. rst 0x10 is a plain-ret call.
//
// Run: node --test games/pooyan/translated/test/loc_73ce.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_73ce } from "../loc_73ce.js";

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
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_73ce: HL:=IX, rst 0x10 clear, dec (0x8f3c) !=0 -> ret nz; 88 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8f3c, 0x02); // dec -> 1 (nz)

  loc_73ce(m);

  assert.equal(m.tstates, 8 + 4 + 8 + 4 + 4 + 7 + 11 + 10 + 10 + 11 + 11, "88 T");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.equal(m.regs.hl, 0x8f3c, "HL reloaded to the count address after the fill");
  assert.equal(m.mem.read8(0x8f3c), 0x01, "live-record count decremented");
  assert.deepEqual(m.calls, [0x0010], "record cleared via rst 0x10");
  assert.deepEqual(m.pcSeq, [0x73d0, 0x73d1, 0x73d3, 0x73d4, 0x73d5, 0x73d7, 0x0010, 0x73d8, 0x73db, 0x73dc, CALLER_RET], "boundaries");
});

test("loc_73ce MUTATION: ld a,ixl at 0x73ce mischarged 4T (not 8T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8f3c, 0x02);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x73d0 ? 4 : c);
  loc_73ce(m);
  assert.notEqual(m.tstates, 88, "golden 88 T catches the mischarge");
});
