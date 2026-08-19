// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_241e (ROM 0x241e-0x2435): the 0x8a80 actor per-frame driver ending in a
// rst 0x28 dispatch. The three helpers are pattern-A (stub runs m.ret()); the final call 0x0028 is
// recorded only, leaving the pushed inline-table base 0x2436 on the stack.
// Run: node --test .../loc_241e.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_241e } from "../loc_241e.js";

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
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); if (a !== 0x0028) this.ret(); return undefined; } };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CR); }

test("loc_241e: busy flag clear -> runs helpers, dispatches state 3; 154 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x881e, 0x00);
  m.mem.write8(0x8a82, 0x03); // (ix+2) selector
  loc_241e(m);
  assert.equal(m.tstates, 154, "T");
  assert.equal(m.pc, 0x0028, "delegates to the rst-0x28 trampoline");
  assert.deepEqual(m.calls, [0x2101, 0x25a6, 0x308b, 0x0028], "helpers then dispatch");
  assert.equal(m.regs.a, 0x03, "selector = (ix+2)&7");
  assert.equal(m.mem.read16(m.regs.sp), 0x2436, "inline table base pushed for loc_0028");
});

test("loc_241e: busy flag set -> ret nz after helpers, no dispatch", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x881e, 0x01);
  loc_241e(m);
  assert.equal(m.pc, CR, "returns to caller");
  assert.deepEqual(m.calls, [0x2101, 0x25a6, 0x308b], "no rst dispatch");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_241e MUTATION: ld a,(ix+2) mis-charged 13T (not 19T) is caught", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x881e, 0x00); m.mem.write8(0x8a82, 0x03);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x2433 ? 13 : c);
  loc_241e(m);
  assert.notEqual(m.tstates, 154, "golden T catches the mutant");
});
