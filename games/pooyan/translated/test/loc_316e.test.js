// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_316e. Run: node --test .../loc_316e.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_316e } from "../loc_316e.js";

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

test("loc_316e wave timer non-zero -> dec, ret; 49 T", () => {
  const m = mk(); m.mem.write8(0x8928, 0x05);
  loc_316e(m); assert.equal(m.tstates, 49, "T"); assert.equal(m.mem.read8(0x8928), 0x04); assert.deepEqual(m.calls, []);
});
test("loc_316e swoop: advance lead, arm dive, stamp records, fall into loc_323e; 946 T", () => {
  const m = mk(); m.mem.write8(0x8928, 0x00);
  m.mem.write16(0x8920, 0x8b00); m.mem.write16(0x8f4b, 0x9000); m.mem.write8(0x9000, 0x00);
  m.mem.write8(0x8f4a, 0x00); m.mem.write8(0x8b04, 0x05);
  loc_316e(m);
  assert.equal(m.tstates, 946, "T"); assert.deepEqual(m.calls, [0x0f1d, 0x323e]);
});
test("loc_316e MUTATION: pop iy mis-charged 10T (not 14T)", () => {
  const m = mk(); m.mem.write8(0x8928, 0x00); m.mem.write16(0x8920, 0x8b00); m.mem.write16(0x8f4b, 0x9000);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x317f ? 10 : c);
  loc_316e(m); assert.notEqual(m.tstates, 946);
});