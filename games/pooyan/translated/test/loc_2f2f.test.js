// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2f2f. Run: node --test .../loc_2f2f.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2f2f } from "../loc_2f2f.js";

const CR = 0xabcd;
const FZ = 0x40;
function mk(elapsed) {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; } };
  const m = { regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    // loc_2e45 leaves HL = timer address (0x8f28) and Z = (dec result == 0). Simulate it.
    call(a) { this.calls.push(a); if (a === 0x2e45) { regs.hl = 0x8f28; regs.f = elapsed ? (regs.f | FZ) : (regs.f & ~FZ); } this.ret(); return true; } };
  regs.sp = 0x8780; m.push16(CR); regs.ix = 0x8f1e; return m;
}

test("loc_2f2f timer not elapsed -> ret nz; 38 T", () => {
  const m = mk(false);
  loc_2f2f(m); assert.equal(m.tstates, 38, "T"); assert.deepEqual(m.calls, [0x2e45]);
});
test("loc_2f2f no segments left -> ret z; 60 T", () => {
  const m = mk(true); m.mem.write8(0x8931, 0x00);
  loc_2f2f(m); assert.equal(m.tstates, 60, "T"); assert.deepEqual(m.calls, [0x2e45]);
});
test("loc_2f2f retract -> attribute merge + clear formation + blit; 500 T", () => {
  const m = mk(true); m.mem.write8(0x8931, 0x05); m.mem.write8(0x8907, 0x08); m.mem.write8(0x8820, 0x00); m.mem.write8(0x8f29, 0x01);
  loc_2f2f(m); assert.equal(m.tstates, 500, "T"); assert.deepEqual(m.calls, [0x2e45, 0x0c45, 0x0020, 0x0010, 0x2e52, 0x3325]);
});
test("loc_2f2f MUTATION: srl a mis-charged 4T (not 8T)", () => {
  const m = mk(true); m.mem.write8(0x8931, 0x05);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2f3e ? 4 : c);
  loc_2f2f(m); assert.notEqual(m.tstates, 500);
});