// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2bb3. Run: node --test .../loc_2bb3.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2bb3 } from "../loc_2bb3.js";

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

test("loc_2bb3 full loop (loc_2be5 returns true 0x11x) -> ret; 1083 T", () => {
  const m = mk();
  loc_2bb3(m); assert.equal(m.tstates, 1083, "T"); assert.equal(m.pc, CR);
  assert.equal(m.calls.length, 0x11, "17 slot attempts");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});
test("loc_2bb3 loc_2be5 caller-skip on first -> abort after one attempt", () => {
  const m = mk(); m.skip.add(0x2be5);
  loc_2bb3(m); assert.equal(m.calls.length, 1, "loop aborted"); assert.equal(m.pc, CR);
});
test("loc_2bb3 MUTATION: add ix,de mis-charged 11T (not 15T)", () => {
  const m = mk();
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2bbc ? 11 : c);
  loc_2bb3(m); assert.notEqual(m.tstates, 1083);
});