// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9009 (ROM 0x9009-0x9024). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam); JSRs are opaque (harness records the call, balances the pushed return). The whole-machine
// boot-first state diff vs MAME is the integration check. Run: node --test .../test/equivalence-9009.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9009 } from "../loc_9009.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], _retPushed: false,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_9009: four subroutine calls then seeds $5b/$0106/$5f/$01; 49 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // RTS -> 0x2001

  loc_9009(m);

  assert.equal(m.mem.read8(0x5b), 0xfa, "$5b = 0xfa");
  assert.equal(m.mem.read8(0x0106), 0x00, "$0106 cleared");
  assert.equal(m.mem.read8(0x5f), 0x00, "$5f cleared");
  assert.equal(m.mem.read8(0x01), 0x00, "$01 cleared");
  assert.equal(m.regs.a, 0x00, "A holds the last immediate 0x00");
  assert.deepEqual(m.calls, [0x92c5, 0x9234, 0x902b, 0xa831], "four JSRs in ROM order");
  assert.equal(m.pc, 0x2001, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 6 + 6 + 6 + 6 + 2 + 3 + 2 + 4 + 3 + 2 + 3 + 6, "49 T");
});
