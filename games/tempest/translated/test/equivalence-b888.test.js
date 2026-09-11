// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b888 (ROM 0xb888-0xb895) -- jsr $c196 (delegate), then $0139=$7f, $013a=$04.
// Run: node --test games/tempest/translated/test/equivalence-b888.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b888 } from "../loc_b888.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

// jsr $c196 seam call records retAddr = jsraddr+2 = 0xb88a; then the two immediates land
test("jsr $c196 delegate + $0139/$013a stores", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  loc_b888(m);
  assert.deepEqual(m.calls, [0xc196], "single delegate call to $c196");
  assert.equal(m.retAddrs[0], 0xb88a, "jsr pushes jsraddr+2 (0xb888+2)");
  assert.equal(m.ram[0x0139], 0x7f, "$0139 = $7f");
  assert.equal(m.ram[0x013a], 0x04, "$013a = $04");
  assert.equal(m.regs.a, 0x04, "A = last immediate $04");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 24, "6(jsr)+2+4+2+4+6");
});
