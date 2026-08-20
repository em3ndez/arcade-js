// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_416f (ROM 0x416f, Pooyan) -- a per-object dwell-then-dispatch
 * step. loc_4006 animates the object; then (ix+11h) is a dwell countdown -- while non-zero it
 * returns, and on expiry it tail-jumps into loc_3553.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`); a
 * `call 0x4006` that forgot its push16 then desyncs SP and the final unwind assertion fails. For the
 * tail `jp 0x3553` (no push16) the callee's ret consumes the seated CALLER_RET, so SP returns to the
 * pre-seat baseline.
 *
 * Path HOLD ((ix+11h)=2 -> 1, ret nz): pcSeq visits 0x4006 then rets to the caller. T=51.
 * Path GO   ((ix+11h)=1 -> 0, tail): pcSeq visits 0x4176 then ends on 0x3553. T=55.
 * MUTATION: mis-charge `dec (ix+11h)` (23 T) as 11 T -> the golden T fails.
 *
 * Run: node --test games/pooyan/translated/test/loc_416f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_416f } from "../loc_416f.js";

const CALLER_RET = 0xabcd;
const IX = 0x9100;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x416f, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed -- model that pop so the stack
    // stays balanced (a missing push16 at the call site then desyncs SP and fails the unwind tooth).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_416f Path HOLD: (ix+11h)!=0 after dec -> ret nz to caller", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x02);

  loc_416f(m);

  assert.equal(m.tstates, 17 + 23 + 11, "call + dec(ix+11h) + ret nz");
  assert.deepEqual(m.pcSeq, [0x4006, 0x4175, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nz returns to the seated caller");
  assert.deepEqual(m.calls, [0x4006], "only the animation call");
  assert.equal(m.mem.read8(IX + 0x11), 0x01, "dwell counter decremented");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_416f Path GO: (ix+11h)==0 after dec -> tail jp loc_3553", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01);

  loc_416f(m);

  assert.equal(m.tstates, 17 + 23 + 5 + 10, "call + dec(ix+11h) + ret-nz-not-taken + tail jp");
  assert.deepEqual(m.pcSeq, [0x4006, 0x4175, 0x4176, 0x3553]);
  assert.equal(m.pc, 0x3553, "tail jp lands on loc_3553");
  assert.deepEqual(m.calls, [0x4006, 0x3553], "animation then dispatch");
  assert.equal(m.mem.read8(IX + 0x11), 0x00, "dwell counter reached zero");
  assert.equal(m.regs.sp, 0x8780, "tail callee ret consumes the seated return -> baseline");
});

test("loc_416f MUTATION: `dec (ix+11h)` mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4175 ? 11 : cycles);
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x02);

  loc_416f(m);

  assert.equal(m.tstates, 17 + 11 + 11, "mutation loses 12 T (23 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 17 + 23 + 11, "golden"),
    /51/,
    "the golden T must fail on the mutant",
  );
});
