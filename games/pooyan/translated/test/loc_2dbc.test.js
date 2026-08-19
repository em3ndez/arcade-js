// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2dbc. Run: node --test .../loc_2dbc.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2dbc } from "../loc_2dbc.js";

const CR = 0xabcd;
function mk() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; } };
  const m = { regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [], norec: new Set(),
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); if (this.norec.has(a)) return undefined; this.ret(); return true; } };
  regs.sp = 0x8780; m.push16(CR); regs.ix = 0x8a80; return m;
}

test("loc_2dbc hold counter non-zero -> dec, ret; 49 T", () => {
  const m = mk(); m.mem.write8(0x8f16, 0x05);
  loc_2dbc(m); assert.equal(m.tstates, 49, "T"); assert.equal(m.mem.read8(0x8f16), 0x04); assert.deepEqual(m.calls, []);
});
test("loc_2dbc expiry, frame < 8 -> blit tile via loc_0c45/loc_3325; 187 T", () => {
  const m = mk(); m.mem.write8(0x8f16, 0x00); m.mem.write8(0x8f1b, 0x03); m.mem.write16(0x8f19, 0x8460);
  loc_2dbc(m);
  assert.equal(m.tstates, 187, "T"); assert.deepEqual(m.calls, [0x0c45, 0x3325]);
  assert.equal(m.mem.read8(0x8f1b), 0x04, "frame index bumped");
});
test("loc_2dbc expiry, frame == 8 -> reset and re-arm next cell; 144 T", () => {
  const m = mk(); m.mem.write8(0x8f16, 0x00); m.mem.write8(0x8f1b, 0x08); m.mem.write8(0x8f18, 0x02);
  loc_2dbc(m); assert.equal(m.tstates, 144, "T"); assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8f1b), 0x00, "frame index reset");
});
test("loc_2dbc MUTATION: ld hl,(0x8f19) mis-charged 13T (not 16T)", () => {
  const m = mk(); m.mem.write8(0x8f16, 0x00); m.mem.write8(0x8f1b, 0x03);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2de6 ? 13 : c);
  loc_2dbc(m); assert.notEqual(m.tstates, 187);
});