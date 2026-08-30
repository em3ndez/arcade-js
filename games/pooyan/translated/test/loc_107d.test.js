// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_107d (ROM 0x107d, Pooyan) -- gated main-loop sub-state handler.
 * If (0x8901) != 0 it returns via `ret nz`; otherwise it advances the selector at 0x8f5c, enqueues
 * display command DE=0x0635 via rst 0x38 (loc_0038), and seeds the countdown at 0x8f62 with 0x40.
 *
 * loc_0038 is a plain-ret (pattern-A) callee: the stub runs m.ret() to pop the rst-pushed return,
 * so the stack balances back to the seated caller.
 *
 * Pinned paths:
 *   gated  (0x8901=0x01 -> NZ): ret nz taken. T = 13 + 4 + 11 = 28. No selector/enqueue.
 *   active (0x8901=0x00 -> Z):  full body. T = 13 + 4 + 5 + 10 + 11 + 10 + 11 (rst) + 10 (loc_0038
 *     stub ret, per the pattern-A convention) + 7 + 13 + 10 = 104.
 *
 * TEETH: mis-charge `ld a,(0x8901)` (13 T) as 7 T -- the golden T-state must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_107d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_107d } from "../loc_107d.js";

const CALLER_RET = 0xabcd;
const PATTERN_A = new Set([0x0038]);

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x107d, pcSeq: [],
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
    call(addr) {
      this.calls.push(addr);
      if (PATTERN_A.has(addr)) this.ret(); // pattern-A callee pops its rst-pushed return
      return undefined;
    },
  };
  return m;
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_107d gated: (0x8901)=0x01 -> ret nz, no work; 28 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x01); // NZ -> ret nz taken
  loc_107d(m);

  assert.equal(m.tstates, 28, "T = 13 + 4 + 11(ret nz taken)");
  assert.deepEqual(m.pcSeq, [0x1080, 0x1081, CALLER_RET], "and a, then ret nz to caller");
  assert.deepEqual(m.calls, [], "no enqueue when gated");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.equal(m.mem.read8(0x8f5c), 0x00, "selector untouched");
  assert.equal(m.mem.read8(0x8f62), 0x00, "countdown untouched");
});

test("loc_107d active: (0x8901)=0x00 -> advance selector, enqueue 0x0635, seed 0x8f62; 104 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x00); // Z -> ret nz not taken
  m.mem.write8(0x8f5c, 0x03); // pre-existing selector value
  loc_107d(m);

  assert.equal(m.tstates, 104, "T = 13+4+5+10+11+10+11+10(stub ret)+7+13+10");
  assert.deepEqual(
    m.pcSeq,
    [0x1080, 0x1081, 0x1082, 0x1085, 0x1086, 0x1089, 0x0038, 0x108a, 0x108c, 0x108f, CALLER_RET],
    "full body then rst target and back through the tail to the caller",
  );
  assert.deepEqual(m.calls, [0x0038], "one rst-0x38 enqueue via loc_0038");
  assert.equal(m.mem.read8(0x8f5c), 0x04, "selector advanced 0x03 -> 0x04");
  assert.equal(m.regs.de, 0x0635, "DE = display command enqueued");
  assert.equal(m.mem.read8(0x8f62), 0x40, "countdown seeded with 0x40");
  assert.equal(m.regs.a, 0x40, "A = 0x40 after seeding");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (rst return popped by loc_0038, caller by final ret)");
});

test("loc_107d MUTATION: `ld a,(0x8901)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1080 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8901, 0x00);
  loc_107d(m);

  assert.equal(m.tstates, 98, "mutation loses 6 T (13 -> 7): 104 -> 98");
});
