// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_5e11 (ROM 0x5e11, Pooyan) -- the B-iteration proximity sweep
 * that calls loc_5e1f per target slot and advances IY by 4 / HL by 0x18 each pass.
 *
 * The mock's `call` POPS the return address the site pushed (modelling loc_5e1f's `ret` back to 0x5e14
 * on the no-hit path), so a `call 0x5e1f` missing its push16 desyncs SP and the final `ret` misses the
 * seated caller. The single branch is djnz; B=3 exercises both taken and not-taken.
 *
 * Run: node --test games/pooyan/translated/test/loc_5e11.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5e11 } from "../loc_5e11.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5e11, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const PC_B3 = [
  0x5e1f, 0x5e17, 0x5e19, 0x5e1b, 0x5e1c, 0x5e11, // iter1 (djnz taken)
  0x5e1f, 0x5e17, 0x5e19, 0x5e1b, 0x5e1c, 0x5e11, // iter2 (djnz taken)
  0x5e1f, 0x5e17, 0x5e19, 0x5e1b, 0x5e1c, 0x5e1e, // iter3 (djnz not taken -> exit)
  CALLER_RET,
];

test("loc_5e11: B=3 sweep -- 3x call 0x5e1f, IY+=12, HL+=0x48, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x03;
  m.regs.iy = 0x887c;
  m.regs.hl = 0x8be8;

  loc_5e11(m);

  assert.equal(m.tstates, 224, "B=3 T-state total (73+73+68+10)");
  assert.deepEqual(m.pcSeq, PC_B3, "step boundaries match the ROM bytes");
  assert.deepEqual(m.calls, [0x5e1f, 0x5e1f, 0x5e1f], "one loc_5e1f call per slot");
  assert.equal(m.pc, CALLER_RET, "final ret lands on the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
  assert.equal(m.regs.b, 0x00, "B decremented to 0");
  assert.equal(m.regs.iy, 0x8888, "IY advanced by 4 per slot");
  assert.equal(m.regs.hl, 0x8c30, "HL advanced by 0x18 per slot");
  assert.equal(m.regs.de, 0x0018, "DE = 0x0018 after the last `ld e,0x18`");
});

test("loc_5e11: B=1 sweep -- single pass", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.iy = 0x887c;
  m.regs.hl = 0x8be8;

  loc_5e11(m);

  assert.equal(m.tstates, 68 + 10, "B=1: one exit iter + ret");
  assert.deepEqual(m.pcSeq, [0x5e1f, 0x5e17, 0x5e19, 0x5e1b, 0x5e1c, 0x5e1e, CALLER_RET]);
  assert.deepEqual(m.calls, [0x5e1f]);
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_5e11 MUTATION: `add iy,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x03;
  m.regs.iy = 0x887c;
  m.regs.hl = 0x8be8;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x5e19 ? 11 : c); // add iy,de steps to 0x5e19

  loc_5e11(m);

  assert.equal(m.tstates, 224 - 4 * 3, "mutation loses 4 T per iter");
  assert.throws(() => assert.equal(m.tstates, 224), /224/, "the golden must fail on the mutant");
});
