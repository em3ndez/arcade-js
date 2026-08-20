// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_02c9 (ROM 0x02c9-0x02e2, Pooyan) -- round-init tile-fill helper.
 * Calls 0x02b9, then blanks B=0x1d tiles (=0x10) at the scroll pointer (0x880b) via rst 0x10
 * (loc_0010, HL+=B), advances the pointer by 0x20-B=3 (add hl,de), decrements (0x8809).
 *
 * The mock's `call` POPS the pushed return (modelling each callee's `ret`), so a missing push16 at
 * a call site desyncs SP and fails the balance tooth. Following the loc_02ce convention, the mock
 * does NOT model rst 0x10's HL+=B (it runs inert), so `add hl,de` operates on the loaded pointer;
 * the translated file itself faithfully delegates the fill to loc_0010 via m.call.
 *
 * Pins one path: (0x880b)=0x8500 -> 0x8503 (loaded +DE(3)), (0x8809) 0x05 -> 0x04, calls
 * [0x02b9, 0x0010], full pcSeq, T = 138.
 * TEETH: mis-charge `ld (0x880b),hl` as 13 T (the `ld (nn),a` timing) not 16.
 * POSITIVE CONTROL (performed): deleting either push16 desyncs SP -> the ret lands off CALLER_RET
 * and the SP-baseline assertion throws; restored afterward.
 *
 * Run: node --test games/pooyan/translated/test/loc_02c9.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02c9 } from "../loc_02c9.js";

const CALLER_RET = 0xabcd;
const F_N = 0x02, F_Z = 0x40;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x02c9, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Each callee's `ret` pops the return address this call site pushed -- model that pop so the
    // stack stays balanced (a missing push16 then desyncs SP and fails the test). No register
    // modelling needed: loc_02c9 consumes nothing 0x02b9/0x0010 return.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const PC_SEQ = [
  0x02b9,                 // call 0x02b9 -> target
  0x02ce, 0x02d0, 0x02d1, 0x02d2, 0x02d4, 0x02d7, 0x02d9,
  0x0010,                 // rst 0x10 -> target
  0x02db, 0x02de, 0x02e1, 0x02e2,
  CALLER_RET,
];

function setup(m) {
  seatCaller(m);
  m.mem.write16(0x880b, 0x8500); // current scroll pointer
  m.mem.write8(0x8809, 0x05);    // rows-remaining counter
}

test("loc_02c9: call 0x02b9, fill via rst 0x10, pointer +DE, counter dec, ret", () => {
  const m = makeMachine();
  setup(m);

  loc_02c9(m);

  assert.equal(m.tstates, 138, "T = 17+7+7+4+4+7+16+7+11+11+16+10+11+10");
  assert.deepEqual(m.pcSeq, PC_SEQ, "step boundaries match the disasm");
  assert.equal(m.pc, CALLER_RET, "ret popped the seated caller address");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (both push16 matched a callee ret)");
  assert.deepEqual(m.calls, [0x02b9, 0x0010], "call 0x02b9 then rst 0x10 -> loc_0010");
  assert.equal(m.regs.b, 0x1d, "B = fill count");
  assert.equal(m.regs.a, 0x10, "A = fill value 0x10");
  assert.equal(m.regs.e, 0x03, "E = 0x20 - 0x1d = 0x03");
  assert.equal(m.regs.d, 0x00, "D = 0");
  assert.equal(m.regs.hl, 0x8809, "HL = counter address (last load)");
  assert.equal(m.mem.read16(0x880b), 0x8503, "(0x880b) = 0x8500 + DE(0x03)");
  assert.equal(m.mem.read8(0x8809), 0x04, "(0x8809) decremented 0x05 -> 0x04");
  assert.equal(m.regs.f & F_N, F_N, "dec (hl) leaves N set");
  assert.equal(m.regs.f & F_Z, 0, "counter 0x04 != 0 -> Z clear");
});

test("loc_02c9 MUTATION: `ld (0x880b),hl` mis-charged 13T (not 16) is caught", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x02de ? 13 : cycles);

  loc_02c9(m);

  assert.equal(m.tstates, 135, "mutation loses 3 T (16 -> 13)");
  assert.throws(
    () => assert.equal(m.tstates, 138, "Path T-state total"),
    /138/,
    "the T-state golden must fail on the mutant",
  );
});
