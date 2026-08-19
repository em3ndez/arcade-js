// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0fd5 (ROM 0x0fd5, Pooyan) -- the main-loop sub-state
 * dispatcher. A = (0x8f5c & 7). For states >= 2 it pushes the tail return 0x1035 first;
 * states 0/1 skip that push (jr c). Then `rst 0x28` -> loc_0028 reads the inline word table
 * at 0x0fe3 and jp (hl)'s to the selected handler.
 *
 * Pinned paths:
 *   state 2 (0x8f5c=0x0a -> &7 = 2, cp 2 => NO carry): push 0x1035, then dispatch.
 *     T = 13 + 7 + 7 + 7 + 10 + 11 + 11 = 66. Stack: 0x0fe3 (rst return/table base) on top,
 *     then 0x1035 (handler tail), then the seated caller below.
 *   state 1 (0x8f5c=0x09 -> &7 = 1, cp 2 => carry): jr taken, no push.
 *     T = 13 + 7 + 7 + 12 + 11 = 50. Stack: 0x0fe3 on top, then the seated caller (no 0x1035).
 *
 * TEETH: mis-charge `ld a,(0x8f5c)` (13 T) as 7 T -- the golden T-state must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_0fd5.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0fd5 } from "../loc_0fd5.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0fd5, pcSeq: [],
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
    call(addr, site) { this.calls.push(addr); this.site = site; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_0fd5: state 2 (0x8f5c=0x0a) pushes tail 0x1035, then dispatches via loc_0028", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f5c, 0x0a); // 0x0a & 7 = 2 -> state 2, cp 2 => no carry
  loc_0fd5(m);

  assert.equal(m.tstates, 66, "T = 13+7+7+7(jr nt)+10+11+11");
  assert.deepEqual(m.pcSeq, [0x0fd8, 0x0fda, 0x0fdc, 0x0fde, 0x0fe1, 0x0fe2, 0x0028],
    "no-carry path falls through the push, then the rst target");
  assert.deepEqual(m.calls, [0x0028], "delegates to the generic dispatcher loc_0028");
  assert.equal(m.regs.a, 0x02, "A = masked state index preserved into the dispatch");
  assert.equal(m.pop16(), 0x0fe3, "top of stack = rst return = inline table base 0x0fe3");
  assert.equal(m.pop16(), 0x1035, "beneath it = the pushed handler tail return 0x1035");
  assert.equal(m.pop16(), CALLER_RET, "beneath that = the seated caller return");
});

test("loc_0fd5: state 1 (0x8f5c=0x09) takes jr c, skips the push", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f5c, 0x09); // 0x09 & 7 = 1 -> state 1, cp 2 => carry
  loc_0fd5(m);

  assert.equal(m.tstates, 50, "T = 13+7+7+12(jr taken)+11");
  assert.deepEqual(m.pcSeq, [0x0fd8, 0x0fda, 0x0fdc, 0x0fe2, 0x0028],
    "carry path jumps straight to the rst");
  assert.deepEqual(m.calls, [0x0028], "delegates to loc_0028");
  assert.equal(m.regs.a, 0x01, "A = state 1");
  assert.equal(m.pop16(), 0x0fe3, "top of stack = table base 0x0fe3");
  assert.equal(m.pop16(), CALLER_RET, "no 0x1035 pushed: caller return sits directly beneath");
});

test("loc_0fd5 MUTATION: `ld a,(0x8f5c)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0fd8 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8f5c, 0x0a);
  loc_0fd5(m);

  assert.equal(m.tstates, 60, "mutation loses 6 T (13 -> 7)");
});
