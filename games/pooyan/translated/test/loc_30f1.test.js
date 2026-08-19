// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_30f1. Run: node --test .../loc_30f1.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_30f1 } from "../loc_30f1.js";

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

t("loc_30f1: seeds 4 hunters, ROM tamper check passes -> ret", () => {
  const m = mk(true);
  for (let i = 0x8920; i < 0x8928; i++) m.mem.write8(i, 0x00);
  loc_30f1(m);
  assert.equal(m.pc, CR, "ROM verified -> normal ret");
  assert.deepEqual(m.calls, [0x0010, 0x0010, 0x0010, 0x0f19, 0x323e]);
  assert.equal(m.mem.read8(0x8928), 0x0c, "wave timer primed");
  assert.equal(m.mem.read16(0x8f4b), 0x3370, "script pointer seated");
});
t("loc_30f1 MUTATION: ld iyl,e mis-charged 4T (not 8T) is caught (T stable via golden)", () => {
  const m = mk(true);
  const before = (() => { const mm = mk(true); mm.norec.add(0x0010); loc_30f1(mm); return mm.tstates; })();
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x3102 ? 4 : c);
  loc_30f1(m); assert.notEqual(m.tstates, before);
});