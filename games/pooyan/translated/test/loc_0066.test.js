// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_0066 (ROM 0x0066, Pooyan) -- a bare `jp 0x066d` tail-jump.
 *
 * The bytes at 0x0069-0x0091 are an unreached data region (the boot trace jumps
 * 0x0066 -> 0x066d directly, scratchpad/pooyan-execpcs.txt lines 212-213), so the
 * routine is a single 10-T instruction that delegates to 0x066d.
 *
 * TEETH: mis-charge the `jp nn` (10 T) as a `jp (hl)` (4 T) -- a plausible copy
 * error -- and the golden T-state assertion catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_0066.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0066 } from "../loc_0066.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0066, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_0066: tail-jump to 0x066d (10 T)", () => {
  const m = makeMachine();
  loc_0066(m);
  assert.equal(m.tstates, 10, "single jp nn");
  assert.equal(m.pc, 0x066d, "lands at 0x066d");
  assert.deepEqual(m.calls, [0x066d], "delegates to 0x066d");
  assert.deepEqual(m.pcSeq, [0x066d]);
});

test("loc_0066 MUTATION: jp mischarged 4 T is caught", () => {
  const m = makeMachine();
  const real = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first) { first = false; return real(n, 4); } return real(n, c); };
  loc_0066(m);
  assert.equal(m.tstates, 4, "mutant lost 6 T");
  assert.throws(() => assert.equal(m.tstates, 10, "jp T-state"), /jp T-state/);
});
