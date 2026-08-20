// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_19bc (ROM 0x19bc-0x19c9, Pooyan) -- zero-fills work RAM
 * 0x8a80-0x8c7f. Seeds (0x8a80)=0 then ldir-propagates it forward (HL=0x8a80, DE=0x8a81,
 * BC=0x01ff). Self-contained mock (real Regs, flat 64K RAM, real ldirAt mirroring Machine.ldirAt).
 * No calls -> the only stack op is the terminal `ret`, whose pop returns to the seated caller.
 *
 * Pins the single straight-line path: full pcSeq (4 setup steps + 511 ldir boundaries + ret),
 * T = 10776, all 0x200 bytes cleared, edges untouched.
 * TEETH: mis-charge `ld bc,nn` (10 T) as 7 T -> the golden catches it.
 * POSITIVE CONTROL: no push16 exists in this leaf; the variant above (mischarged step) is the
 * proof-of-failure instead.
 *
 * Run: node --test games/pooyan/translated/test/loc_19bc.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_19bc } from "../loc_19bc.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x19bc, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
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

function ldirBlock(self, next, count) {
  const a = [];
  for (let i = 0; i < count - 1; i++) a.push(self);
  a.push(next);
  return a;
}

// 4 setup steps end at 0x19c7; the ldir (BC=0x1ff=511) emits 510x 0x19c7 + 0x19c9; then ret.
const PC_SEQ = [0x19bf, 0x19c2, 0x19c5, 0x19c7, ...ldirBlock(0x19c7, 0x19c9, 511), CALLER_RET];
// 10+10+10+10 setup + ldir(510*21+16=10726) + ret(10)
const GOLDEN_T = 40 + 10726 + 10;

test("loc_19bc: seed + ldir clears 0x8a80-0x8c7f, ret to caller", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  // dirty the whole span + both edges so a real clear is observable
  for (let a = 0x8a7f; a <= 0x8c80; a++) m.mem.write8(a, 0x77);

  loc_19bc(m);

  assert.equal(m.tstates, GOLDEN_T, "full path T-state total");
  assert.deepEqual(m.pcSeq, PC_SEQ, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, [], "leaf -- no calls");
  // every byte of the 0x200-wide span cleared
  assert.equal(m.mem.read8(0x8a80), 0x00, "first byte (seed) cleared");
  assert.equal(m.mem.read8(0x8a81), 0x00, "second byte cleared");
  assert.equal(m.mem.read8(0x8c7f), 0x00, "last byte cleared");
  let allZero = true;
  for (let a = 0x8a80; a <= 0x8c7f; a++) if (m.mem.read8(a) !== 0) allZero = false;
  assert.ok(allZero, "entire 0x8a80-0x8c7f span is zero");
  assert.equal(m.mem.read8(0x8a7f), 0x77, "byte below the span untouched");
  assert.equal(m.mem.read8(0x8c80), 0x77, "byte above the span untouched");
  assert.equal(m.regs.bc, 0x0000, "ldir ran BC to 0");
  assert.equal(m.regs.hl, 0x8c7f, "HL advanced to the last source byte");
  assert.equal(m.regs.de, 0x8c80, "DE advanced one past the span");
});

test("loc_19bc MUTATION: `ld bc,nn` mis-charged 7T (not 10) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x19c5 ? 7 : cycles);

  loc_19bc(m);

  assert.equal(m.tstates, GOLDEN_T - 3, "mutation loses 3 T (10 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, GOLDEN_T, "full path T-state total"),
    /T-state total/,
    "the golden must fail on the mutant",
  );
});
