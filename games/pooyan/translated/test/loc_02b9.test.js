// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_02b9 (ROM 0x02b9, Pooyan) -- zero-fills RAM
 * regions via four `rst 0x10` calls to the loc_0010 fill helper. Self-contained
 * mock (real Regs for exact flags, flat 64K RAM, step/call/ret/push16/pop16). The
 * mock's `call` pops the pushed return to model loc_0010's balanced `ret`, so the
 * routine's own `ret` recovers the seated caller address.
 *
 * Pins the single straight path off the bytes/disasm: A=0 (xor a), HL walks
 * 0x8840 -> 0x8a80, B ends 0x37, four calls to 0x0010, T = 92, full pcSeq.
 * TEETH: mis-charge the FIRST `rst 0x10` as 10 T (not 11) -- the golden must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_02b9.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02b9 } from "../loc_02b9.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x02b9, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // loc_0010 is a balanced subroutine (djnz fill + ret): model it as pop-only.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const EXPECTED_PC_SEQ = [
  0x02bc, 0x02be, 0x02bf,
  0x0010, // rst 0x10
  0x02c3,
  0x0010, // rst 0x10
  0x0010, // rst 0x10
  0x02c7,
  0x0010, // rst 0x10
  CALLER_RET,
];

test("loc_02b9: four rst-0x10 fills, HL 0x8840->0x8a80, B=0x37, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x5a; // xor a must zero it
  loc_02b9(m);

  assert.equal(m.regs.a, 0x00, "xor a -> A = 0");
  assert.equal(m.regs.f & 0x40, 0x40, "Z flag set from xor a");
  assert.equal(m.regs.b, 0x37, "B = last count loaded (0x37)");
  assert.equal(m.regs.hl, 0x8a80, "HL = last pointer loaded (mock leaves fills inert)");
  assert.equal(m.tstates, 92, "T = 10+7+4+11+10+11+11+7+11+10");
  assert.equal(m.pc, CALLER_RET, "ret popped the seated caller address");
  assert.deepEqual(m.calls, [0x0010, 0x0010, 0x0010, 0x0010], "four rst 0x10 -> loc_0010");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "step boundaries match the disasm");
});

test("loc_02b9 MUTATION: first `rst 0x10` mis-charged 10T (not 11) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x0010) { first = false; return realStep(nextAddr, 10); }
    return realStep(nextAddr, cycles);
  };
  loc_02b9(m);

  assert.equal(m.tstates, 91, "mutation loses 1 T (11 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 92, "T = 10+7+4+11+10+11+11+7+11+10"),
    /10\+7\+4\+11/,
    "the T-state golden must fail on the mutant",
  );
});
