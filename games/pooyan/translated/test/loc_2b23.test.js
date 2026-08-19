// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2b23. Run: node --test .../loc_2b23.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2b23 } from "../loc_2b23.js";

const CR = 0xabcd;
function mk() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; } };
  const m = { regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [], skip: new Set(),
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    // callers that pushed a return use the boolean protocol: a skip target pops that return, then rets
    call(a) { this.calls.push(a); if (this.skip.has(a)) { this.pop16(); this.ret(); return false; } this.ret(); return true; } };
  regs.sp = 0x8780; m.push16(CR); regs.ix = 0x8a80; return m;
}

test("loc_2b23 flag armed + countdown zero -> re-enters loc_2b59; 78 T", () => {
  const m = mk(); m.mem.write8(0x8808, 0x01); m.mem.write8(0x8e2a, 0x01);
  loc_2b23(m); assert.equal(m.tstates, 78, "T"); assert.deepEqual(m.calls, [0x2b59]);
});
test("loc_2b23 else -> tail-calls loc_7e94; 77 T", () => {
  const m = mk(); m.mem.write8(0x8808, 0x05); m.mem.write8(0x8e2a, 0x00);
  loc_2b23(m); assert.equal(m.tstates, 77, "T"); assert.deepEqual(m.calls, [0x7e94]);
});
test("loc_2b23 MUTATION: dec (hl) mis-charged 7T (not 11T)", () => {
  const m = mk(); m.mem.write8(0x8808, 0x05);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2b27 ? 7 : c);
  loc_2b23(m); assert.notEqual(m.tstates, 77);
});