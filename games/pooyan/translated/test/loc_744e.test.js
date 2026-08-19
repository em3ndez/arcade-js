// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_744e (ROM 0x744e-0x7499): dispatch state 0 -- attract-mode seeding +
// the ROM-signature anti-tamper check. Flat-RAM mock (real Regs). With RAM all-zero, both the
// summed regions and their reference copies read 0x00, so every compare matches and the clean
// path runs (loop 1 x8, loop 2 x116 with one ixl->ixh page carry). 0x67df is the abort vector.
//
// Run: node --test games/pooyan/translated/test/loc_744e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_744e } from "../loc_744e.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only (abort is a jp)
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// ── Clean path: all-zero RAM -> every signature byte matches -> seeds set, selector++, ret ──────
test("loc_744e clean: seeds pointers, advances (0x8921), both loops pass, ret; 10681 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_744e(m);

  assert.equal(m.pc, CALLER_RET, "returns via ret after a clean signature check");
  assert.deepEqual(m.calls, [], "no abort on a matching signature");
  assert.equal(m.tstates, 10681, "clean-path T-state total (setup + loop1 x8 + loop2 x116 + ret)");
  // seeded state
  assert.equal(m.mem.read8(0x88b7), 0x00, "(0x88b7) zeroed");
  assert.equal(m.mem.read16(0x88ba), 0x43e1, "(0x88ba) = 0x43e1");
  assert.equal(m.mem.read16(0x8f45), 0x4af0, "(0x8f45) = 0x4af0");
  assert.equal(m.mem.read16(0x88b8), 0x8442, "(0x88b8) = 0x8442");
  assert.equal(m.mem.read16(0x8f43), 0x8042, "(0x8f43) = 0x8042");
  assert.equal(m.mem.read8(0x8921), 0x01, "(0x8921) advanced 0 -> 1");
  // loop-2 end state
  assert.equal(m.regs.ix, 0x0106, "IX walked 0x0092 + 116 (proves the ixl->ixh page carry)");
  assert.equal(m.regs.b, 0x00, "loop 2 counter exhausted");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  // landmarks in lieu of a 1000-entry pcSeq
  assert.equal(m.pcSeq.filter((p) => p === 0x7486).length, 116, "loop-2 head entered 116 times");
  assert.equal(m.pcSeq.filter((p) => p === 0x7495).length, 1, "inc ixh (page carry) fired exactly once");
  assert.equal(m.pcSeq.filter((p) => p === 0x7477).length, 8, "loop-1 head reached 8 times (1 entry via `ld b` + 7 djnz)");
  assert.equal(m.pcSeq.at(-1), CALLER_RET, "final PC is the caller");
  assert.equal(m.pcSeq.at(-2), 0x7499, "last routine instruction is the ret at 0x7499");
});

// ── Abort path: loop 1 clean, loop 2 first byte diverges -> jp nz,0x67df ─────────────────────────
test("loc_744e abort: loop-2 signature mismatch -> delegates to 0x67df; 617 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x0092, 0x01); // ROM[0x0092] != reference copy (0x74a2 stays 0) -> first loop-2 cp fails

  loc_744e(m);

  assert.equal(m.tstates, 617, "setup + loop1 x8 + one loop-2 compare then abort");
  assert.deepEqual(m.calls, [0x67df], "loop-2 mismatch aborts to 0x67df");
  assert.equal(m.pc, 0x67df, "control transferred to the abort vector");
  assert.equal(m.mem.read8(0x8921), 0x01, "(0x8921) already advanced before the check");
});

// ── MUTATION: `ld (0x8f45),de` (ed 53, 20T) mis-charged as 16T (the ld (nn),hl cost) is caught ──
test("loc_744e MUTATION: ld (nn),de at 0x745b mis-charged 16T is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x745f ? 16 : c); // landing after 0x745b is 0x745f
  loc_744e(m);
  assert.equal(m.tstates, 10677, "mutation loses 4 T (20 -> 16)");
  assert.notEqual(m.tstates, 10681, "golden T-state total catches the mutant");
});
