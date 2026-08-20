// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_3757 (ROM 0x3757, Pooyan) -- advance actor X (ix+5) by its signed
 * step (ix+0x0a); when X is below the negated step, decrement the counter (ix+6). Then dispatch on
 * the level byte (0x8901): <3 tail-jp 0x362d, else fall through into loc_3775.
 *
 * loc_3757 has no `call`/push16 -- only two tail exits (jp c 0x362d, fall-through to loc_3775). The
 * mock's `call` POPS, modelling the tail callee's `ret` consuming the seated CALLER_RET, so both paths
 * unwind SP to the pre-seat baseline (the stack-fidelity tooth for a tail exit).
 *
 * Path C1 (jr nc taken -- no dec; jp c taken -> 0x362d): (ix+0x0a)=0xfe -> neg=0x02, X=0x10 >= 0x02.
 * Path C2 (jr nc not taken -- dec (ix+6); jp c not taken -> fall into loc_3775): (ix+0x0a)=0x05 ->
 * neg=0xfb, X=0x10 < 0xfb. MUTATION: `dec (ix+6)` (23 T) mis-charged 11 T -> the 156-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_3757.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3757 } from "../loc_3757.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x3757, pcSeq: [],
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
    // Tail callee's `ret` pops the seated caller return -- model that pop so a tail exit unwinds SP.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_3757 C1: X >= -step (no dec); level<3 -> tail jp 0x362d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0xa000;
  m.mem.write8(0xa00a, 0xfe); // step -> neg = 0x02
  m.mem.write8(0xa005, 0x10); // X
  m.mem.write8(0xa006, 0x08); // counter (must stay untouched)
  m.mem.write8(0x8901, 0x02); // level < 3 -> jp c

  loc_3757(m);

  assert.equal(m.tstates, 138, "C1 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x375a, 0x375c, 0x375d, 0x3760, 0x3761, 0x3766,
    0x3769, 0x376c, 0x376d, 0x3770, 0x3772, 0x362d,
  ]);
  assert.equal(m.mem.read8(0xa005), 0x0e, "X += step (0x10 + 0xfe = 0x0e)");
  assert.equal(m.mem.read8(0xa006), 0x08, "counter untouched (jr nc taken)");
  assert.deepEqual(m.calls, [0x362d], "tail jp 0x362d");
  assert.equal(m.pc, 0x362d);
  assert.equal(m.regs.sp, 0x8780, "tail exit unwinds SP to baseline");
});

test("loc_3757 C2: X < -step (dec counter); level>=3 -> fall into loc_3775", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0xa000;
  m.mem.write8(0xa00a, 0x05); // step -> neg = 0xfb
  m.mem.write8(0xa005, 0x10); // X < 0xfb -> jr nc not taken
  m.mem.write8(0xa006, 0x08); // counter -> decremented
  m.mem.write8(0x8901, 0x05); // level >= 3 -> fall through

  loc_3757(m);

  assert.equal(m.tstates, 156, "C2 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x375a, 0x375c, 0x375d, 0x3760, 0x3761, 0x3763, 0x3766,
    0x3769, 0x376c, 0x376d, 0x3770, 0x3772, 0x3775,
  ]);
  assert.equal(m.mem.read8(0xa006), 0x07, "counter decremented (jr nc not taken)");
  assert.equal(m.mem.read8(0xa005), 0x15, "X += step (0x10 + 0x05 = 0x15)");
  assert.deepEqual(m.calls, [0x3775], "fall-through delegates to loc_3775");
  assert.equal(m.pc, 0x3775);
  assert.equal(m.regs.sp, 0x8780, "fall-through callee ret unwinds SP to baseline");
});

test("loc_3757 MUTATION: `dec (ix+6)` mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x3766 ? 11 : cycles);
  seatCaller(m);
  m.regs.ix = 0xa000;
  m.mem.write8(0xa00a, 0x05);
  m.mem.write8(0xa005, 0x10);
  m.mem.write8(0xa006, 0x08);
  m.mem.write8(0x8901, 0x05);

  loc_3757(m);

  assert.equal(m.tstates, 144, "mutation loses 12 T (23 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 156, "C2 T-state total"),
    /156/,
    "the 156-T golden must fail on the mutant",
  );
});
