// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2e5e. Run: node --test .../loc_2e5e.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2e5e } from "../loc_2e5e.js";

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

test("loc_2e5e (0x8a5f)&3 != 0 -> ret nz; 31 T", () => {
  const m = mk(true); m.mem.write8(0x8a5f, 0x01);
  loc_2e5e(m); assert.equal(m.tstates, 31, "T"); assert.deepEqual(m.calls, []);
});
test("loc_2e5e timer not elapsed -> ret nz after loc_2e45; 63 T", () => {
  const m = mk(false); m.mem.write8(0x8a5f, 0x00);
  loc_2e5e(m); assert.equal(m.tstates, 63, "T"); assert.deepEqual(m.calls, [0x2e45]);
});
test("loc_2e5e elapsed, free bonus slot -> seed + blit; 533 T", () => {
  const m = mk(true); m.mem.write8(0x8a5f, 0x00);
  m.mem.write8(0x8c48, 0x00); m.mem.write8(0x8c49, 0x00); m.mem.write8(0x8907, 0x08);
  loc_2e5e(m); assert.equal(m.tstates, 533, "T");
  assert.deepEqual(m.calls, [0x2e45, 0x0020, 0x2e52, 0x3325, 0x0f11]);
  assert.equal(m.mem.read8(0x8c48), 0x07, "slot state seeded"); assert.equal(m.mem.read8(0x8f28), 0x1f, "0x8f28 = computed attribute (0x01 overwritten at 0x2e8d)");
});
test("loc_2e5e elapsed, no free slot -> ret; 334 T", () => {
  const m = mk(true); m.mem.write8(0x8a5f, 0x00);
  for (let i = 0; i < 3; i++) m.mem.write8(0x8c48 + i * 0x18, 0x11);
  loc_2e5e(m); assert.equal(m.tstates, 334, "T"); assert.deepEqual(m.calls, [0x2e45]);
  assert.equal(m.mem.read8(0x8f28), 0x01, "no-slot path leaves timer re-armed to 1");
});
test("loc_2e5e MUTATION: cpl at 0x2e8c mis-charged 7T (not 4T)", () => {
  const m = mk(true); m.mem.write8(0x8a5f, 0x00); m.mem.write8(0x8c48, 0x00); m.mem.write8(0x8c49, 0x00);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2e8d ? 7 : c);
  loc_2e5e(m); assert.notEqual(m.tstates, 533);
});