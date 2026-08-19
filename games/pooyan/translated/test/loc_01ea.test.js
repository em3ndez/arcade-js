// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_01ea (ROM 0x01EA-0x020E) -- clears both sprite banks (two stubbed
 * `rst 0x10` fills), blanks video RAM 0x8440-0x87FF with tile 0x1e via `ldir`,
 * then runs the 256x256 watchdog-kicked settle delay and rets. B and C both leave
 * the ldir at 0, so the trip counts (256 x 256) and the golden T-state total are
 * fixed by the ROM; the total is computed independently from the Z80 timings.
 * TEETH: mis-charge the first `ld hl,nn` (10 T) as 7 T; the golden catches it.
 * Run: node --test games/pooyan/translated/test/loc_01ea.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_01ea } from "../loc_01ea.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x01ea, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Simulate the callee running to its own `ret`: it pops the return address
    // the caller pushed, so SP is balanced for the following `ret`.
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
    // Mirrors Machine.ldirAt: LDIR with the exact per-iteration flag and 21/16 T timing.
    ldirAt(self, nextAddr) {
      for (;;) {
        const byte = mem.read8(regs.hl);
        mem.write8(regs.de, byte);
        regs.hl = (regs.hl + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff;
        regs.bc = (regs.bc - 1) & 0xffff;
        const n = (regs.a + byte) & 0xff;
        regs.f = (regs.f & (0x80 | 0x40 | 0x01)) | (regs.bc !== 0 ? 0x04 : 0) | (n & 0x08 ? 0x08 : 0) | (n & 0x02 ? 0x20 : 0);
        if (regs.bc === 0) { this.step(nextAddr, 16); return; }
        regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28);
        this.step(self, 21);
      }
    },
  };
}

// Independently computed from the Z80 timings (NOT from the JS):
//   setup 10 instrs + ldir(958*21+16) + 256*(256*12 nops + 255*13+8 djnz + 13+4)
//   + (255*12+7 jr) + ret(10).
const GOLDEN_T = 1664779;

test("loc_01ea: clear banks + blank video RAM + full delay -> ret", () => {
  const m = makeMachine();
  m.regs.sp = 0x8f00;
  m.push16(CALLER_RET);
  m.regs.a = 0x7e; // arbitrary fill byte the stubbed rst 0x10 would use

  loc_01ea(m);

  assert.equal(m.pc, CALLER_RET, "ends via ret to the seated caller");
  assert.equal(m.regs.sp, 0x8f00, "stack balanced");
  assert.deepEqual(m.calls, [0x0010, 0x0010], "two rst 0x10 sprite-bank fills");
  assert.equal(m.tstates, GOLDEN_T, "full deterministic path T-state total");
  // ldir blanked 0x8440-0x87FF inclusive with tile 0x1e; the edges are untouched.
  assert.equal(m.mem.read8(0x8440), 0x1e);
  assert.equal(m.mem.read8(0x8441), 0x1e);
  assert.equal(m.mem.read8(0x87ff), 0x1e);
  assert.equal(m.mem.read8(0x843f), 0x00, "byte below the fill untouched");
  assert.equal(m.mem.read8(0x8800), 0x00, "byte past the fill untouched");
  assert.equal(m.pcSeq[0], 0x01ed, "first boundary");
  assert.equal(m.pcSeq[m.pcSeq.length - 1], CALLER_RET, "last boundary is the ret");
});

test("loc_01ea MUTATION: first `ld hl,nn` mischarged 7 T (not 10) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x8f00;
  m.push16(CALLER_RET);
  const real = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first && n === 0x01ed) { first = false; return real(n, 7); } return real(n, c); };

  loc_01ea(m);

  assert.equal(m.tstates, GOLDEN_T - 3, "mutant lost exactly 3 T");
  assert.throws(() => assert.equal(m.tstates, GOLDEN_T, "T-state total"), /T-state total/);
});
