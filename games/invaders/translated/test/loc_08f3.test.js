// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_08f3 (ROM 0x08f3-0x08fe): for C entries from DE, load A=(DE), call loc_08ff
// (DE saved across via push d/pop d), advance DE, until C hits 0. The mock's `call` pops the pushed
// return addr (models the callee ret), so pop d recovers the exact DE the push saved -- a missing
// push16 at the call site would desync and pop d would land on the stray return address.
//
// Run: node --test games/invaders/translated/test/loc_08f3.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_08f3 } from "../loc_08f3.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x08f3, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

test("loc_08f3: iterate C=2 entries from DE, calling loc_08ff each, ret", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.de = 0x1b70;
  m.regs.c = 0x02;
  m.mem.write8(0x1b70, 0x11);
  m.mem.write8(0x1b71, 0x22);

  loc_08f3(m);

  assert.equal(m.regs.a, 0x22, "A holds the last entry loaded, (0x1b71)");
  assert.equal(m.regs.de, 0x1b72, "DE advanced past both entries (push/pop kept it across each call)");
  assert.equal(m.regs.c, 0x00, "C drained to 0");
  assert.deepEqual(m.calls, [0x08ff, 0x08ff], "loc_08ff once per entry");
  assert.equal(m.tstates, 140, "T total for two iterations + ret");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.deepEqual(m.pcSeq, [
    0x08f4, 0x08f5, 0x08ff, 0x08f9, 0x08fa, 0x08fb, 0x08f3, // iter1 (jnz taken -> loc_08f3)
    0x08f4, 0x08f5, 0x08ff, 0x08f9, 0x08fa, 0x08fb, 0x08fe, // iter2 (jnz not taken -> ret)
    CALLER_RET,
  ], "step boundaries");
  assert.equal(m.regs.sp, 0x2400, "stack fully balanced (every push16 matched by a pop)");
});

test("loc_08f3: C=1 runs exactly one iteration", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.de = 0x2000;
  m.regs.c = 0x01;
  m.mem.write8(0x2000, 0x5a);

  loc_08f3(m);

  assert.equal(m.regs.a, 0x5a, "single entry loaded");
  assert.equal(m.regs.de, 0x2001, "DE advanced once");
  assert.equal(m.regs.c, 0x00, "C drained");
  assert.deepEqual(m.calls, [0x08ff], "one call");
  assert.equal(m.tstates, 7 + 11 + 17 + 10 + 5 + 5 + 10 + 10, "one iter (jnz not taken) + ret");
});

test("loc_08f3 MUTATION: `push d` mis-charged 5T (not 11T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.de = 0x1b70;
  m.regs.c = 0x02;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x08f5 ? 5 : c); // push d -> step 0x08f5, real 11T
  loc_08f3(m);
  assert.equal(m.tstates, 128, "mutation loses 6 T per push, twice (12 total)");
  assert.notEqual(m.tstates, 140, "golden T-state total catches the mutant");
});
