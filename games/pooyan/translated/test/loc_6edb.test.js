// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6edb (ROM 0x6edb-0x6f2c): phase-1 per-record driver. Pins the full 14-record
// walk of loc_6f2d followed by the (0x8f4a)-not-finished early return. The expected pcSeq/T is built by
// an independent JS model of the exx/call/exx/add-ix/djnz loop, not read from the routine.
//
// Run: node --test games/pooyan/translated/test/loc_6edb.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6edb } from "../loc_6edb.js";

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

test("loc_6edb: 14x loc_6f2d, then (0x8f4a) not at 0xff -> ret nz; independently modelled T + pcSeq", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8f4a, 0x8c00);
  m.mem.write8(0x8c00, 0x00); // != 0xff -> ret nz after the loop

  loc_6edb(m);

  // independent model of the boundaries
  const exp = [0x6edf, 0x6ee2, 0x6ee4]; // ld ix + ld de + ld b landings
  let T = 14 + 10 + 7;
  for (let i = 0; i < 14; i++) {
    exp.push(0x6ee5, 0x6f2d, 0x6ee8, 0x6ee9, 0x6eeb);
    T += 4 + 17 + 10 + 4 + 15;         // exx, call step, stub ret, exx, add ix
    if (i < 13) { exp.push(0x6ee4); T += 13; }   // djnz taken
    else { exp.push(0x6eed); T += 8; }           // djnz not taken
  }
  exp.push(0x6ef0, 0x6ef1, 0x6ef3, CALLER_RET);
  T += 16 + 7 + 7 + 11;               // ld hl,(nn) + ld a,(hl) + cp + ret nz

  assert.equal(m.tstates, T, "T matches the independent model");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.deepEqual(m.calls, Array(14).fill(0x6f2d), "loc_6f2d run once per record");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, exp, "boundaries match the independent model");
});

test("loc_6edb MUTATION: add ix,de at 0x6ee9 mischarged 10T (not 15T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8f4a, 0x8c00);
  const real = m.step.bind(m);
  let mutated = false;
  m.step = (n, c) => { if (n === 0x6eeb && !mutated) { mutated = true; return real(n, 10); } return real(n, c); };
  loc_6edb(m);
  // one 15->10 change drops 5 T from the golden
  const m2 = makeMachine(); seatCaller(m2); m2.mem.write16(0x8f4a, 0x8c00); loc_6edb(m2);
  assert.equal(m.tstates, m2.tstates - 5, "mutation drops exactly 5 T");
});
