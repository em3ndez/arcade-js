// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_1d0d (ROM 0x1d0d-0x1d12 + re-emitted 0x1cec-0x1cf5 tail): seed
// (0x8740)=1, jr into the sprite-slot tail (0x25/0x20 down 0x8720/0x8700, stride -0x20), ret.
// Self-contained mock (real Regs, flat 64K RAM); the tail is INLINE so this ends with m.ret().
//
// Run: node --test games/pooyan/translated/test/loc_1d0d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1d0d } from "../loc_1d0d.js";

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

test("loc_1d0d: (0x8740)=1, then inlined tail 0x25/0x20 down 0x8720/0x8700, ret; 94 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_1d0d(m);

  assert.equal(m.tstates, 94, "seed + jr + inlined tail + ret T-state total");
  assert.equal(m.mem.read8(0x8740), 0x01, "(0x8740) = 1");
  assert.equal(m.mem.read8(0x8720), 0x25, "(0x8720) = 0x25");
  assert.equal(m.mem.read8(0x8700), 0x20, "(0x8700) = 0x20");
  assert.equal(m.regs.hl, 0x8700, "HL walked -0x20 twice to 0x8700");
  assert.deepEqual(m.calls, [], "tail is inlined -- no delegate call");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "ret pops the seated caller return");
  assert.deepEqual(m.pcSeq, [0x1d10, 0x1d12, 0x1cec, 0x1cef, 0x1cf0, 0x1cf2, 0x1cf3, 0x1cf5, CALLER_RET], "boundaries");
});

test("loc_1d0d MUTATION: `ld (hl),n` (0x1d12) mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine(); seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1d12 ? 7 : c);
  loc_1d0d(m);
  assert.equal(m.tstates, 91, "mutation loses 3 T");
  assert.notEqual(m.tstates, 94, "golden total catches the mutant");
});
