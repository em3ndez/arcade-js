// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_2fb7 (ROM 0x2fb7, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine). The
 * mock logs every m.call target and counts every m.ret, so this routine's loop
 * count and fall-through delegation can be asserted directly. loc_2fc0 is opaque:
 * the mock's m.call charges/pops nothing, so retCount and tstates measure ONLY
 * loc_2fb7's own instructions.
 *
 * loc_2fb7 is a `djnz` column blit: copies B bytes from (IX)++ into (HL), stepping
 * HL by DE (0xffe0 = -0x20) each pass, then FALLS THROUGH into loc_2fc0. Facts
 * pinned (entry B=6, HL=0x938c, DE=0xffe0, IX -> 6 distinct source bytes):
 *   - The body runs EXACTLY 6 times: 6 bytes copied, IX advances +6, B exits 0.
 *   - Destination stride is DE = -0x20, so the 6 cells are 0x938c,0x936c,0x934c,
 *     0x932c,0x930c,0x92ec and HL exits at 0x92cc (0x938c - 6*0x20).
 *   - Each cell gets the matching source byte; A exits holding the last one.
 *   - It has NO ret of its own -- the exit is a FALL-THROUGH delegated as
 *     `m.call(0x2fc0)` -- so calls == [0x2fc0], retCount == 0, pushes == [].
 *   - T-state total = 355 = 6*47 body + 5*13 djnz-taken + 8 djnz-not-taken,
 *     where body = 19 (ld a,(ix)) + 7 (ld (hl),a) + 11 (add hl,de) + 10 (inc ix).
 *
 * MUTATION: model the fall-through into loc_2fc0 as a CALL+RET (m.call then m.ret)
 * -- the exact double-pop trap the thepit convention warns against for a delegated
 * boundary. The spurious ret bumps retCount to 1, charges +10 T, and pops the
 * caller's return so the PC leaves 0x2fc0; the golden retCount / PC / T-state
 * assertions catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_2fb7.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2fb7 } from "../loc_2fb7.js";

const CALLER_RET = 0xabcd; // a spurious ret would visibly move the PC off 0x2fc0

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
    calls: [], // every m.call target, in order -- expect just [0x2fc0]
    pushes: [], // every push16 value -- the blit + delegation push NOTHING
    retCount: 0, // number of m.ret invocations -- MUST stay 0 (fall-through)
    tstates: 0,
    pc: 0x2fb7,
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
    },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
      this.pushes.push(v & 0xffff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) {
      this.retCount += 1;
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // loc_2fc0 is opaque here; it charges/pops nothing
    },
  };
}

const IX_SRC = 0x8100; // source table (work RAM), 6 distinct bytes
const SRC_BYTES = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66];
const DEST_CELLS = [0x938c, 0x936c, 0x934c, 0x932c, 0x930c, 0x92ec]; // stride -0x20

function setup(m) {
  m.regs.sp = 0x8780; // inside work RAM, above the source/dest
  m.push16(CALLER_RET);
  m.pushes.length = 0; // drop the seat push; keep only the routine's own pushes
  for (let i = 0; i < SRC_BYTES.length; i++) m.ram[IX_SRC + i] = SRC_BYTES[i];
  m.regs.ix = IX_SRC; // source pointer
  m.regs.hl = 0x938c; // top cell of the tilemap column
  m.regs.de = 0xffe0; // -0x20 stride
  m.regs.b = 0x06; // loop count
  m.regs.a = 0x99; // poison A; the routine reloads it each iteration
}

// -- Golden full run: 6-byte column blit then fall-through to loc_2fc0 --------
test("loc_2fb7: 6-byte blit, stride -0x20, delegates to loc_2fc0, 355 T", () => {
  const m = makeMachine();
  setup(m);

  loc_2fb7(m);

  // Every destination cell got its matching source byte.
  for (let i = 0; i < DEST_CELLS.length; i++) {
    assert.equal(
      m.ram[DEST_CELLS[i]], SRC_BYTES[i],
      `cell 0x${DEST_CELLS[i].toString(16)} <- source byte ${i}`,
    );
  }
  assert.equal(m.regs.b, 0x00, "B counted 6 down to 0");
  assert.equal(m.regs.ix, IX_SRC + 6, "IX advanced by 6 (inc ix per pass)");
  assert.equal(m.regs.hl, 0x92cc, "HL = 0x938c - 6*0x20 after the final add hl,de");
  assert.equal(m.regs.a, 0x66, "A holds the last source byte copied");
  assert.deepEqual(m.calls, [0x2fc0], "single fall-through delegation to loc_2fc0");
  assert.equal(m.retCount, 0, "fall-through: NO ret of its own -- loc_2fc0 returns to our caller");
  assert.deepEqual(m.pushes, [], "the blit and the delegation push nothing");
  assert.equal(m.pc, 0x2fc0, "PC left at the fall-through boundary loc_2fc0");
  assert.equal(m.tstates, 355, "6*47 body + 5*13 djnz-taken + 8 djnz-not-taken");
});

// -- The djnz count drives the loop: iteration count follows B, not a constant.
//    B=1 copies exactly one byte and still delegates. ------------------------
test("loc_2fb7: B drives the loop -- B=1 copies one byte, still delegates", () => {
  const m = makeMachine();
  setup(m);
  m.regs.b = 0x01;

  loc_2fb7(m);

  assert.equal(m.ram[0x938c], 0x11, "the one byte landed in the top cell");
  assert.equal(m.ram[0x936c], 0x00, "the second cell was NOT written");
  assert.equal(m.regs.b, 0x00, "B: 1 -> 0");
  assert.equal(m.regs.ix, IX_SRC + 1, "IX advanced by exactly 1");
  assert.equal(m.regs.hl, 0x936c, "HL stepped once by -0x20");
  assert.deepEqual(m.calls, [0x2fc0], "still delegates to loc_2fc0");
  assert.equal(m.retCount, 0, "no ret");
  assert.equal(m.pc, 0x2fc0, "reaches the boundary after one pass");
  assert.equal(m.tstates, 55, "1*47 body + 8 djnz-not-taken");
});

// -- MUTATION: fall-through mis-modelled as CALL+RET is caught -----------------
// The convention warns the fall-through into loc_2fc0 is `m.call(0x2fc0)` alone,
// NOT `m.call(0x2fc0); m.ret()`. Simulate that slip by making the delegation
// m.call also perform a ret. The spurious ret pops the caller's seated return
// (CALLER_RET) and charges +10 T. The golden ret-count / PC / T-state assertions
// must catch it.
test("loc_2fb7 MUTATION: fall-through mis-modelled as call+ret is caught", () => {
  const m = makeMachine();
  setup(m);
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    const r = realCall(addr);
    if (addr === 0x2fc0) m.ret(); // the spurious ret the fall-through must NOT do
    return r;
  };

  loc_2fb7(m);

  assert.equal(m.retCount, 1, "mutation performed one (spurious) ret");
  assert.equal(m.pc, CALLER_RET, "spurious ret popped the caller return, leaving the boundary");
  assert.equal(m.tstates, 365, "mutation charges a spurious +10 T (355 -> 365)");

  // And the golden assertions must fail on this mutant.
  assert.throws(
    () => assert.equal(m.retCount, 0, "fall-through: NO ret of its own"),
    /NO ret/,
    "the golden ret-count assertion must fail on the mutant",
  );
  assert.throws(
    () => assert.equal(m.pc, 0x2fc0, "PC at boundary loc_2fc0"),
    undefined,
    "the golden PC assertion must fail on the mutant",
  );
});
