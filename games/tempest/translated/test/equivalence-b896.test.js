// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b896 (ROM 0xb896-0xb8b9) -- writes vector-RAM tail regs, then $0139 -= $20
// with a bpl fork: result >=0 stores back (path A); result <0 masks $7f, dec $013a, stores (path B).
// Run: node --test games/tempest/translated/test/equivalence-b896.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b896 } from "../loc_b896.js";

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

// path A: $0139=$40 -> $40-$20 = $20 (>=0, N clear) -> bpl taken -> store $20, $013a untouched
test("bpl taken (result >=0) -> store back, no dec", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0139] = 0x40; m.ram[0x013a] = 0x02;
  loc_b896(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x2ffc], 0x40, "$2ffc = old $0139");
  assert.equal(m.ram[0x2ffd], 0x72, "$2ffd = $013a | $70 = $02|$70");
  assert.equal(m.ram[0x2fff], 0xc0, "$2fff = $c0");
  assert.equal(m.ram[0x0139], 0x20, "$0139 = $40 - $20");
  assert.equal(m.ram[0x013a], 0x02, "$013a untouched (no dec on path A)");
  assert.equal(m.regs.a, 0x20);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 45, "prefix 32 + bpl taken 3 + sta 4 + rts 6");
});

// path B: $0139=$10 -> $10-$20 = $f0 (borrow, N set) -> bpl not taken -> and $7f, dec $013a, store
test("bpl not taken (result <0) -> mask $7f + dec $013a", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0139] = 0x10; m.ram[0x013a] = 0x02;
  loc_b896(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x2ffc], 0x10, "$2ffc = old $0139");
  assert.equal(m.ram[0x2ffd], 0x72, "$2ffd = $02|$70");
  assert.equal(m.ram[0x2fff], 0xc0);
  assert.equal(m.ram[0x0139], 0x70, "$0139 = ($10-$20=$f0) & $7f = $70");
  assert.equal(m.ram[0x013a], 0x01, "$013a decremented");
  assert.equal(m.regs.a, 0x70);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 52, "prefix 32 + bpl nt 2 + and 2 + dec 6 + sta 4 + rts 6");
});
