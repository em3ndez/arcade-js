// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_02ca (ROM 0x02ca, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine). The
 * mock logs every m.call target and counts every m.ret, so this routine's loop
 * count and tail-jump control flow can be asserted directly. Callees are opaque:
 * they charge and pop nothing, so retCount and tstates measure ONLY loc_02ca's
 * own instructions.
 *
 * loc_02ca fires a fixed 5-call setup, arms the counter (0x800a)=8, then repeats a
 * 4-call body 8 times before TAIL-jumping to loc_031a. Distinctive facts pinned:
 *   - The body runs EXACTLY 8 times (memory counter 8..1, `dec a` + `jr nz`), so
 *     0x47e1 fires 8x, 0x4bff 16x (twice per iter), 0x4816 8x; (0x800a) exits 0.
 *   - It has NO ret of its own — the closing `jp 0x031a` is a tail-jump — so
 *     retCount MUST stay 0 and the tail pushes nothing.
 *   - Full T-state total is 1119 (122 setup + 987 loop + 10 tail); the loop is
 *     8*112 body + 7*12 (jr taken) + 7 (final jr not taken).
 *
 * MUTATION: model the tail `jp 0x031a` as a CALL+RET (m.call then m.ret) — the
 * exact trap the thepit convention warns against. The spurious ret bumps retCount
 * to 1, charges +10 T, and moves the PC off the tail target; the golden
 * retCount / PC / T-state assertions catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_02ca.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02ca } from "../loc_02ca.js";

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
    pc: 0x02ca,
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

function setup(m) {
  m.regs.sp = 0x8780; // inside work RAM, above the counter at 0x800a
  m.push16(CALLER_RET);
  m.pushes.length = 0; // drop the seat push; keep only the routine's own pushes
  m.ram[0x800a] = 0x77; // poison: a golden 0 can only come from the loop counting down
  m.regs.a = 0x55; // poison A; the routine reloads it from memory each iteration
}

const SETUP_CALLS = [0x4644, 0x4b55, 0x4c4d, 0x4b40, 0x4c5f, 0x483a];
const BODY_CALLS = [0x47e1, 0x4bff, 0x4816, 0x4bff];
// setup (6) + 8x body (32) + tail-jump (1) = 39
const EXPECTED_CALLS = [
  ...SETUP_CALLS,
  ...Array.from({ length: 8 }, () => BODY_CALLS).flat(),
  0x031a,
];

// -- Golden full run: 8-iteration loop then tail-jump to loc_031a ------------
test("loc_02ca: 5-call setup, 8x body loop, tail-jump 0x031a, 1119 T", () => {
  const m = makeMachine();
  setup(m);

  loc_02ca(m);

  assert.equal(m.ram[0x800a], 0x00, "(0x800a) counter counted 8 down to 0");
  assert.equal(m.regs.a, 0x00, "A holds the final decremented counter, 0");
  assert.deepEqual(m.calls, EXPECTED_CALLS, "exact call order incl. the tail-jump");
  assert.equal(
    m.calls.filter((a) => a === 0x47e1).length, 8,
    "0x47e1 fires once per body iteration -> 8x",
  );
  assert.equal(
    m.calls.filter((a) => a === 0x4bff).length, 16,
    "0x4bff fires twice per body iteration -> 16x",
  );
  assert.equal(
    m.calls.filter((a) => a === 0x4816).length, 8,
    "0x4816 fires once per body iteration -> 8x",
  );
  assert.equal(m.retCount, 0, "tail-jump: NO ret of its own -- callee returns to our caller");
  assert.equal(m.pushes.length, 38, "6 setup + 32 body call-pushes; the tail jp pushes nothing");
  assert.equal(m.pc, 0x031a, "PC left at the tail target loc_031a");
  assert.equal(m.tstates, 1119, "122 setup + 987 loop + 10 tail");
});

// -- The loop must run 8 times, not once: a single-pass body would leave a
//    non-zero counter and the wrong call multiset --------------------------
test("loc_02ca: counter drives the loop -- not a single pass", () => {
  const m = makeMachine();
  setup(m);
  loc_02ca(m);
  // A single (broken) pass would fire 0x47e1 once and leave (0x800a)=7.
  assert.notEqual(m.ram[0x800a], 0x07, "counter is not left at 7 (that would be one pass)");
  assert.equal(m.calls.filter((a) => a === 0x47e1).length, 8, "body ran the full 8 iterations");
});

// -- MUTATION: tail-jump mis-modelled as CALL+RET is caught -------------------
// The convention warns the tail `jp 0x031a` is NOT `m.call(0x031a); m.ret()`.
// Simulate that slip by making the tail m.call also perform a ret. The spurious
// ret pops the top-of-stack (the last internal call's pushed return, since the
// mock's opaque callees never pop their own) and charges +10 T. The golden
// ret-count / PC / T-state assertions must catch it.
test("loc_02ca MUTATION: tail-jump mis-modelled as call+ret is caught", () => {
  const m = makeMachine();
  setup(m);
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    const r = realCall(addr);
    if (addr === 0x031a) m.ret(); // the spurious ret the tail-jump must NOT do
    return r;
  };

  loc_02ca(m);

  assert.equal(m.retCount, 1, "mutation performed one (spurious) ret");
  assert.notEqual(m.pc, 0x031a, "spurious ret moved the PC off the tail target");
  assert.equal(m.tstates, 1129, "mutation charges a spurious +10 T (1119 -> 1129)");

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
