// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1ead (ROM 0x1ead, Pooyan) -- bonus/round HUD setup + update chain.
 *
 * LONG path (0x881e == 0): blit the ROM field (0x1ea7, 0x10-terminated) into 0x855f, BCD-convert the
 * round counter 0x8907+1, split it into two nibbles rendered to 0x849f (blank-tile when the high
 * nibble is 0) and 0x847f, stash the low nibble at 0x8483, run the sub-renderers (loc_0c45/loc_3307/
 * loc_1f8c) and loc_1ffb, then fall into the update chain (loc_1f18 + loc_34c9) and ret. Three
 * `push af` bracket the srl splits; the third is popped at 0x1f07 -- the mock's POPPING `call` keeps
 * the stack balanced only if every push16 before a call is present. Full pcSeq (visiting the call
 * targets) + T=550 + the four VRAM writes.
 *
 * SHORT path (0x881e != 0): jr nz straight to the update chain. MUTATION tooth: `add hl,de` in the
 * fill loop mis-charged 7T (not 11T) is caught. POSITIVE CONTROL performed: deleting `m.push16(0x1efb)`
 * before `call 0x0c45` desyncs the stack (the third `pop af` and final `ret` read the wrong slots) and
 * the LONG test fails on pcSeq/sp -- verified, then restored.
 *
 * Run: node --test games/pooyan/translated/test/loc_1ead.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1ead } from "../loc_1ead.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1ead, pcSeq: [],
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
    // Callee `ret` pops the return address the call site pushed. loc_1ead consumes no callee register
    // outputs, so a pure pop is faithful; a missing push16 then desyncs SP and breaks the `pop af` chain.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function setupLong(m) {
  seatCaller(m);
  m.mem.write8(0x881e, 0x00); // not yet set up -> full setup path
  m.mem.write8(0x1ea7, 0x10); // fill loop: first byte is the 0x10 sentinel -> one iteration
  m.mem.write8(0x8907, 0x02); // round -> BCD counter = 3
}

const PC_LONG = [
  0x1eb0, 0x1eb1, 0x1eb3, 0x1eb6, 0x1eb9, 0x1ebc,
  0x1ebd, 0x1ebe, 0x1ebf, 0x1ec0, 0x1ec2, 0x1ec4,             // fill loop, 1 iter
  0x1ec7, 0x1ec8, 0x1ec9, 0x1eca,
  0x1ecc, 0x1ecd, 0x1eca, 0x1ecc, 0x1ecd, 0x1eca, 0x1ecc, 0x1ecd, 0x1ecf, // BCD loop, B=3
  0x1ed0, 0x1ed1, 0x1ed2, 0x1ed4, 0x1ed6, 0x1ed8, 0x1eda,     // 3 push af + 4 srl
  0x1edd, 0x1ede, 0x1ee0, 0x1ee2, 0x1ee3, 0x1ee4, 0x1ee6, 0x1ee9, 0x1eea,
  0x1eeb, 0x1eed, 0x1eef, 0x1ef1, 0x1ef3, 0x1ef5, 0x1ef8,     // 4 srl + and + ld hl
  0x0c45, 0x1efe, 0x3307, 0x1f04, 0x1f8c, 0x1f08, 0x1f09, 0x1f0b, 0x1f0e, 0x1ffb, 0x1f18, 0x34c9,
  CALLER_RET,
];

test("loc_1ead LONG: full setup, both nibbles rendered, then update chain + ret", () => {
  const m = makeMachine();
  setupLong(m);

  loc_1ead(m);

  assert.equal(m.tstates, 550, "LONG T-state total");
  assert.deepEqual(m.pcSeq, PC_LONG, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "final ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (all push16 matched, 3 push af popped)");
  assert.deepEqual(m.calls, [0x0c45, 0x3307, 0x1f8c, 0x1ffb, 0x1f18, 0x34c9], "call graph in order");
  assert.equal(m.mem.read8(0x855f), 0x10, "fill wrote the sentinel byte to 0x855f");
  assert.equal(m.mem.read8(0x849f), 0x10, "high nibble 0 -> blank tile 0x10");
  assert.equal(m.mem.read8(0x847f), 0x03, "low nibble of BCD 0x03");
  assert.equal(m.mem.read8(0x8483), 0x03, "low nibble stashed at 0x8483");
  assert.equal(m.regs.a, 0x03, "A = low nibble after 0x1f09");
  assert.equal(m.regs.b, 0x03, "B reloaded from the third push af");
});

test("loc_1ead SHORT: 0x881e nonzero -> jr nz straight to the update chain", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x881e, 0x01);

  loc_1ead(m);

  assert.equal(m.tstates, 13 + 4 + 12 + 17 + 17 + 10, "ld a + and a + jr nz + 2 calls + ret");
  assert.deepEqual(m.pcSeq, [0x1eb0, 0x1eb1, 0x1f11, 0x1f18, 0x34c9, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
  assert.deepEqual(m.calls, [0x1f18, 0x34c9], "only the update chain");
});

test("loc_1ead MUTATION: fill-loop `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1ec0 ? 7 : cycles);
  setupLong(m);

  loc_1ead(m);

  assert.equal(m.tstates, 546, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 550, "LONG T-state total"),
    /550/,
    "the 550-T golden must fail on the mutant",
  );
});
