// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_305f. Run: node --test .../loc_305f.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_305f } from "../loc_305f.js";

const CR = 0xabcd;
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const ROM_URL = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM = fs.existsSync(fileURLToPath(ROM_URL)) ? fs.readFileSync(fileURLToPath(ROM_URL)) : null;
function mk(loadRom) {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  if (loadRom && ROM) ram.set(ROM.subarray(0, 0x8000), 0);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; } };
  const m = { regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [], norec: new Set(),
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    ldirAt(self, nextAddr) { for (;;) { const b = mem.read8(regs.hl); mem.write8(regs.de, b);
      regs.hl = (regs.hl + 1) & 0xffff; regs.de = (regs.de + 1) & 0xffff; regs.bc = (regs.bc - 1) & 0xffff;
      const n = (regs.a + b) & 0xff; regs.f = (regs.f & 0xc1) | (regs.bc !== 0 ? 0x04 : 0) | (n & 0x08 ? 0x08 : 0) | (n & 0x02 ? 0x20 : 0);
      if (regs.bc === 0) { this.step(nextAddr, 16); return; } regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28); this.step(self, 21); } },
    call(a) { this.calls.push(a); if (this.norec.has(a)) return undefined; this.ret(); return true; } };
  regs.sp = 0x8780; m.push16(CR); return m;
}
const t = ROM ? test : (n) => test(n, { skip: "ROM not built" }, () => {});

// rst 0x20 (loc_0020) returns the catch-window half-width in A; simulate it.
function win(m, w) { m.call = (a) => { m.calls.push(a); if (a === 0x0020) m.regs.a = w; m.ret(); return true; }; }
test("loc_305f player outside window -> ret nc, returns true; 109 T", () => {
  const m = mk(); win(m, 0x00); m.regs.ix = 0x8ae0; m.mem.write8(0x8a84, 0x40);
  const r = loc_305f(m); assert.equal(r, true); assert.equal(m.tstates, 109, "T"); assert.deepEqual(m.calls, [0x0020]);
});
test("loc_305f player inside window, not busy -> fire grab, pop af; ret false", () => {
  const m = mk(); win(m, 0x40); m.regs.ix = 0x8ae0; m.mem.write8(0x8a84, 0x40); m.mem.write8(0x8f24, 0); m.mem.write8(0x8f08, 0);
  const r = loc_305f(m); assert.equal(r, false); assert.deepEqual(m.calls, [0x0020, 0x0f15]);
  assert.equal(m.mem.read8(0x8d32), 0x01, "grab flag set");
});
test("loc_305f MUTATION: sub 0x07 mis-charged 4T (not 7T)", () => {
  const m = mk(); win(m, 0x00); m.regs.ix = 0x8ae0; m.mem.write8(0x8a84, 0x40);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x306d ? 4 : c);
  loc_305f(m); assert.notEqual(m.tstates, 109);
});