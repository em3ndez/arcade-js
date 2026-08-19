// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_02e6 (ROM 0x02e6, Pooyan) -- stores HL into
 * (0x880b) and seeds the counter (0x8809) to 0x20, then ret. Self-contained mock
 * (real Regs, flat 64K RAM, step/ret/push16/pop16). A seated caller address proves
 * the `ret` fired.
 *
 * Pins the single path: HL=0x8402 -> (0x880b), (0x8809)=0x20, T = 46, full pcSeq.
 * TEETH: mis-charge `ld (0x880b),hl` as 13 T (not 16) -- the golden must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_02e6.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02e6 } from "../loc_02e6.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x02e6, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_02e6: store HL to (0x880b), seed (0x8809)=0x20, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8402;
  m.mem.write8(0x8809, 0x99); // must be overwritten to 0x20
  loc_02e6(m);

  assert.equal(m.mem.read16(0x880b), 0x8402, "(0x880b) = HL");
  assert.equal(m.regs.a, 0x20, "A = 0x20");
  assert.equal(m.mem.read8(0x8809), 0x20, "(0x8809) seeded to 0x20");
  assert.equal(m.tstates, 46, "T = 16 + 7 + 13 + 10");
  assert.equal(m.pc, CALLER_RET, "ret popped the seated caller address");
  assert.deepEqual(m.calls, [], "no calls");
  assert.deepEqual(m.pcSeq, [0x02e9, 0x02eb, 0x02ee, CALLER_RET], "step boundaries match the disasm");
});

test("loc_02e6 MUTATION: `ld (0x880b),hl` mis-charged 13T (not 16) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8402;
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x02e9 ? 13 : cycles);
  loc_02e6(m);

  assert.equal(m.tstates, 43, "mutation loses 3 T (16 -> 13)");
  assert.throws(
    () => assert.equal(m.tstates, 46, "T = 16 + 7 + 13 + 10"),
    /16 \+ 7/,
    "the T-state golden must fail on the mutant",
  );
});
