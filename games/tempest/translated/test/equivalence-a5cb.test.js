// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a5cb (ROM 0xa5cb-0xa617) -- init block: sets $00, ORs $0106 bit7, clears
// $0104/$0107/$5c/$0123, $0105=2; counts nonzero $03ac..$03bb into $0123; if any set and $9f<7 loads a
// param block ($04=0x1e,$00=0x0a,$02=0x20,$0123=0x80); always $0125=0xff. Minimal 6502 harness; the
// whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-a5cb.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a5cb } from "../loc_a5cb.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_a5cb: all $03ac..$03bb zero -> $0123 stays 0 -> BEQ skip to a612; 250 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000); // RTS -> 0x4001
  m.ram[0x0106] = 0x01; // ora #0x80 -> 0x81

  loc_a5cb(m);

  assert.equal(m.ram[0x00], 0x20, "$00 = 0x20 (not overwritten on skip path)");
  assert.equal(m.ram[0x0106], 0x81, "$0106 |= 0x80");
  assert.equal(m.ram[0x0104], 0x00, "$0104 cleared");
  assert.equal(m.ram[0x0107], 0x00, "$0107 cleared");
  assert.equal(m.ram[0x5c], 0x00, "$5c cleared");
  assert.equal(m.ram[0x0105], 0x02, "$0105 = 0x02");
  assert.equal(m.ram[0x0123], 0x00, "$0123 stays 0 (no nonzero cells)");
  assert.equal(m.ram[0x0125], 0xff, "$0125 = 0xff");
  assert.equal(m.regs.a, 0xff, "A = 0xff (last load)");
  assert.equal(m.pc, 0x4001, "RTS -> pushed + 1");
  assert.deepEqual(m.calls, []);
  assert.equal(m.cycles, 250, "250 T (skip path)");
});

test("loc_a5cb: a nonzero cell + $9f<7 -> loads param block; 282 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.ram[0x0106] = 0x00;
  m.ram[0x03ac] = 0x05; // one nonzero cell (read when x=0, last loop iter) -> $0123 incremented
  m.ram[0x9f] = 0x03;   // < 7 -> bcs not taken -> load param block

  loc_a5cb(m);

  assert.equal(m.ram[0x0104], 0x00, "$0104 cleared");
  assert.equal(m.ram[0x04], 0x1e, "$04 = 0x1e (param block)");
  assert.equal(m.ram[0x00], 0x0a, "$00 overwritten to 0x0a");
  assert.equal(m.ram[0x02], 0x20, "$02 = 0x20");
  assert.equal(m.ram[0x0123], 0x80, "$0123 forced to 0x80");
  assert.equal(m.ram[0x0125], 0xff, "$0125 = 0xff");
  assert.equal(m.pc, 0x4001, "RTS -> pushed + 1");
  assert.deepEqual(m.calls, []);
  assert.equal(m.cycles, 282, "282 T (param-block path)");
});

test("loc_a5cb: a nonzero cell but $9f>=7 -> BCS skips param block; $0123 keeps its count", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4000);
  m.ram[0x03ac] = 0x05; // one nonzero cell -> count = 1
  m.ram[0x9f] = 0x07;   // >= 7 -> bcs taken -> skip param block

  loc_a5cb(m);

  assert.equal(m.ram[0x0123], 0x01, "$0123 = count (1), param block not run");
  assert.equal(m.ram[0x04], 0x00, "$04 untouched (no param block)");
  assert.equal(m.ram[0x0125], 0xff, "$0125 = 0xff");
  assert.equal(m.pc, 0x4001, "RTS -> pushed + 1");
});
