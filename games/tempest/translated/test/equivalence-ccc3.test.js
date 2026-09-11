// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ccc3 (ROM 0xccc3) -- sound gate: BIT $05, BPL to the inlined RTS at 0xcce9 or
// fall into loc_ccc7. Minimal 6502 harness, author-derived. Run: node --test .../equivalence-ccc3.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ccc3 } from "../loc_ccc3.js";

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

test("loc_ccc3: $05 bit7 set -> BPL not taken -> fall into loc_ccc7; 5 T", () => {
  const m = makeMachine();
  m.regs.a = 0x03;
  m.mem.write8(0x05, 0xc0);    // bit7 & bit6 set

  loc_ccc3(m);

  assert.equal(m.regs.a, 0x03, "BIT leaves A unchanged");
  assert.equal(m.regs.fN, true, "N = bit7 of $05");
  assert.equal(m.regs.fV, true, "V = bit6 of $05");
  assert.equal(m.regs.fZ, true, "Z = (A & $05)==0 -> 0x03 & 0xc0 = 0");
  assert.equal(m.pc, 0xccc7, "fall-through to loc_ccc7");
  assert.deepEqual(m.calls, [0xccc7], "tail-call loc_ccc7");
  assert.equal(m.cycles, 3 + 2, "bit zp (3) + bpl not-taken (2)");
});

test("loc_ccc3: $05 bit7 clear -> BPL taken -> inlined RTS at cce9; 12 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);            // rts -> 0x2001
  m.regs.a = 0x03;
  m.mem.write8(0x05, 0x00);    // bit7 clear -> BPL taken

  loc_ccc3(m);

  assert.equal(m.pc, 0x2001, "inlined rts returns to pushed+1");
  assert.deepEqual(m.calls, [], "no routine call on the gated-off path");
  assert.equal(m.cycles, 3 + 3 + 6, "bit (3) + bpl taken (3) + rts (6)");
});
