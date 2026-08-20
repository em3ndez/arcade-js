// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_418d (ROM 0x418d-0x41b0): the (ix+0x11) countdown handler. Calls
// loc_4006, `dec (ix+0x11)`, and `ret nz` while still counting; on expiry it enqueues a display
// command via rst 0x38, re-seats (ix+0x11)/(ix+0x13)/(ix+0x02), then tail-jumps to loc_416f.
//
// The mock's `call` POPS the pushed return address (models each callee's ret): loc_4006 and the
// rst-0x38 handler (loc_0038) return to their push sites; the tail loc_416f pops the seated
// CALLER_RET. A missing push16 desyncs SP -> the baseline / pc assertions catch it.
//
// Paths: A) still counting -> ret nz at 0x4193.  B) expired, (ix+0x16)==0 -> jr z taken.
//        C) expired, (ix+0x16)!=0 -> jr z not taken (dec a).  Both B/C tail-jp to 0x416f.
// TEETH: mis-charge `dec (ix+0x11)` 23T -> 11T, the 51-T golden (Path A) throws.
//
// Run: node --test games/pooyan/translated/test/loc_418d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_418d } from "../loc_418d.js";

const CALLER_RET = 0xabcd;
const IX = 0x8b70;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x418d, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The callee's ret pops the return address the call site pushed (loc_4006 / loc_0038 plain
    // helpers; tail loc_416f pops the seated CALLER_RET). Missing push16 -> stack desync -> fail.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_418d Path A: still counting -> ret nz at 0x4193", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x11) & 0xffff, 0x02); // dec -> 0x01, non-zero -> ret nz taken

  loc_418d(m);

  assert.equal(m.tstates, 51, "T = 17 + 23 + 11");
  assert.deepEqual(m.pcSeq, [0x4006, 0x4193, CALLER_RET], "call target, dec, ret to caller");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to the seated caller");
  assert.deepEqual(m.calls, [0x4006], "only loc_4006 ran");
  assert.equal(m.mem.read8((IX + 0x11) & 0xffff), 0x01, "(ix+0x11) decremented 0x02 -> 0x01");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (ret popped the seated caller)");
});

const PC_TAIL_HEAD = [0x4006, 0x4193, 0x4194, 0x4197, 0x4198, 0x4199];
const PC_TAIL_FOOT = [0x419f, 0x41a0, 0x41a1, 0x0038, 0x41a6, 0x41a7, 0x41aa, 0x41ae, 0x416f];

test("loc_418d Path B: expired, (ix+0x16)==0 -> jr z taken -> tail jp 0x416f", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x11) & 0xffff, 0x01); // dec -> 0x00, ret nz NOT taken
  m.mem.write8((IX + 0x16) & 0xffff, 0x00); // A == 0 -> and a sets Z -> jr z taken

  loc_418d(m);

  assert.equal(m.tstates, 184, "Path B T-state total (jr z taken = 12)");
  assert.deepEqual(m.pcSeq, [...PC_TAIL_HEAD, 0x419c, ...PC_TAIL_FOOT], "jr z taken skips dec a");
  assert.equal(m.pc, 0x416f, "tail jp lands on 0x416f");
  assert.deepEqual(m.calls, [0x4006, 0x0038, 0x416f], "loc_4006, rst-0x38 enqueue, tail loc_416f");
  assert.equal(m.regs.e, 0x12, "E = 0x12 + (ix+0x16=0) enqueued");
  assert.equal(m.regs.d, 0x03, "D = high byte of 0x0312");
  assert.equal(m.regs.c, 0x01, "C = (ix+0x16=0) then inc -> 1");
  assert.equal(m.mem.read8((IX + 0x11) & 0xffff), 0x01, "(ix+0x11) re-seated to 0x01");
  assert.equal(m.mem.read8((IX + 0x13) & 0xffff), 0x01, "(ix+0x13) = C = 0x01");
  assert.equal(m.mem.read8((IX + 0x02) & 0xffff), 0x02, "(ix+0x02) = 0x02");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (tail loc_416f popped CALLER_RET)");
});

test("loc_418d Path C: expired, (ix+0x16)!=0 -> jr z not taken (dec a) -> tail jp 0x416f", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x11) & 0xffff, 0x01); // dec -> 0x00, ret nz NOT taken
  m.mem.write8((IX + 0x16) & 0xffff, 0x05); // A != 0 -> jr z not taken -> dec a

  loc_418d(m);

  assert.equal(m.tstates, 183, "Path C T-state total (jr z not taken 7 + dec a 4)");
  assert.deepEqual(m.pcSeq, [...PC_TAIL_HEAD, 0x419b, 0x419c, ...PC_TAIL_FOOT], "jr z not taken runs dec a");
  assert.equal(m.pc, 0x416f, "tail jp lands on 0x416f");
  assert.deepEqual(m.calls, [0x4006, 0x0038, 0x416f], "loc_4006, rst-0x38 enqueue, tail loc_416f");
  assert.equal(m.regs.e, 0x16, "E = 0x12 + (0x05-1=0x04) = 0x16");
  assert.equal(m.regs.c, 0x06, "C = (ix+0x16=0x05) then inc -> 0x06");
  assert.equal(m.mem.read8((IX + 0x11) & 0xffff), 0x01, "(ix+0x11) re-seated to 0x01");
  assert.equal(m.mem.read8((IX + 0x13) & 0xffff), 0x06, "(ix+0x13) = C = 0x06");
  assert.equal(m.mem.read8((IX + 0x02) & 0xffff), 0x02, "(ix+0x02) = 0x02");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_418d MUTATION: `dec (ix+0x11)` mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x11) & 0xffff, 0x02);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4193 ? 11 : cycles);

  loc_418d(m);

  assert.equal(m.tstates, 39, "mutation loses 12 T (23 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 51, "T = 17 + 23 + 11"),
    /51/,
    "the 51-T golden (Path A) must fail on the mutant",
  );
});
