// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_02e1 (ROM 0x02e1, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine). The
 * mock logs every m.call target and counts every m.ret, so this routine's loop
 * count and tail-jump control flow can be asserted directly. Callees are opaque:
 * they charge and pop nothing, so retCount and tstates measure ONLY loc_02e1's
 * own instructions.
 *
 * loc_02e1 is the loop head: it repeats a 4-call body {0x47e1, 0x4bff, 0x4816,
 * 0x4bff} while the RAM counter (0x800a) counts down (`dec a` + `jr nz`), then
 * TAIL-jumps to loc_031a. Distinctive facts pinned (entry counter = 3):
 *   - The body runs EXACTLY 3 times (memory counter 3..1), so 0x47e1 fires 3x,
 *     0x4bff 6x (twice per iter), 0x4816 3x; (0x800a) exits 0 and A exits 0.
 *   - It has NO ret of its own — the closing `jp 0x031a` is a tail-jump — so
 *     retCount MUST stay 0 and the tail pushes nothing.
 *   - T-state total for 3 iters is 377 = 3*112 body + 2*12 (jr taken)
 *     + 7 (final jr not taken) + 10 (tail jp).
 *   - do/while: the body always runs at least once — entry counter 1 runs it once.
 *
 * MUTATION: model the tail `jp 0x031a` as a CALL+RET (m.call then m.ret) — the
 * exact trap the thepit convention warns against. The spurious ret bumps retCount
 * to 1, charges +10 T, and moves the PC off the tail target; the golden
 * retCount / PC / T-state assertions catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_02e1.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02e1 } from "../loc_02e1.js";

const CALLER_RET = 0xabcd; // a wrong ret would visibly move the PC off the tail

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
    calls: [], // every m.call target, in order
    pushes: [], // every push16 value -- the tail-jump pushes NOTHING
    retCount: 0, // number of m.ret invocations -- MUST stay 0 (tail-jump)
    tstates: 0,
    pc: 0x02e1,
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
      return undefined; // callees are opaque here; they charge/pop nothing
    },
  };
}

function setup(m, counter) {
  m.regs.sp = 0x8780; // inside work RAM, above the counter at 0x800a
  m.push16(CALLER_RET);
  m.pushes.length = 0; // drop the seat push; keep only the routine's own pushes
  m.ram[0x800a] = counter & 0xff; // entry loop count
  m.regs.a = 0x55; // poison A; the routine reloads it from memory each iteration
}

const BODY_CALLS = [0x47e1, 0x4bff, 0x4816, 0x4bff];
const BODY_PUSHES = [0x02e4, 0x02e9, 0x02ec, 0x02f1];

// -- Golden full run: 3-iteration loop then tail-jump to loc_031a ------------
test("loc_02e1: 3x body loop (counter 3), tail-jump 0x031a, 377 T", () => {
  const m = makeMachine();
  setup(m, 3);

  loc_02e1(m);

  const EXPECTED_CALLS = [
    ...Array.from({ length: 3 }, () => BODY_CALLS).flat(),
    0x031a,
  ];

  assert.equal(m.ram[0x800a], 0x00, "(0x800a) counter counted 3 down to 0");
  assert.equal(m.regs.a, 0x00, "A holds the final decremented counter, 0");
  assert.deepEqual(m.calls, EXPECTED_CALLS, "exact call order incl. the tail-jump");
  assert.equal(
    m.calls.filter((a) => a === 0x47e1).length, 3,
    "0x47e1 fires once per body iteration -> 3x",
  );
  assert.equal(
    m.calls.filter((a) => a === 0x4bff).length, 6,
    "0x4bff fires twice per body iteration -> 6x",
  );
  assert.equal(
    m.calls.filter((a) => a === 0x4816).length, 3,
    "0x4816 fires once per body iteration -> 3x",
  );
  assert.equal(m.retCount, 0, "tail-jump: NO ret of its own -- callee returns to our caller");
  assert.deepEqual(
    m.pushes,
    [...Array.from({ length: 3 }, () => BODY_PUSHES).flat()],
    "3*4 call-pushes (return addrs); the tail jp pushes nothing",
  );
  assert.equal(m.pc, 0x031a, "PC left at the tail target loc_031a");
  assert.equal(m.tstates, 377, "3*112 body + 2*12 jr-taken + 7 jr-not-taken + 10 tail");
});

// -- The memory counter drives the loop: it is do/while (runs >=1), and the
//    iteration count follows (0x800a), not a fixed constant ------------------
test("loc_02e1: counter drives the loop -- do/while runs the body once at count 1", () => {
  const m = makeMachine();
  setup(m, 1);

  loc_02e1(m);

  assert.equal(m.calls.filter((a) => a === 0x47e1).length, 1, "count 1 -> exactly one body pass");
  assert.equal(m.ram[0x800a], 0x00, "counter 1 -> 0");
  assert.equal(m.retCount, 0, "still a tail-jump, no ret");
  assert.equal(m.pc, 0x031a, "reaches the tail target after one pass");
  assert.equal(m.tstates, 129, "1*112 body + 7 jr-not-taken + 10 tail");
});

// -- MUTATION: tail-jump mis-modelled as CALL+RET is caught -------------------
// The convention warns the tail `jp 0x031a` is NOT `m.call(0x031a); m.ret()`.
// Simulate that slip by making the tail m.call also perform a ret. The spurious
// ret pops the top-of-stack (the last body call's pushed return, since the
// mock's opaque callees never pop their own) and charges +10 T. The golden
// ret-count / PC / T-state assertions must catch it.
test("loc_02e1 MUTATION: tail-jump mis-modelled as call+ret is caught", () => {
  const m = makeMachine();
  setup(m, 3);
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    const r = realCall(addr);
    if (addr === 0x031a) m.ret(); // the spurious ret the tail-jump must NOT do
    return r;
  };

  loc_02e1(m);

  assert.equal(m.retCount, 1, "mutation performed one (spurious) ret");
  assert.notEqual(m.pc, 0x031a, "spurious ret moved the PC off the tail target");
  assert.equal(m.tstates, 387, "mutation charges a spurious +10 T (377 -> 387)");

  // And the golden assertions must fail on this mutant.
  assert.throws(
    () => assert.equal(m.retCount, 0, "tail-jump: NO ret of its own"),
    /NO ret/,
    "the golden ret-count assertion must fail on the mutant",
  );
  assert.throws(
    () => assert.equal(m.pc, 0x031a, "PC at tail target"),
    undefined,
    "the golden PC assertion must fail on the mutant",
  );
});
