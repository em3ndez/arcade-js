// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_022d (ROM 0x022d-0x0277), The Pit.
//
// loc_022d is the per-round init block: `ld sp,0x83ff` resets the stack, six
// setup subroutines run, a handful of work-RAM bytes are seeded, the two player
// slots are primed via 0x4632, then the block FALLS THROUGH into loc_0278 (the
// main round loop). loc_0278 is a routine in its own right — an external jump
// target (`jp z,0x0278` at 0x13d8 and 0x345f) — so the fall-through is modelled
// as a tail transfer: `return m.call(0x0278)`, charging NO extra T-states (there
// is no jump instruction) and propagating loc_0278's result back to the caller.
//
// Runs on a lightweight machine built from the REAL thepit address space
// (boards/thepit/memory.js) so pushes land in real work RAM. loc_022d reads and
// writes work RAM only (never ROM), so a zero-filled ROM image is sufficient.
// Callees are stubbed as pure recorders that add no cycles and do NOT pop — so
// the asserted T-state total is loc_022d's OWN instruction cost, and SP reflects
// the 9 CALL pushes the stubs never balance (the real callees' rets would).
//
// The MUTATION block proves the contract has teeth: (A) one `call` mis-charged
// 10T instead of 17T, and (B) the fall-through wrongly charged 10T as if it were
// a real `jp 0x0278` — each is caught by the golden T-state assertion.

import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_022d } from "../loc_022d.js";

// Seeds for the three work-RAM reads (0x804e, 0x8053, 0x8001).
const SEED_804E = 0x5a; // -> 0x8011
const SEED_8053 = 0x07; // -> 0x802b, then inc -> 0x08
const SEED_8001 = 0x42; // -> 0x8002 (final write)

const LOC_0278_RESULT = "LOC_0278_RESULT"; // sentinel the fall-through must propagate

// The exact transfer sequence, in order. The 9 real CALLs then the fall-through.
const CALL_SEQUENCE = [
  0x4b14, 0x4c4d, 0x4b44, 0x4c5f, 0x4bea, 0x4b55, // six setup subroutines
  0x4632, 0x4632, // prime player slot (mode 1) then (mode 2)
  0x4644, // 0x8002 = (0x8001) then this
  0x0278, // <- the fall-through into loc_0278 (tail transfer, not a real CALL)
];

const OWN_TSTATES = 351; // sum of loc_022d's 27 own instructions; fall-through adds 0

class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x022d;
    this.calls = [];
    // Seat a junk SP; loc_022d's first instruction overwrites it with 0x83ff.
    this.regs.sp = 0x8700;
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  // Pure recorder: capture the target, charge nothing, and do NOT pop. The real
  // callee's ret (which would balance the CALL push) is out of scope here; each
  // instruction after a CALL reloads A, so the missing register/stack effects do
  // not corrupt loc_022d's own logic. Returns the sentinel so the fall-through's
  // `return m.call(0x0278)` can propagate it.
  call(addr) {
    this.calls.push(addr);
    return LOC_0278_RESULT;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function makeMachine() {
  const m = new TestMachine(new Uint8Array(0x5000)); // zero ROM: no ROM reads occur
  m.mem.write8(0x804e, SEED_804E);
  m.mem.write8(0x8053, SEED_8053);
  m.mem.write8(0x8001, SEED_8001);
  return m;
}

function run(fn) {
  const m = makeMachine();
  const ret = fn(m);
  return {
    cycles: m.cycles,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    calls: m.calls,
    ret,
    w8048: m.mem.read8(0x8048),
    w8011: m.mem.read8(0x8011),
    w8028: m.mem.read8(0x8028),
    w802b: m.mem.read8(0x802b),
    w8002: m.mem.read8(0x8002),
  };
}

// The disassembly-derived contract, factored so mutants run through the same checks.
function checkGolden(res) {
  assert.equal(res.cycles, OWN_TSTATES, "own T-state total (fall-through adds 0)");
  assert.deepEqual(res.calls, CALL_SEQUENCE, "9 CALLs then the loc_0278 fall-through");
  assert.equal(res.ret, LOC_0278_RESULT, "fall-through propagates loc_0278's result");
  assert.equal(res.pc, 0x0278, "PC lands on 0x0278 (the fall-through target)");
  // `ld sp,0x83ff` reset the stack, then 9 un-balanced CALL pushes: 0x83ff - 18.
  assert.equal(res.sp, 0x83ed, "SP = 0x83ff reset minus 9 CALL pushes (stubs don't pop)");
  // work-RAM effects
  assert.equal(res.w8048, 0x00, "0x8048 cleared to 0");
  assert.equal(res.w8011, SEED_804E, "0x8011 <- (0x804e)");
  assert.equal(res.w8028, 0x01, "0x8028 = 1");
  assert.equal(res.w8002, SEED_8001, "0x8002 <- (0x8001) (last of three writes)");
  assert.equal(res.w802b, (SEED_8053 + 1) & 0xff, "0x802b <- (0x8053) then inc");
  assert.equal(res.a, (SEED_8053 + 1) & 0xff, "A = incremented 0x802b on exit");
}

test("loc_022d matches the disassembly contract", () => {
  checkGolden(run(loc_022d));
});

// -- MUTATION A: a `call nn` mis-charged 10T (conditional-call-not-taken) not 17T.
// A very plausible slip, since a taken CALL is 17T and a not-taken one is 10T.
// Mis-charge the first CALL (target 0x4b14) and confirm the golden total rejects it.
test("loc_022d MUTATION A: a CALL mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) =>
    realStep(nextAddr, nextAddr === 0x4b14 ? 10 : cycles); // the first `call 0x4b14`
  const ret = loc_022d(m);
  const res = {
    cycles: m.cycles, pc: m.pc, sp: m.regs.sp, a: m.regs.a, calls: m.calls, ret,
    w8048: m.mem.read8(0x8048), w8011: m.mem.read8(0x8011), w8028: m.mem.read8(0x8028),
    w802b: m.mem.read8(0x802b), w8002: m.mem.read8(0x8002),
  };
  assert.equal(res.cycles, OWN_TSTATES - 7, "mutant loses exactly 7 T (17 -> 10)");
  assert.throws(() => checkGolden(res), /own T-state total/, "golden must reject the mutant");
});

// -- MUTATION B: the fall-through wrongly modelled as a real `jp 0x0278` (adds 10T).
// The whole point of the fall-through decision is that continuing into the next
// routine costs ZERO extra T-states (no jump instruction executed). Inject the
// spurious 10T at the fall-through and confirm the golden total rejects it.
test("loc_022d MUTATION B: fall-through mis-charged 10T (as if a jp) is caught", () => {
  const m = makeMachine();
  const realCall = m.call.bind(m);
  m.call = (addr) => {
    if (addr === 0x0278) m.step(0x0278, 10); // BUG: charge a jp's 10T for a free fall-through
    return realCall(addr);
  };
  const ret = loc_022d(m);
  const res = {
    cycles: m.cycles, pc: m.pc, sp: m.regs.sp, a: m.regs.a, calls: m.calls, ret,
    w8048: m.mem.read8(0x8048), w8011: m.mem.read8(0x8011), w8028: m.mem.read8(0x8028),
    w802b: m.mem.read8(0x802b), w8002: m.mem.read8(0x8002),
  };
  assert.equal(res.cycles, OWN_TSTATES + 10, "mutant over-charges by 10 T");
  assert.throws(() => checkGolden(res), /own T-state total/, "golden must reject the mutant");
});
