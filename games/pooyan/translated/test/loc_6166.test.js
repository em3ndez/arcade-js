// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6166 (ROM 0x6166, Pooyan) -- reset the actor record at IY: zero
 * (iy+0), seat (iy+1)=0x01 (iy+2)=0x08 (iy+0x16)=0x07 (iy+0x17)=0x05, zero (iy+0x14)/(iy+0x13).
 * Then 0x8d44!=3 takes the inlined 0x619a block (call 0x0ef1 + jr loc_618a); ==3 falls through the
 * call 0x0efd into loc_618a.
 *
 * The mock's `call` POPS the return the call site pushed (real calls 0x0efd/0x0ef1) or the seated
 * CALLER_RET (tail into loc_618a) -- one net pop each, so a missing push16 desyncs SP (the positive
 * control deletes push16(0x618a) and the Path A SP tooth then fails). loc_618a is entered as a tail
 * target (fall-through / jr), never a `call` with a fresh return; its own skip-return is modelled by
 * the single net pop here, matching loc_613d's tail-jump to it.
 *
 * Path A (0x8d44==3): fall through call 0x0efd into loc_618a, T=181, pcSeq ends at the 0x0efd target
 * (0x618a lands only in calls[], like loc_5ebd's rst fall-through). Path B (0x8d44!=3): jr nz to the
 * inlined 0x619a -> call 0x0ef1 -> jr loc_618a, T=198. TOOTH: mis-charge `ld a,(0x8d44)` (13 T) as
 * 10 T on Path A -> the 181-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_6166.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6166 } from "../loc_6166.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6166, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.iy = IY;
}

function assertRecordSeated(m) {
  assert.equal(m.mem.read8(IY + 0x00), 0x00, "(iy+0) zeroed");
  assert.equal(m.mem.read8(IY + 0x01), 0x01, "(iy+1) = 0x01");
  assert.equal(m.mem.read8(IY + 0x02), 0x08, "(iy+2) = 0x08");
  assert.equal(m.mem.read8(IY + 0x16), 0x07, "(iy+0x16) = 0x07");
  assert.equal(m.mem.read8(IY + 0x17), 0x05, "(iy+0x17) = 0x05");
  assert.equal(m.mem.read8(IY + 0x14), 0x00, "(iy+0x14) zeroed");
  assert.equal(m.mem.read8(IY + 0x13), 0x00, "(iy+0x13) zeroed");
}

test("loc_6166 Path A: 0x8d44 == 3 -> call 0x0efd, fall through into loc_618a", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d44, 0x03); // == 3 -> jr nz not taken -> fall through

  loc_6166(m);

  assert.equal(m.tstates, 181, "Path A total (157 + 7 jr nz nt + 17 call 0x0efd)");
  assert.deepEqual(m.pcSeq, [
    0x6167, 0x616a, 0x616e, 0x6172, 0x6176, 0x617a, 0x617d, 0x6180, 0x6183, 0x6185,
    0x6187, 0x0efd, // jr nz not taken, then call 0x0efd target
  ]);
  assert.deepEqual(m.calls, [0x0efd, 0x618a], "call 0x0efd, then fall through into loc_618a");
  assertRecordSeated(m);
  assert.equal(m.regs.a, 0x03, "A holds the reloaded 0x8d44 value (== 3) after the ld/cp");
  assert.equal(m.regs.sp, 0x8780, "push16(0x618a) matched 0x0efd's ret; tail into loc_618a unwound CALLER_RET");
});

test("loc_6166 Path B: 0x8d44 != 3 -> inlined 0x619a (call 0x0ef1) then jr loc_618a", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d44, 0x02); // != 3 -> jr nz taken -> 0x619a

  loc_6166(m);

  assert.equal(m.tstates, 198, "Path B total (157 + 12 jr nz + 17 call 0x0ef1 + 12 jr 0x618a)");
  assert.deepEqual(m.pcSeq, [
    0x6167, 0x616a, 0x616e, 0x6172, 0x6176, 0x617a, 0x617d, 0x6180, 0x6183, 0x6185,
    0x619a, 0x0ef1, 0x618a, // jr nz -> 0x619a: call 0x0ef1 target, then jr 0x618a tail
  ]);
  assert.equal(m.pc, 0x618a, "jr 0x618a tail-jumps loc_618a");
  assert.deepEqual(m.calls, [0x0ef1, 0x618a]);
  assertRecordSeated(m);
  assert.equal(m.regs.sp, 0x8780, "push16(0x619d) matched 0x0ef1's ret; tail into loc_618a unwound CALLER_RET");
});

test("loc_6166 MUTATION: `ld a,(0x8d44)` mis-charged 10T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6183 ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d44, 0x03);

  loc_6166(m);

  assert.equal(m.tstates, 178, "mutation loses 3 T (13 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 181, "Path A total"),
    /181/,
    "the 181-T golden must fail on the mutant",
  );
});
