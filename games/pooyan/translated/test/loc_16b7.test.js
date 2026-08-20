// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_16b7 (ROM 0x16b7, Pooyan) -- the idx1 state handler. Decrements
 * the phase timer at 0x8808 and returns until it hits 0, runs loc_02e3 + loc_1dd3, selects an
 * (HL=graphic, DE=layout) pair from a decision tree, commits it (0x88ba/0x8f45 + fixed pointers),
 * bumps the sub-state (0x880a), enqueues a display command via rst 0x38 (loc_0038) and tail-calls
 * loc_1694 before its 0x174b ret.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`); a
 * missing push16 then desyncs the stack and the final ret pops the wrong word -- so the pcSeq/SP
 * assertions have real teeth. None of loc_16b7's callees leave a register it depends on afterward
 * (every live register is reloaded), so the mock models only the pop.
 *
 * Paths: TAIL (0x8f50 bit0 clear -> full decision tree via 0x1715 -> commit + rst 0x38 + call
 * 0x1694, T=438); ALT (0x8f50=0x02 -> 0x16dc bit1 arm -> 0x16eb pair, T=392); SHORT (0x8f50 bit0
 * set -> force sub-state 0x10 + ret, T=117); GATE (timer not expired -> ret nz, T=32).
 * TEETH: mis-charge `ld (0x8f45),de` (20T) as 16T -> the 438-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_16b7.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_16b7 } from "../loc_16b7.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x16b7, pcSeq: [],
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
    // Model the callee's `ret` popping the return address loc_16b7 pushed at the call site. A missing
    // push16 then desyncs SP and the routine's own ret returns to the wrong address (test fails).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_TAIL = [
  0x16ba, 0x16bb, 0x16bc, 0x02e3, 0x1dd3, // dec timer, call 0x02e3, call 0x1dd3
  0x16c5, 0x16c7, 0x16cf, 0x16d0, 0x16d3, 0x03c2, 0x16d9, 0x16da, // 0x8f50 bit0 clear -> call 0x03c2
  0x16f3, 0x16f6, 0x16f7, 0x16f9, 0x16fc, 0x16fd, // 0x8904==0, 0x8806==0 -> jr z 0x1715
  0x1715, 0x1718, 0x171a, 0x171d, 0x1720, // 0x8907 bit0 clear -> jr z 0x1728, pair 0x46d6/0x4a50
  0x1728, 0x172c, 0x172f, 0x1732, 0x1735, 0x1738, 0x173b, 0x173d, 0x1740, 0x1743, 0x1744, 0x1747,
  0x0038, 0x1694, CALLER_RET, // rst 0x38 (loc_0038), call 0x1694, ret to seated caller
];

function setupTail(m) {
  seatCaller(m);
  m.mem.write8(0x8808, 0x01); // timer 1 -> dec to 0 -> ret nz not taken
  m.mem.write8(0x8f50, 0x00); // bit0 clear -> jr z 0x16cf; and a==0 -> jr z 0x16f3
  m.mem.write8(0x8904, 0x00); // and a==0 -> jr nz not taken
  m.mem.write8(0x8806, 0x00); // and a==0 -> jr z 0x1715
  m.mem.write8(0x8907, 0x00); // bit0 clear -> jr z 0x1728 at 0x1720
  m.mem.write8(0x880a, 0x00); // sub-state -> inc to 1
}

test("loc_16b7 TAIL: timer expires, decision tree -> commit + rst 0x38 + call 0x1694", () => {
  const m = makeMachine();
  setupTail(m);

  loc_16b7(m);

  assert.equal(m.tstates, 438, "TAIL T-state total");
  assert.deepEqual(m.pcSeq, PC_TAIL, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "0x174b ret returns to the seated caller");
  assert.deepEqual(m.calls, [0x02e3, 0x1dd3, 0x03c2, 0x0038, 0x1694], "call order incl rst 0x38 -> 0x0038");
  assert.equal(m.mem.read8(0x8808), 0x00, "phase timer decremented 1 -> 0");
  assert.equal(m.mem.read8(0x88b7), 0x00, "0x88b7 cleared (xor a)");
  assert.equal(m.mem.read16(0x8f45), 0x4a50, "layout ptr committed (DE)");
  assert.equal(m.mem.read16(0x88ba), 0x46d6, "graphic ptr committed (HL)");
  assert.equal(m.mem.read16(0x88b8), 0x8442, "0x88b8 seeded");
  assert.equal(m.mem.read16(0x8f43), 0x8042, "0x8f43 seeded");
  assert.equal(m.mem.read8(0x8d07), 0x20, "0x8d07 seeded");
  assert.equal(m.mem.read8(0x880a), 0x01, "sub-state bumped 0 -> 1");
  // Stack fully unwinds: every push16 matched a callee ret, then loc_16b7's own ret pops CALLER_RET.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_16b7 ALT: 0x8f50=0x02 -> 0x16dc bit1 arm -> 0x16eb pair (0x4c92/0x4dce)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8808, 0x01);
  m.mem.write8(0x8f50, 0x02); // bit0 clear (jr z 0x16cf) but nonzero -> and a NZ -> jr z not taken (0x16dc)
  m.mem.write8(0x8907, 0x02); // bit1 set -> jr nz 0x16eb
  m.mem.write8(0x880a, 0x00);

  loc_16b7(m);

  assert.equal(m.tstates, 392, "ALT T-state total");
  assert.deepEqual(m.pcSeq, [
    0x16ba, 0x16bb, 0x16bc, 0x02e3, 0x1dd3,
    0x16c5, 0x16c7, 0x16cf, 0x16d0, 0x16d3, 0x03c2, 0x16d9, 0x16da,
    0x16dc, 0x16df, 0x16e1, 0x16eb, 0x16ee, 0x16f1, // bit1 set -> 0x16eb pair, jr 0x1728
    0x1728, 0x172c, 0x172f, 0x1732, 0x1735, 0x1738, 0x173b, 0x173d, 0x1740, 0x1743, 0x1744, 0x1747,
    0x0038, 0x1694, CALLER_RET,
  ], "0x16dc arm reaches the commit tail via 0x16eb");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x02e3, 0x1dd3, 0x03c2, 0x0038, 0x1694]);
  assert.equal(m.mem.read16(0x8f45), 0x4dce, "layout ptr = 0x4dce");
  assert.equal(m.mem.read16(0x88ba), 0x4c92, "graphic ptr = 0x4c92");
  assert.equal(m.mem.read8(0x880a), 0x01, "sub-state bumped");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_16b7 SHORT: 0x8f50 bit0 set -> force sub-state 0x10 + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8808, 0x01);
  m.mem.write8(0x8f50, 0x01); // bit0 set -> jr z not taken at 0x16c7

  loc_16b7(m);

  assert.equal(m.tstates, 117, "SHORT T-state total");
  assert.deepEqual(m.pcSeq, [
    0x16ba, 0x16bb, 0x16bc, 0x02e3, 0x1dd3, 0x16c5, 0x16c7, 0x16c9, 0x16cb, 0x16ce, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x02e3, 0x1dd3], "only the two setup calls, no decision-tree work");
  assert.equal(m.mem.read8(0x880a), 0x10, "sub-state forced to 0x10");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_16b7 GATE: timer not expired -> ret nz immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8808, 0x02); // dec to 1 -> NZ -> ret nz

  loc_16b7(m);

  assert.equal(m.tstates, 10 + 11 + 11, "T = ld hl + dec (hl) + ret nz");
  assert.deepEqual(m.pcSeq, [0x16ba, 0x16bb, CALLER_RET]);
  assert.deepEqual(m.calls, [], "no work done");
  assert.equal(m.mem.read8(0x8808), 0x01, "timer decremented 2 -> 1");
  assert.equal(m.pc, CALLER_RET);
});

test("loc_16b7 MUTATION: `ld (0x8f45),de` mis-charged 16T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x172c ? 16 : cycles);
  setupTail(m);

  loc_16b7(m);

  assert.equal(m.tstates, 434, "mutation loses 4 T (20 -> 16)");
  assert.throws(
    () => assert.equal(m.tstates, 438, "TAIL T-state total"),
    /438/,
    "the 438-T golden must fail on the mutant",
  );
});
