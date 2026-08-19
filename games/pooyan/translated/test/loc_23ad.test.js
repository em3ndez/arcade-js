// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_23ad (ROM 0x23ad-0x23d6). loc_0c45/loc_3325 are plain-ret (pattern A):
// the stub runs m.ret() so the four pushed returns and the push de / pop de nest correctly.
// Run: node --test .../loc_23ad.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_23ad } from "../loc_23ad.js";

const CR = 0xabcd;
function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return { regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); }, call(a) { this.calls.push(a); this.ret(); return undefined; } };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CR); }

test("loc_23ad: (0x88bc) bit0 set -> DE stays 0x270a, 3 blits; 236 T", () => {
  const m = makeMachine(); seat(m);
  m.regs.hl = 0x88bd; m.mem.write8(0x88bd, 0x05); m.mem.write8(0x88bc, 0x01);
  loc_23ad(m);
  assert.equal(m.tstates, 236, "T");
  assert.equal(m.pc, CR, "ret");
  assert.equal(m.mem.read8(0x88bd), 0x01, "phase masked to &3");
  assert.equal(m.regs.de, 0x270a, "odd-phase source kept");
  assert.deepEqual(m.calls, [0x0c45, 0x3325, 0x3325, 0x3325], "lookup + three blits");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (push de / pop de + pattern-A)");
});

test("loc_23ad: (0x88bc) bit0 clear -> DE switched to 0x270e", () => {
  const m = makeMachine(); seat(m);
  m.regs.hl = 0x88bd; m.mem.write8(0x88bd, 0x05); m.mem.write8(0x88bc, 0x00);
  loc_23ad(m);
  assert.equal(m.regs.de, 0x270e, "even-phase source");
  assert.ok(m.pcSeq.includes(0x23d0), "0x23d0 (DE=0x270e) executed");
});

test("loc_23ad MUTATION: call 0x0c45 mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine(); seat(m);
  m.regs.hl = 0x88bd; m.mem.write8(0x88bd, 0x05); m.mem.write8(0x88bc, 0x01);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x0c45 ? 10 : c);
  loc_23ad(m);
  assert.notEqual(m.tstates, 236, "golden T catches the mutant");
});
