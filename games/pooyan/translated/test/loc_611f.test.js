// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_611f (ROM 0x611f, Pooyan) -- record finder. HL+=DE, A=(hl) is the
 * key; scan 6 records at IY=0x8ae0 (stride 0x18) comparing A with (iy+0x14). On a match it tail-jumps
 * loc_613d; with no match it rets when 0x8d44==3, else calls 0x0ef1 and rets.
 *
 * The mock's `call` POPS the return address the call site pushed (real call 0x0ef1) or the seated
 * CALLER_RET (tail-jump loc_613d) -- so a missing push16 before `call 0x0ef1` desyncs SP and the
 * Path CALL stack tooth fails (see the positive control noted in the drafter summary).
 *
 * Paths: MATCH1 (key hits record 0 -> loc_613d, T=80), MATCH3 (hits record 2, T=188),
 * RETZ (no match, 0x8d44==3 -> ret z, T=399), CALL (no match, 0x8d44!=3 -> call 0x0ef1 + ret, T=420).
 * TOOTH: mis-charge `add hl,de` (11 T) as 7 T on MATCH1 -> the 80-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_611f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_611f } from "../loc_611f.js";

const CALLER_RET = 0xabcd;
const IY = 0x8ae0;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x611f, pcSeq: [],
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
    // The callee's `ret` (real call 0x0ef1) or the tail chain (loc_613d) pops the return address the
    // site pushed / the seated CALLER_RET -- model that single net pop so a missing push16 desyncs SP.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.hl = 0x0000;
  m.regs.de = 0x0000; // add hl,de leaves HL=0; A read from (0x0000) unless overridden below
}

// Seat 6 records at IY (stride 0x18) whose (iy+0x14) keys are given; A (from HL) is `key`.
function seatScan(m, key, recordKeys) {
  seatCaller(m);
  m.mem.write8(0x0000, key); // (hl) after add hl,de(=0) -> A = key
  for (let i = 0; i < recordKeys.length; i++) {
    m.mem.write8(IY + i * 0x18 + 0x14, recordKeys[i] & 0xff);
  }
}

test("loc_611f Path MATCH1: key equals record 0's (iy+0x14) -> tail-jump loc_613d", () => {
  const m = makeMachine();
  seatScan(m, 0x2a, [0x2a, 0x00, 0x00, 0x00, 0x00, 0x00]);

  loc_611f(m);

  assert.equal(m.tstates, 80, "MATCH1 total (49 preamble + 19 cp + 12 jr z)");
  assert.deepEqual(m.pcSeq, [0x6120, 0x6121, 0x6123, 0x6126, 0x612a, 0x612d, 0x613d]);
  assert.equal(m.pc, 0x613d, "tail-jump lands on loc_613d");
  assert.deepEqual(m.calls, [0x613d]);
  assert.equal(m.regs.iy, IY, "IY still at record 0 (no add iy,de before the match)");
  assert.equal(m.regs.b, 0x06, "B untouched (djnz not reached)");
  assert.equal(m.regs.sp, 0x8780, "tail chain unwound CALLER_RET to baseline");
});

test("loc_611f Path MATCH3: key equals record 2's key -> two advances then loc_613d", () => {
  const m = makeMachine();
  seatScan(m, 0x2a, [0x00, 0x00, 0x2a, 0x00, 0x00, 0x00]);

  loc_611f(m);

  assert.equal(m.tstates, 188, "MATCH3 total (49 + 2*54 + 31)");
  assert.deepEqual(m.pcSeq, [
    0x6120, 0x6121, 0x6123, 0x6126, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a, // record 0 miss
    0x612d, 0x612f, 0x6131, 0x612a, // record 1 miss
    0x612d, 0x613d,                 // record 2 match
  ]);
  assert.equal(m.pc, 0x613d);
  assert.deepEqual(m.calls, [0x613d]);
  assert.equal(m.regs.iy, IY + 2 * 0x18, "IY advanced past two misses");
  assert.equal(m.regs.b, 0x04, "B decremented twice by djnz");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_611f Path RETZ: no match in 6 records, 0x8d44 == 3 -> ret z", () => {
  const m = makeMachine();
  seatScan(m, 0x2a, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // key 0x2a matches none
  m.mem.write8(0x8d44, 0x03);

  loc_611f(m);

  assert.equal(m.tstates, 399, "RETZ total (49 + 5*54 + 49 fall-out + 13 + 7 + 11 ret z)");
  assert.deepEqual(m.pcSeq, [
    0x6120, 0x6121, 0x6123, 0x6126, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a,
    0x612d, 0x612f, 0x6131, 0x6133, // record 5: djnz falls out
    0x6136, 0x6138, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret z returns to the seated caller");
  assert.deepEqual(m.calls, [], "no call on the ret-z path");
  assert.equal(m.regs.iy, IY + 6 * 0x18, "IY advanced past all six records");
  assert.equal(m.regs.b, 0x00, "B exhausted");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_611f Path CALL: no match, 0x8d44 != 3 -> call 0x0ef1 then ret", () => {
  const m = makeMachine();
  seatScan(m, 0x2a, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  m.mem.write8(0x8d44, 0x02); // != 3 -> ret z not taken

  loc_611f(m);

  assert.equal(m.tstates, 420, "CALL total (368 loop + 13 + 7 + 5 + 17 call + 10 ret)");
  assert.deepEqual(m.pcSeq, [
    0x6120, 0x6121, 0x6123, 0x6126, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a,
    0x612d, 0x612f, 0x6131, 0x612a,
    0x612d, 0x612f, 0x6131, 0x6133,
    0x6136, 0x6138, 0x6139, 0x0ef1, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret returns to the seated caller");
  assert.deepEqual(m.calls, [0x0ef1], "one call to 0x0ef1");
  assert.equal(m.regs.sp, 0x8780, "push16(0x613c) matched loc_0ef1's ret; final ret unwound CALLER_RET");
});

test("loc_611f MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6120 ? 7 : cycles);
  seatScan(m, 0x2a, [0x2a, 0x00, 0x00, 0x00, 0x00, 0x00]);

  loc_611f(m);

  assert.equal(m.tstates, 76, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 80, "MATCH1 total"),
    /80/,
    "the 80-T golden must fail on the mutant",
  );
});
