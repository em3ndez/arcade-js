// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0929 (ROM 0x0929, Pooyan) -- ROM signature/protection check.
 *
 * Pinned paths:
 *   (A) ret nz path: entry carry CLEAR (jr c not taken) + Z CLEAR (so `ret nz` at 0x0931 is taken).
 *       ld b,b (4) + jr c nt (7) + ld b,0x19 (7) + call 0x02ce (17) + ret nz taken (11) = 46.
 *       Pops the seated caller; calls = [0x02ce].
 *   (B) carry / overlapping-instruction path -> signature MISMATCH trap: entry carry SET, so
 *       `jr c,0x0937` lands on the 0x8e byte inside `ld hl,0x8e51`, decoded as `adc a,(hl)`. Both
 *       paths converge at `inc (hl)` (0x0938). Spin (0x07f5)==0x11 passes on the first read; the
 *       first signature byte mismatches (mem[0x0838]=0x01 != mem[DE]=0x00) so `jr nz,0x0976` traps
 *       into the 0x0976 data table and control leaves the routine (no ret, caller stays on stack).
 *       T = 4+12+7+11+17+10+7 +7+7 +14+7 +10+4+17+7+4+4 +12 +7+4+19+4+12 = 207.
 *       calls = [0x02b9, 0x0c45]; caller return still on the stack.
 *
 * TEETH: mis-charge `ld b,b` (4 T) as 7 T on path A -- the golden T-state total must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_0929.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0929 } from "../loc_0929.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0929, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
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
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // model the callee running to its own ret: pop the return the site pushed so SP rebalances
    call(addr, site) { this.calls.push(addr); this.site = site; this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_0929 path A: carry clear, Z clear -> ret nz taken after call 0x02ce", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.f = 0x00; // C clear (jr c not taken), Z clear (fNZ true -> ret nz taken)

  loc_0929(m);

  assert.equal(m.tstates, 46, "T = 4 + 7 + 7 + 17 + 11");
  assert.deepEqual(m.pcSeq, [0x092a, 0x092c, 0x092e, 0x02ce, CALLER_RET],
    "ld b,b -> jr c nt -> ld b,0x19 -> call 0x02ce -> ret nz to caller");
  assert.deepEqual(m.calls, [0x02ce], "only the gate call before the ret nz ran");
  assert.equal(m.regs.b, 0x19, "B = 0x19 seeded before the gate call");
  assert.equal(m.regs.sp, 0x8780, "ret nz popped the seated caller (SP back to 0x8780)");
});

test("loc_0929 path B: carry set (overlapping adc a,(hl)) -> first signature byte mismatch traps to 0x0976", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.f = 0x01;        // C set -> jr c,0x0937 taken (overlapping instruction)
  m.regs.a = 0x00;
  m.regs.hl = 0x9000;     // adc a,(hl) / inc (hl) operate on the caller's HL on this path
  m.regs.de = 0x0000;     // E=0 -> after +0x1c, DE = 0x001c (no carry, no inc d)
  m.mem.write8(0x9000, 0x00);
  m.mem.write8(0x07f5, 0x11); // spin passes immediately: cp (hl) == 0x11 -> Z
  m.mem.write8(0x001c, 0x00); // (DE) table byte
  m.mem.write8(0x0838, 0x01); // (IX+0) signature byte differs -> cp c NZ -> jr nz,0x0976 trap

  loc_0929(m);

  assert.equal(m.tstates, 207,
    "T = 4+12+7+11+17+10+7 + 7+7 + 14+7 + 10+4+17+7+4+4 + 12 + 7+4+19+4 + 12");
  assert.deepEqual(m.pcSeq, [
    0x092a, 0x0937, 0x0938, 0x0939, 0x02b9, 0x093f, 0x0941, // through convergence + spin setup
    0x0942, 0x0944,                                          // spin cp (hl) match, jr nz nt
    0x0948, 0x094a,                                          // ld ix, ld b
    0x094d, 0x094e, 0x0c45, 0x0953, 0x0954, 0x0955,          // loop head + add a,e
    0x0958,                                                  // jr nc taken (no inc d)
    0x0959, 0x095a, 0x095d, 0x095e,                          // ld a,(de)..cp c
    0x0976,                                                  // jr nz,0x0976 mismatch trap
  ], "carry path overlaps into adc a,(hl), converges, spins once, mismatches on first table byte");
  assert.deepEqual(m.calls, [0x02b9, 0x0c45], "zero-fill then one table lookup before the trap");
  assert.equal(m.regs.ix, 0x0838, "IX not yet decremented (trap before dec ix)");
  assert.equal(m.regs.de, 0x001c, "DE = 0x1c + 0 (no carry into D)");
  assert.equal(m.regs.sp, 0x877e, "trap jump takes no ret: seated caller remains on the stack");
  assert.equal(m.pop16(), CALLER_RET, "caller return still on top of stack");
});

test("loc_0929 MUTATION: `ld b,b` mis-charged 7T (not 4T) on path A is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x092a ? 7 : cycles);
  seatCaller(m);
  m.regs.f = 0x00;

  loc_0929(m);

  assert.equal(m.tstates, 49, "mutation adds 3 T (4 -> 7)");
});
