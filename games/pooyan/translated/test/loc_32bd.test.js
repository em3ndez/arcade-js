// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_32bd. Run: node --test .../loc_32bd.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_32bd } from "../loc_32bd.js";

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

test("loc_32bd (0x8f24)==0 -> ret z", () => {
  const m = mk(); m.mem.write8(0x8f24, 0x00);
  loc_32bd(m); assert.equal(m.pc, CR); assert.deepEqual(m.calls, []);
});
test("loc_32bd state 1 -> teardown + loc_0fad + ROM check; 1256 T", () => {
  const m = mk(); m.norec.add(0x1f40); m.mem.write8(0x8f24, 0x01);
  loc_32bd(m); assert.equal(m.tstates, 1256, "T"); assert.deepEqual(m.calls, [0x0fad]);
  assert.equal(m.mem.read8(0x8f24), 0x02, "state advanced");
});
test("loc_32bd state 2 (boss below 0xdb) -> loc_23d7; 131 T", () => {
  const m = mk(); m.mem.write8(0x8f24, 0x02); m.mem.write8(0x8a84, 0x50);
  loc_32bd(m); assert.equal(m.tstates, 131, "T"); assert.deepEqual(m.calls, [0x23d7]);
  assert.equal(m.mem.read8(0x8a84), 0x52, "boss Y += 2");
});
test("loc_32bd MUTATION: cp 0x02 mis-charged 4T (not 7T)", () => {
  const m = mk(); m.mem.write8(0x8f24, 0x02); m.mem.write8(0x8a84, 0x50);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x32c4 ? 4 : c);
  loc_32bd(m); assert.notEqual(m.tstates, 131);
});