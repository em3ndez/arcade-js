// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_186a (ROM 0x186A-0x186E, The Pit): a thin prologue
// that picks frame/sprite id 0x34 into 0x8069 and FALLS THROUGH (no jump byte) into the
// shared position/pointer builder loc_186f (0x186f). loc_186f's own ret unwinds to
// loc_186a's caller, so the fall-through is modelled `return m.call(0x186f)` with NO m.ret
// (single unwind through loc_186a).
//
// loc_186f is NOT yet translated, so its dispatch cannot run end-to-end here. Instead the
// mock's call(0x186f) is a TAIL-CALLEE STUB: it snapshots loc_186a's LOCAL charge/effects
// at the handoff instant, then simulates loc_186f's eventual `ret` (a SINGLE pop of the
// seated caller). This isolates and pins exactly loc_186a's contract:
//   * local T total at handoff = ld a,0x34 (7) + ld (0x8069),a (13) = 20 T;
//   * boundary sequence [0x186c, 0x186f] up to the handoff;
//   * mem[0x8069] = 0x34 and A = 0x34 at handoff; F unchanged (no-flag ops);
//   * the tail-jump reaches 0x186f exactly once and loc_186a itself never calls m.ret,
//     so the callee's single ret unwinds SP to its pre-call value (no double-pop).
//
// TEETH (three mutations):
//   1. payload: `ld a,0x34` swapped for `ld a,0x33` (sibling loc_1864's value) -- flips
//      the stored frame id and A 0x34 -> 0x33; CAUGHT.
//   2. cycles: `ld (0x8069),a` charged 20 T (as if it were a wider op) instead of 13 --
//      local total 27, not 20; CAUGHT by the T-state assertion.
//   3. double-pop: a trailing m.ret() after the tail m.call -- SP unwinds twice and the
//      return lands off the seated caller; CAUGHT by the SP/pc control-flow asserts.
//
// A real Regs (z80.js) gives exact flags; a flat 64K RAM backs memory; step/push16/pop16/
// ret mirror the DK Machine, with a pcSeq stepcheck log.
//
// Run: node --test games/thepit/translated/test/loc_186a.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_S, F_C, F_Z, F_H } from "../../../../core/cpu/z80.js";
import { loc_186a } from "../loc_186a.js";

const CALLER_RET = 0xabcd; // seated on the stack; the closing (callee) ret must pop THIS

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
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
    tstates: 0,
    pc: 0x186a,
    pcSeq: [],
    returned: false,
    retCount: 0,
    tailCalls: [],
    // Handoff snapshot -- filled by the loc_186f stub the instant control reaches it.
    handoff: null,
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
      this.pcSeq.push(nextAddr);
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
      this.returned = true;
      this.retCount += 1;
      this.step(this.pop16(), cycles);
    },
    // loc_186a's only transfer of control: the fall-through into loc_186f. loc_186f is
    // not translated yet, so this stub stands in for it: snapshot loc_186a's local state
    // at the handoff, then perform loc_186f's SINGLE ret to the seated caller.
    call(addr) {
      if (addr !== 0x186f) {
        throw new Error(`loc_186a only falls into 0x186f; got call(0x${addr.toString(16)})`);
      }
      this.tailCalls.push(addr);
      this.handoff = {
        tstates: this.tstates,        // loc_186a's LOCAL cycle charge so far
        pcSeq: this.pcSeq.slice(),     // boundaries up to the handoff
        a: regs.a,
        f: regs.f,
        frameByte: mem.read8(0x8069),
        sp: regs.sp,                   // must equal the pre-call SP (nothing pushed)
      };
      // Simulate loc_186f's own ret -- ONE pop, unwinding loc_186a's caller.
      this.ret();
      return this.a; // forwarded value (harmless; loc_186a returns whatever the tail does)
    },
  };
}

// Seat the caller's CALL: a known return address on the stack.
function seatCaller(m) {
  m.regs.sp = 0x8782;
  m.push16(CALLER_RET); // -> sp = 0x8780 holds 0xABCD
}
const PRECALL_SP = 0x8780;

// Instruction-boundary sequence loc_186a walks before the handoff: `ld a,0x34` -> 0x186c,
// then `ld (0x8069),a` -> 0x186f.
const EXPECTED_HANDOFF_SEQ = [0x186c, 0x186f];

function assertGolden(m) {
  assert.notEqual(m.handoff, null, "the tail-jump into loc_186f must be reached");
  const h = m.handoff;

  // Local T at handoff: ld a,0x34 (7) + ld (0x8069),a (13) = 20.
  assert.equal(h.tstates, 20, "20 T charged locally before the fall-through (7 + 13)");

  // The frame id and A at the handoff instant.
  assert.equal(h.frameByte, 0x34, "mem[0x8069] = 0x34 at handoff");
  assert.equal(h.a, 0x34, "A = 0x34 at handoff");

  // The fall-through pushes NOTHING: SP at handoff is still the pre-call SP.
  assert.equal(h.sp, PRECALL_SP, "no return address pushed by the fall-through");

  // Exactly one tail-jump, to 0x186f.
  assert.deepEqual(m.tailCalls, [0x186f], "fell through into loc_186f exactly once");

  // stepcheck: loc_186a's own boundaries, in order, up to the handoff.
  assert.deepEqual(h.pcSeq, EXPECTED_HANDOFF_SEQ, "step targets match [0x186c, 0x186f]");

  // Control flow: loc_186f's SINGLE ret popped the seated caller. loc_186a adds no ret of
  // its own, so SP unwinds exactly once back to its pre-call value (no double-pop).
  assert.equal(m.returned, true, "ret executed (via loc_186f's stub)");
  assert.equal(m.retCount, 1, "exactly one ret -- loc_186a does not add its own (tail-jump)");
  assert.equal(m.pc, CALLER_RET, "returned to the seated caller (0xABCD)");
  assert.equal(m.regs.sp, 0x8782, "SP unwound to its pre-call value (single unwind)");
}

