// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0a0c (ROM 0x0a0c-0x0a24): object-record seeder. Flat-RAM mock, real
// Regs. Plain ret, no calls -- so the only stack action is the terminal ret popping the caller.
//
// Run: node --test games/pooyan/translated/test/loc_0a0c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0a0c } from "../loc_0a0c.js";

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

test("loc_0a0c: seeds record from (DE) descriptor + (HL) coords; 157 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b70;
  m.regs.de = 0x9000;
  m.regs.hl = 0x9100;
  m.mem.write8(0x9000, 0x11); m.mem.write8(0x9001, 0x22); // descriptor
  m.mem.write8(0x9100, 0x33); m.mem.write8(0x9101, 0x44); // coord pair

  loc_0a0c(m);

  assert.equal(m.tstates, 157, "full-path T-state total");
  assert.equal(m.pc, CALLER_RET, "plain ret to caller");
  assert.equal(m.mem.read8(0x8b76), 0x11, "(ix+6) = descriptor[0]");
  assert.equal(m.mem.read8(0x8b74), 0x22, "(ix+4) = descriptor[1]");
  assert.equal(m.mem.read8(0x8b7c), 0x33, "(ix+0xc) = coord[0]");
  assert.equal(m.mem.read8(0x8b7d), 0x44, "(ix+0xd) = coord[1]");
  assert.equal(m.mem.read8(0x8b7e), 0x00, "(ix+0xe) = 0 (timer cleared)");
  assert.equal(m.regs.de, 0x9002, "DE advanced past the 2-byte descriptor");
  assert.equal(m.regs.hl, 0x9102, "HL advanced past the 2-byte coord pair");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, [], "leaf routine");
  assert.deepEqual(m.pcSeq,
    [0x0a0d, 0x0a10, 0x0a11, 0x0a12, 0x0a13, 0x0a16, 0x0a17, 0x0a1a,
     0x0a1b, 0x0a1c, 0x0a1f, 0x0a23, 0x0a24, CALLER_RET],
    "instruction boundaries");
});

test("loc_0a0c MUTATION: ld (ix+0xe),0 mis-charged 10T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b70; m.regs.de = 0x9000; m.regs.hl = 0x9100;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0a23 ? 10 : c); // LD (IX+d),n = 19T
  loc_0a0c(m);
  assert.equal(m.tstates, 148, "mutation drops 9 T");
  assert.notEqual(m.tstates, 157, "golden total catches the mis-charged indexed store");
});
