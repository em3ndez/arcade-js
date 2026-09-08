// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3a99 (ROM 0x3a99-0x3aa6). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3a99.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3a99 } from "../loc_3a99.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

// loc_3aa7 (the callee) is a no-op record in this harness, so A carries through each store: the loop
// writes A to $0178..$01b7 for X=$3f..0 (64 stores), DEX past 0 -> X=$ff, then STX $f9; RTS.
test("loc_3a99: fills $0178..$01b7 from A via 64 loc_3aa7 calls, X=$ff -> $f9; 1034 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.regs.a = 0xaa;  // the value loc_3aa7 would leave in A (no-op here) -> stored to every slot

  loc_3a99(m);

  assert.equal(m.ram[0x0178], 0xaa, "low slot written (X=0)");
  assert.equal(m.ram[0x01b7], 0xaa, "high slot written (X=$3f)");
  assert.equal(m.ram[0x0177], 0x00, "one below the table is untouched");
  assert.equal(m.ram[0x01b8], 0x00, "one above the table is untouched");
  assert.equal(m.ram[0x00f9], 0xff, "$f9 = X after DEX past 0");
  assert.equal(m.regs.x, 0xff, "X ends at $ff");
  assert.equal(m.regs.fN, true, "N set from DEX -> 0xff");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.calls.length, 64, "one loc_3aa7 call per slot");
  assert.ok(m.calls.every((a) => a === 0x3aa7), "every call is loc_3aa7");
  assert.equal(m.cycles, 2 + 64 * (6 + 5 + 2) + 63 * 3 + 2 + 3 + 6, "1034 T");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
});

test("loc_3a99 MUTATION: the final RTS mischarged 7T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.regs.a = 0xaa;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1234 ? 7 : c); // only the RTS lands at 0x1234
  loc_3a99(m);
  assert.notEqual(m.cycles, 1034, "a mischarged cycle blows the golden T-state total");
});