function runGolden(routine) {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00; // arbitrary; loc_186a overwrites it with 0x34
  const ret = routine(m);
  return { m, ret };
}

test("loc_186a: stores frame id 0x34 into 0x8069, falls into loc_186f, 20 T local", () => {
  const { m } = runGolden(loc_186a);
  assertGolden(m);
  console.log("  loc_186a: mem[0x8069]=0x34, A=0x34, tail->0x186f, ret->0xABCD, 20 T local");
});

test("loc_186a: ld a,0x34 / ld (nn),a touch no flags -- F reaches loc_186f intact", () => {
  const seedF = F_S | F_C | F_Z | F_H; // distinctive seed
  const m = makeMachine();
  seatCaller(m);
  m.regs.f = seedF;
  loc_186a(m);
  assert.equal(m.handoff.f, seedF, "F unchanged at the handoff into loc_186f");
});

// -- TEETH #1: payload immediate -------------------------------------------------
// A faithful copy of loc_186a with EXACTLY ONE break: `ld a,0x34` swapped for `ld a,0x33`
// (sibling loc_1864's frame value) -- the byte that selects THIS prologue's frame. It then
// still falls into loc_186f, but with the wrong id stored.
function brokenLoc186aPayload(m) {
  const { regs, mem } = m;
  regs.a = 0x33; // BUG: ld a,0x33 (sibling loc_1864's value) instead of 0x34
  m.step(0x186c, 7);
  mem.write8(0x8069, regs.a);
  m.step(0x186f, 13);
  return m.call(0x186f);
}

test("TEETH: the ld a,0x34 -> ld a,0x33 payload twin is CAUGHT by the contract", () => {
  assertGolden(runGolden(loc_186a).m); // real routine passes

  const { m } = runGolden(brokenLoc186aPayload);
  assert.throws(
    () => assertGolden(m),
    /0x8069/,
    "the contract FAILED to catch ld a,0x34 -> ld a,0x33 -- it has no teeth",
  );
  assert.equal(m.handoff.frameByte, 0x33, "mutant: mem[0x8069] = 0x33 (wrong frame)");
  assert.equal(m.handoff.a, 0x33, "mutant: A = 0x33 (wrong frame id)");
});

// -- TEETH #2: cycle count -------------------------------------------------------
// A faithful copy whose ONLY break is charging 20 T for `ld (0x8069),a` (as if it were a
// wider store) instead of 13. Same memory/register effects; only the local T total moves
// 20 -> 27, which the T-state assertion catches.
function brokenLoc186aCycles(m) {
  const { regs, mem } = m;
  regs.a = 0x34;
  m.step(0x186c, 7);
  mem.write8(0x8069, regs.a);
  m.step(0x186f, 20); // BUG: 20 T rather than ld (nn),a's 13 T
  return m.call(0x186f);
}

test("TEETH: a wrong store cycle charge (13 -> 20) is CAUGHT by the local T total", () => {
  const { m } = runGolden(brokenLoc186aCycles);
  assert.throws(
    () => assertGolden(m),
    /20 T charged locally/,
    "the T-state assertion FAILED to catch a 13 -> 20 cycle error -- it has no teeth",
  );
  assert.equal(m.handoff.tstates, 27, "mutant: 27 T local (7 + 20), not 20");
});

// -- TEETH #3: double-pop --------------------------------------------------------
// A faithful copy whose ONLY break is adding a trailing m.ret() after the tail m.call --
// the classic tail-jump mistake. The callee stub already popped the seated caller; this
// second ret pops again, so SP overshoots and control lands off the seated caller.
function brokenLoc186aDoublePop(m) {
  const { regs, mem } = m;
  regs.a = 0x34;
  m.step(0x186c, 7);
  mem.write8(0x8069, regs.a);
  m.step(0x186f, 13);
  m.call(0x186f);
  m.ret(); // BUG: second unwind -- double-pop past the seated caller
}

test("TEETH: a trailing m.ret (double-pop) after the tail-jump is CAUGHT", () => {
  const { m } = runGolden(brokenLoc186aDoublePop);
  assert.throws(
    () => assertGolden(m),
    /single unwind|exactly one ret/,
    "the control-flow asserts FAILED to catch a double-pop -- they have no teeth",
  );
  assert.equal(m.retCount, 2, "mutant: two rets (callee's + loc_186a's own)");
  assert.notEqual(m.regs.sp, 0x8782, "mutant: SP overshot its pre-call value");
});
