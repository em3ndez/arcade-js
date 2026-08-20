// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0fc3 (ROM 0x0fc3, Pooyan) -- emit a 4-tile run via loc_0ea2:
 * the caller's A, then 0x15, 0x16, 0x17. Three plain calls plus a tail jp for the last.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_0ea2's ret); a
 * missing push16 then desyncs SP. Three calls push16 + pop; the tail jp does NOT push16, so its
 * callee ret consumes the seated CALLER_RET and SP unwinds to the pre-seat baseline.
 * pcSeq VISITS the call target 0x0ea2 four times (the calls step to the target). TEETH: mis-charge
 * `ld a,0x15` 4T (not 7T).
 *
 * Run: node --test games/pooyan/translated/test/loc_0fc3.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0fc3 } from "../loc_0fc3.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0fc3, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_0fc3: four tiles via loc_0ea2, tail jp on the last", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x14; // caller's tile

  loc_0fc3(m);

  assert.equal(m.tstates, 82, "T = 3*call(17) + 3*ld(7) + tail jp(10)");
  assert.deepEqual(m.pcSeq, [0x0ea2, 0x0fc8, 0x0ea2, 0x0fcd, 0x0ea2, 0x0fd2, 0x0ea2],
    "each call/jp steps to the target 0x0ea2");
  assert.equal(m.pc, 0x0ea2, "tail jp lands on 0x0ea2");
  assert.deepEqual(m.calls, [0x0ea2, 0x0ea2, 0x0ea2, 0x0ea2], "four loc_0ea2 invocations");
  assert.equal(m.regs.a, 0x17, "A holds the last tile before the tail jp");
  assert.equal(m.regs.sp, 0x8780, "tail jp callee ret consumes CALLER_RET -> baseline");
});

test("loc_0fc3 MUTATION: `ld a,0x15` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0fc8 ? 4 : cycles);
  seatCaller(m);
  m.regs.a = 0x14;

  loc_0fc3(m);

  assert.equal(m.tstates, 79, "mutation loses 3 T (7 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 82, "golden T"), /82/, "the 82-T golden must fail");
});
