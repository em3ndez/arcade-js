// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_031a (ROM 0x031a, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine). The
 * mock logs every m.call target and counts every m.ret; callees are opaque (they
 * charge and pop nothing), so retCount and tstates measure ONLY loc_031a's own
 * instructions.
 *
 * loc_031a runs a fixed setup call chain, makes a CONDITIONAL call (call c,0x47e1
 * gated on carry from `cp 0x02` over (0x8001)-1), computes (0x8011) = (0x804e) -
 * (0x8028), clears (0x8020) and (0x8010), then FALLS THROUGH into the main loop
 * loc_0348. Distinctive facts pinned:
 *   - The fall-through is modelled as `return m.call(0x0348)` with NO ret and NO
 *     extra T-states: retCount MUST stay 0, PC ends at 0x0348, nothing is pushed
 *     for the transfer.
 *   - `call c,0x47e1` fires ONLY when (0x8001)-1 < 2 (unsigned), i.e. (0x8001) in
 *     {1,2}: taken adds 0x47e1 to the call list, pushes 0x032c, and costs 17 T;
 *     not-taken costs 10 T and pushes nothing.
 *   - (0x8011) = (0x804e) - (0x8028) with `sub` flag semantics (B = subtrahend =
 *     (0x8028), A = minuend = (0x804e)); (0x8020) and (0x8010) end 0.
 *   - T-state total: 216 (call c not taken) / 223 (taken). The fall-through adds 0.
 *
 * MUTATION: model the fall-through into loc_0348 as a CALL+RET (m.call then m.ret)
 * -- the trap the thepit tail-jump convention warns against. The spurious ret bumps
 * retCount to 1, charges +10 T, and moves the PC off 0x0348; the golden retCount /
 * PC / T-state assertions catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_031a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C } from "../../../../core/cpu/z80.js";
import { loc_031a } from "../loc_031a.js";

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
    pushes: [], // every push16 value -- the tail fall-through pushes NOTHING
    retCount: 0, // number of m.ret invocations -- MUST stay 0 (fall-through)
    tstates: 0,
    pc: 0x031a,
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

// (0x8001) chosen so (0x8001)-1 >= 2 (no carry) unless overridden per test.
function setup(m, { s8001, s8028 = 0x10, s804e = 0x50 } = {}) {
  m.regs.sp = 0x8780; // inside work RAM, above the counters
  m.push16(CALLER_RET);
  m.pushes.length = 0; // drop the seat push; keep only the routine's own pushes
  m.ram[0x8001] = s8001 & 0xff;
  m.ram[0x8028] = s8028 & 0xff;
  m.ram[0x804e] = s804e & 0xff;
  m.regs.a = 0x77; // poison A; the routine reloads it from memory
}

const SETUP_CALLS = [0x4c67, 0x4644, 0x0673];
const MID_CALLS = [0x1362, 0x23e8, 0x24cf];
const SETUP_PUSHES = [0x031d, 0x0320, 0x0323];
const MID_PUSHES = [0x032f, 0x0332, 0x0335];

// -- Golden: call c NOT taken ((0x8001)=5 -> (5-1)=4 >= 2, no carry) ----------
test("loc_031a: call c not taken -> 7 calls, delay=(0x804e)-(0x8028), 216 T, tail 0x0348", () => {
  const m = makeMachine();
  setup(m, { s8001: 0x05, s8028: 0x10, s804e: 0x50 });

  loc_031a(m);

  assert.deepEqual(
    m.calls,
    [...SETUP_CALLS, ...MID_CALLS, 0x0348],
    "no 0x47e1; setup+mid chain then the tail fall-through call to loc_0348",
  );
  assert.ok(!m.calls.includes(0x47e1), "call c,0x47e1 NOT taken (carry clear)");
  assert.deepEqual(
    m.pushes,
    [...SETUP_PUSHES, ...MID_PUSHES],
    "6 call-pushes; the conditional call and the tail fall-through push nothing",
  );
  assert.equal(m.retCount, 0, "fall-through: NO ret of its own");
  assert.equal(m.pc, 0x0348, "PC left at the fall-through target loc_0348");
  assert.equal(m.tstates, 216, "206 body + 10 (call c not taken) + 0 (fall-through)");

  // Memory effects
  assert.equal(m.ram[0x8011], 0x40, "(0x8011) = (0x804e) 0x50 - (0x8028) 0x10 = 0x40");
  assert.equal(m.ram[0x8020], 0x00, "(0x8020) cleared");
  assert.equal(m.ram[0x8010], 0x00, "(0x8010) cleared");
  // Registers/flags: B is the subtrahend (0x8028); A ends 0 (ld a,0x00); the sub
  // did not borrow, so carry is clear.
  assert.equal(m.regs.b, 0x10, "B holds the subtrahend (0x8028)");
  assert.equal(m.regs.a, 0x00, "A ends 0 from `ld a,0x00`");
  assert.equal(m.regs.f & F_C, 0, "sub 0x50-0x10 did not borrow -> carry clear");
});

