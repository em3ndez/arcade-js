// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_308b. Run: node --test .../loc_308b.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_308b } from "../loc_308b.js";

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

test("loc_308b (0x8f04)==0 -> ret z; 28 T", () => {
  const m = mk(); m.mem.write8(0x8f04, 0x00);
  loc_308b(m); assert.equal(m.tstates, 28, "T"); assert.deepEqual(m.calls, []);
});
test("loc_308b scan: registers launch-ready records, arms 0x8f08; 1068 T", () => {
  const m = mk(); m.mem.write8(0x8f04, 0x01); m.mem.write8(0x8f08, 0x00);
  loc_308b(m); assert.equal(m.tstates, 1068, "T"); assert.equal(m.pc, CR);
  assert.equal(m.mem.read8(0x8f08), 0x01, "slot table filled -> 0x8f08 armed");
});
test("loc_308b (0x8f08) set -> dispatch THEN epilogue loc_32bd runs -> returns to caller; 107 T", () => {
  const m = mk(); m.mem.write8(0x8f04, 0x01); m.mem.write8(0x8f08, 0x02);
  // model the rst-0x28 dispatch: loc_0028 pops the table base (0x30eb) and the dispatched handler's
  // ret pops the pushed epilogue (0x32bd) -- net 2 pops; loc_308b then runs loc_32bd, which rets to caller.
  m.call = (a) => {
    m.calls.push(a);
    if (a === 0x0028) { m.pop16(); m.pop16(); return undefined; }
    if (a === 0x32bd) { m.pc = m.pop16(); return true; } // epilogue rets to loc_308b's caller (its T tested separately)
    m.pop16(); return true;
  };
  loc_308b(m);
  assert.equal(m.tstates, 107, "own-step T (callee T tested separately)");
  assert.deepEqual(m.calls, [0x0028, 0x32bd], "dispatch THEN the epilogue loc_32bd (was never invoked -- the bug)");
  assert.equal(m.pc, CR, "epilogue returns to loc_308b's caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced -- no +2 SP drift");
});
test("loc_308b MUTATION: ld iy,0x8920 mis-charged 10T (not 14T)", () => {
  const m = mk(); m.mem.write8(0x8f04, 0x01);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x309e ? 10 : c);
  loc_308b(m); assert.notEqual(m.tstates, 1068);
});