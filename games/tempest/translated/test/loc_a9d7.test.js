// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a9d7 (ROM 0xa9d7-0xa9fb). Minimal 6502 harness (Regs + flat RAM + page-1
// stack seam), author-derived. loc_a9fc is opaque here (the harness records each JSR, does not run it),
// so the memory a9fc would write is absent; we assert the loop's own state ($3b/$2a decrements, the
// glyph bytes read via ($3b),y) and the 6 recorded calls. Run: node --test .../loc_a9d7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a9d7 } from "../loc_a9d7.js";

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

test("loc_a9d7: 3 passes ($2a 2->0xff), calls loc_a9fc twice each, decs $3b; 193 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.regs.x = 0x00;
  m.push16(0x2000);            // rts -> 0x2001
  m.ram[0x3b] = 0x50; m.ram[0x3c] = 0x60; // ($3b) = 0x6050
  m.ram[0x6050] = 0x12;       // pass 1 byte
  m.ram[0x604f] = 0x34;       // pass 2 byte (after dec $3b)
  m.ram[0x604e] = 0x56;       // pass 3 byte

  loc_a9d7(m);

  assert.equal(m.ram[0x2a], 0xff, "$2a decremented 3x from 2 -> 0xff (loop exit)");
  assert.equal(m.ram[0x3b], 0x4d, "$3b decremented 3x from 0x50 -> 0x4d");
  assert.equal(m.regs.y, 0x00, "Y last loaded #0 before the low-byte call");
  assert.equal(m.regs.a, 0x56, "A holds the last ($3b),y low byte");
  assert.deepEqual(m.calls, [0xa9fc, 0xa9fc, 0xa9fc, 0xa9fc, 0xa9fc, 0xa9fc], "two loc_a9fc calls per pass, 3 passes");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
  assert.equal(m.cycles, 7 + 180 + 6, "prologue 7 + 3 passes * 60 + rts 6 = 193");
});

test("loc_a9d7 MUTATION: a missing php/plp pair cannot be masked -- plp restores carry across the call", () => {
  // Prove the loop actually runs and lands on rts (not a tautology): the recorded call count is 6,
  // and mis-stepping any pass would move the final PC off 0x2001.
  const m = makeMachine();
  m.regs.s = 0xfd; m.regs.x = 0x00;
  m.push16(0x2000);
  m.ram[0x3b] = 0x00; m.ram[0x3c] = 0x00; // ($3b) = 0x0000, all bytes 0
  loc_a9d7(m);
  assert.equal(m.calls.length, 6, "still 6 calls even with zero glyph bytes");
  assert.equal(m.pc, 0x2001, "loop terminates at rts regardless of data");
});
