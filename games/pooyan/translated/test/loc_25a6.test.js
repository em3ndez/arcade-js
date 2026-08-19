// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_25a6 (ROM 0x25a6-0x26bc): the pull-rope / lift sprite driver.
// Run: node --test .../loc_25a6.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_25a6 } from "../loc_25a6.js";

const CR = 0xabcd;
function mk() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; } };
  const m = { regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); }, call(a) { this.calls.push(a); this.ret(); return undefined; } };
  regs.sp = 0x8780; m.push16(CR); return m;
}
function base(m) { m.mem.write8(0x8907, 0x01); m.mem.write8(0x8f09, 0x01); m.mem.write8(0x8902, 0x03); }

test("loc_25a6 (0x8907) bit0 clear -> hands off to loc_2d66; 41 T", () => {
  const m = mk(); m.mem.write8(0x8907, 0x00);
  loc_25a6(m);
  assert.equal(m.tstates, 41, "T"); assert.equal(m.pc, CR); assert.deepEqual(m.calls, [0x2d66]);
});

test("loc_25a6 frame timer not expired -> ret nz; 63 T", () => {
  const m = mk(); m.mem.write8(0x8907, 0x01); m.mem.write8(0x8f09, 0x05);
  loc_25a6(m);
  assert.equal(m.tstates, 63, "T"); assert.deepEqual(m.calls, []);
});

test("loc_25a6 (0x8902)==0 -> ret z; 95 T", () => {
  const m = mk(); m.mem.write8(0x8907, 0x01); m.mem.write8(0x8f09, 0x01); m.mem.write8(0x8902, 0x00);
  loc_25a6(m);
  assert.equal(m.tstates, 95, "T"); assert.deepEqual(m.calls, []);
});

test("loc_25a6 steady (0x8920)==0,(0x8f05)==0 -> stamp + display cmd loc_3307; 847 T", () => {
  const m = mk(); base(m);
  m.mem.write8(0x8920, 0x00); m.mem.write8(0x8f05, 0x00);
  m.mem.write8(0x8902, 0x02);
  m.mem.write16(0x8932, 0x8b00); m.mem.write8(0x8934, 0x02); m.mem.write8(0x8f0a, 0x00);
  loc_25a6(m);
  assert.equal(m.tstates, 847, "T"); assert.deepEqual(m.calls, [0x3307], "display command only");
  assert.equal(m.mem.read8(0x8f0a), 0x01, "0x8f0a bumped");
});

test("loc_25a6 extend (ix path): (0x8f05)!=0 -> advance 0x8932 by -0x20, 0f19/0f11/3307; 1078 T", () => {
  const m = mk(); base(m);
  m.mem.write8(0x8920, 0x00); m.mem.write8(0x8f05, 0x01);
  m.mem.write16(0x8932, 0x8b40); m.mem.write8(0x8934, 0x02); m.mem.write8(0x8f0a, 0x01);
  loc_25a6(m);
  assert.equal(m.tstates, 1078, "T"); assert.deepEqual(m.calls, [0x0f19, 0x0f11, 0x3307]);
  assert.equal(m.mem.read16(0x8932), 0x8b20, "sprite pointer stepped up 0x20");
  assert.equal(m.mem.read8(0x8f09), 0x1c, "long timer seeded");
});

test("loc_25a6 retract (iy path) already blank (iy)=0x80 -> skip clear loop; 1535 T", () => {
  const m = mk(); base(m);
  m.mem.write8(0x8920, 0x01); m.mem.write16(0x8932, 0x8b40); m.mem.write8(0x8f0a, 0x00);
  m.mem.write8(0x8740, 0x80); // (iyh-4 base)
  loc_25a6(m);
  assert.equal(m.tstates, 1535, "T"); assert.deepEqual(m.calls, [], "0x8920 set -> no display cmd");
});

test("loc_25a6 retract (iy path) clears rope column via loc_0f49; 2050 T", () => {
  const m = mk(); base(m);
  m.mem.write8(0x8920, 0x01); m.mem.write16(0x8932, 0x8b40); m.mem.write8(0x8f0a, 0x00);
  m.mem.write8(0x8740, 0x00);
  loc_25a6(m);
  assert.equal(m.tstates, 2050, "T"); assert.deepEqual(m.calls, [0x0f49]);
  assert.equal(m.mem.read8(0x8740), 0x80, "column head blanked to 0x80");
});

test("loc_25a6 MUTATION: ld ix,(0x8932) at 0x2678 mis-charged 16T (not 20T)", () => {
  const m = mk(); base(m);
  m.mem.write8(0x8920, 0x00); m.mem.write8(0x8f05, 0x00);
  m.mem.write8(0x8902, 0x02);
  m.mem.write16(0x8932, 0x8b00); m.mem.write8(0x8934, 0x02);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x267c ? 16 : c);
  loc_25a6(m); assert.notEqual(m.tstates, 847);
});