// -- Golden: call c TAKEN ((0x8001)=2 -> (2-1)=1 < 2, carry set) --------------
test("loc_031a: call c taken -> 0x47e1 in chain, pushes 0x032c, 223 T", () => {
  const m = makeMachine();
  setup(m, { s8001: 0x02, s8028: 0x21, s804e: 0x05 });

  loc_031a(m);

  assert.deepEqual(
    m.calls,
    [...SETUP_CALLS, 0x47e1, ...MID_CALLS, 0x0348],
    "0x47e1 sits between the setup and mid chains when carry is set",
  );
  assert.deepEqual(
    m.pushes,
    [...SETUP_PUSHES, 0x032c, ...MID_PUSHES],
    "the taken conditional call pushes its return address 0x032c",
  );
  assert.equal(m.retCount, 0, "still a fall-through, no ret");
  assert.equal(m.pc, 0x0348, "PC still ends at loc_0348");
  assert.equal(m.tstates, 223, "206 body + 17 (call c taken)");

  // (0x804e) 0x05 - (0x8028) 0x21 borrows -> 0xE4 with carry set.
  assert.equal(m.ram[0x8011], 0xe4, "(0x8011) = (0x05 - 0x21) & 0xff = 0xE4");
  assert.equal(m.regs.f & F_C, F_C, "sub 0x05-0x21 borrowed -> carry set");
});

// -- The carry BOUNDARY: (0x8001)=3 -> (3-1)=2, cp 0x02 clears carry (not <2) --
test("loc_031a: carry boundary -- (0x8001)=3 is NOT taken, (0x8001)=1 IS taken", () => {
  const notTaken = makeMachine();
  setup(notTaken, { s8001: 0x03 });
  loc_031a(notTaken);
  assert.ok(!notTaken.calls.includes(0x47e1), "(0x8001)-1 == 2 is NOT < 2 -> not taken");

  const taken = makeMachine();
  setup(taken, { s8001: 0x01 });
  loc_031a(taken);
  assert.ok(taken.calls.includes(0x47e1), "(0x8001)-1 == 0 IS < 2 -> taken");

  // And (0x8001)=0 wraps to 0xFF on dec, which is NOT < 2 -> not taken.
  const wrap = makeMachine();
  setup(wrap, { s8001: 0x00 });
  loc_031a(wrap);
  assert.ok(!wrap.calls.includes(0x47e1), "(0x8001)=0 -> dec wraps to 0xFF, not < 2 -> not taken");
});

// -- MUTATION: fall-through mis-modelled as call+ret is caught ----------------
// The convention warns the fall-through into loc_0348 is `return m.call(0x0348)`,
// NOT `m.call(0x0348); m.ret()`. Simulate that slip by making the tail m.call
// also perform a ret. The spurious ret pops the top-of-stack (the last mid call's
// pushed return, since the mock's opaque callees never pop) and charges +10 T.
test("loc_031a MUTATION: fall-through mis-modelled as call+ret is caught", () => {
  const m = makeMachine();
  setup(m, { s8001: 0x05 });
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    const r = realCall(addr);
    if (addr === 0x0348) m.ret(); // the spurious ret the fall-through must NOT do
    return r;
  };

  loc_031a(m);

  assert.equal(m.retCount, 1, "mutation performed one (spurious) ret");
  assert.notEqual(m.pc, 0x0348, "spurious ret moved the PC off the fall-through target");
  assert.equal(m.tstates, 226, "mutation charges a spurious +10 T (216 -> 226)");

  // And the golden assertions must fail on this mutant.
  assert.throws(
    () => assert.equal(m.retCount, 0, "fall-through: NO ret of its own"),
    /NO ret/,
    "the golden ret-count assertion must fail on the mutant",
  );
  assert.throws(
    () => assert.equal(m.pc, 0x0348, "PC at fall-through target"),
    undefined,
    "the golden PC assertion must fail on the mutant",
  );
});
