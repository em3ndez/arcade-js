// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_4b1a (ROM 0x4b1a, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image.
 *
 * loc_4b1a advances the 16-bit PRNG value at 0x800d(low)/0x800e(high) one shift-
 * register step, reseeding C=0x02 when the value is all-zero. The tests pin BOTH
 * control-flow arms with hand-computed goldens:
 *
 *   PRIMARY (value non-zero, jr taken): C0=(0x800d)=0x6B, B0=(0x800e)=0xA4
 *       or c = 0xEF (nz) -> C kept.
 *       srl c:0x6B->0x35(c=1); a=0x35; srl a:->0x1A(c=1); xor c:0x1A^0x35=0x2F;
 *       sla c:0x35->0x6A; srl a:0x2F->0x17(c=1); a=b=0xA4;
 *       rra: (0xA4>>1)|0x80 = 0xD2 (c out=0) -> (0x800e)=0xD2;
 *       a=c=0x6A; rra: 0x6A>>1 = 0x35 (c out=0) -> (0x800d)=0x35.
 *       142 T.  final C=0x6A, final carry clear.
 *
 *   SEED (value all-zero, jr NOT taken -> ld c,0x02): C0=B0=0x00
 *       C reseeded 0x02; the same shift yields (0x800e)=0x80, (0x800d)=0x01.
 *       144 T (jr not-taken 7 + ld c,0x02 7 vs the taken jr 12: +2 over the primary).
 *
 * Plus TWO deliberate mutations the goldens must catch:
 *   (a) a CB `srl a` mis-charged 4T (as a non-CB op) -- caught by the T-state total;
 *   (b) the two output stores swapped (0x800d<->0x800e) -- the classic adjacent-
 *       address slip -- caught by the memory assertions.
 *
 * Run: node --test games/thepit/translated/test/loc_4b1a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C } from "../../../../core/cpu/z80.js";
import { loc_4b1a } from "../loc_4b1a.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
    },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs,
    mem,
    ram,
    calls: [],
    tstates: 0,
    pc: 0x4b1a,
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
    },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) {
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // loc_4b1a makes no calls
    },
  };
}

const CALLER_RET = 0xabcd;

// Seed the 16-bit value, seat a caller return address, and run.
function run(m, low, high) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
  m.ram[0x800d] = low;
  m.ram[0x800e] = high;
  loc_4b1a(m);
}

// -- PRIMARY path: value non-zero, jr taken, C kept -------------------------------
function assertPrimary(m) {
  assert.equal(m.tstates, 142, "T-state total for the jr-taken path");
  assert.equal(m.ram[0x800e], 0xd2, "new high byte stored at 0x800e");
  assert.equal(m.ram[0x800d], 0x35, "new low byte stored at 0x800d");
  assert.equal(m.regs.c, 0x6a, "C ends 0x6a (kept + shifted; NOT reseeded to 0x02)");
  assert.equal(m.regs.b, 0xa4, "B (high byte) untouched by the shift");
  assert.equal(m.regs.f & F_C, 0, "carry clear after the final rra (0x6a bit0 = 0)");
  assert.equal(m.pc, CALLER_RET, "ret popped the caller's return address");
  assert.deepEqual(m.calls, [], "no calls");
}

test("loc_4b1a: primary (non-zero) path -- shift, store, 142 T, ret", () => {
  const m = makeMachine();
  run(m, 0x6b, 0xa4);
  assertPrimary(m);
});

// -- SEED path: value all-zero, jr NOT taken, ld c,0x02 ---------------------------
function assertSeed(m) {
  assert.equal(m.tstates, 144, "T-state total for the reseed (jr not-taken) path");
  assert.equal(m.ram[0x800e], 0x80, "new high byte from the reseeded value");
  assert.equal(m.ram[0x800d], 0x01, "new low byte from the reseeded value");
  assert.equal(m.regs.c, 0x02, "C reseeded 0x02 then shifted back to 0x02");
  assert.equal(m.pc, CALLER_RET, "ret popped the caller's return address");
}

test("loc_4b1a: seed (all-zero) path -- reseeds C=0x02, 144 T", () => {
  const m = makeMachine();
  run(m, 0x00, 0x00);
  assertSeed(m);
});

// -- MUTATION (a): a CB `srl a` mis-charged as a non-CB 4T op ----------------------
// The four CB shifts are 8T each; charging one as 4T (forgetting the CB prefix) is
// a plausible slip. Confirm the golden T-state total catches the 4-cycle loss.
test("loc_4b1a MUTATION: CB `srl a` mis-charged 4T (not 8T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) =>
    realStep(nextAddr, nextAddr === 0x4b2c ? 4 : cycles); // srl a @0x4b2a -> 0x4b2c

  run(m, 0x6b, 0xa4);

  assert.equal(m.tstates, 138, "mutation loses exactly 4 T (8 -> 4)");
  assert.throws(() => assertPrimary(m), /T-state total/, "the golden total must fail");
});

// -- MUTATION (b): the two output stores swapped (0x800d <-> 0x800e) ---------------
// The routine reads C from 0x800d and B from 0x800e, then stores the NEW high byte
// to 0x800e and the NEW low byte to 0x800d. Swapping the two adjacent store
// addresses is the classic translation slip; confirm the memory goldens catch it.
test("loc_4b1a MUTATION: swapped output stores (0x800d<->0x800e) is caught", () => {
  const m = makeMachine();
  const realWrite = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v) => {
    const dst = a === 0x800d ? 0x800e : a === 0x800e ? 0x800d : a;
    realWrite(dst, v);
  };

  run(m, 0x6b, 0xa4);

  // The swap lands 0xD2 at 0x800d and 0x35 at 0x800e -- the mirror of the golden.
  assert.equal(m.ram[0x800d], 0xd2, "mutant put the high byte at the low address");
  assert.equal(m.ram[0x800e], 0x35, "mutant put the low byte at the high address");
  assert.throws(() => assertPrimary(m), /0x800e/, "a memory golden must fail");
});
