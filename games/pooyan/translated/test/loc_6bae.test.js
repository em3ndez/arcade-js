// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6bae (ROM 0x6bae, Pooyan) -- a two-instruction tail:
 *   rst 0x38  (enqueue the DE display command via loc_0038; return pushed = 0x6baf)
 *   jp 0x02ef (unconditional tail-jump; control does not return to loc_6bae)
 *
 * Pinned path (the only path):
 *   T = 11 (rst 0x38) + 10 (jp) = 21.
 *   pcSeq = [0x0038, 0x02ef]; calls = [0x0038, 0x02ef].
 *   SP: the balancing `call` stub consumes the rst return (0x6baf) on the loc_0038 call, and the
 *   tail `call(0x02ef)` models 0x02ef eventually ret'ing to the caller -> net SP unchanged.
 *
 * TEETH: mis-charge `rst 0x38` (11 T) as 7 T -- the golden T-state must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_6bae.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6bae } from "../loc_6bae.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6bae, pcSeq: [],
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
    // balancing stub: each delegated call/rst consumes the return pushed for it (SP += 2)
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_6bae: rst 0x38 enqueue then jp 0x02ef tail-jump; 21 T, SP balanced", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x06af; // a display command in DE (as the jr-0x6bae entry from loc_6bb2 leaves it)

  loc_6bae(m);

  assert.equal(m.tstates, 21, "T = 11 (rst 0x38) + 10 (jp)");
  assert.deepEqual(m.pcSeq, [0x0038, 0x02ef], "rst target then the tail-jump target");
  assert.deepEqual(m.calls, [0x0038, 0x02ef], "delegates to loc_0038 (enqueue) then tail-jumps to 0x02ef");
  assert.equal(m.pc, 0x02ef, "final PC is the tail-jump target");
  assert.equal(m.regs.sp, 0x8780, "SP balanced: rst return consumed, tail 0x02ef rets to caller slot");
  assert.equal(m.mem.read8(0x877e) | (m.mem.read8(0x877f) << 8), CALLER_RET,
    "the seated caller return still sits in the slot the tail 0x02ef returns through");
});

test("loc_6bae MUTATION: `rst 0x38` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0038 ? 7 : cycles);
  seatCaller(m);

  loc_6bae(m);

  assert.equal(m.tstates, 17, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 21, "golden T-state total catches the mis-charged rst");
});
