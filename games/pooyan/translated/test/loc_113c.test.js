// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for translated loc_113c (ROM 0x113c, Pooyan) -- sub-state 4 handler. HL=0x8f62 is a
// countdown timer. Non-zero: dec it, enqueue display command DE=0x0315 via rst 0x38 (loc_0038),
// ret. Zero: reload timer to 0x80, bump the sub-state selector at 0x8f5c (`ld l,0x5c` + inc (hl)),
// ret.
//
// loc_0038 is a plain-ret routine, so rst 0x38 is pattern-A: the stub pops its pushed return
// (0x1148) via m.ret() -- a record-only stub would hide the stack. A record-only stub is used for
// the enqueue path here, then the transcribed final ret at 0x1148 pops the caller.
//
// Pinned paths:
//   Path A (timer != 0): jr z not taken, dec (hl), ld de,0x0315, rst 0x38, ret.
//     T = 10 + 7 + 4 + 7 + 11 + 10 + 11 + 10(stub ret 0x1148) + 10(final ret) = 80.
//   Path B (timer == 0): jr z taken, ld (hl),0x80, ld l,0x5c, inc (hl), ret.
//     T = 10 + 7 + 4 + 12 + 10 + 7 + 11 + 10 = 71.
//
// TEETH: mis-charge `jr z` taken (12 T) as 7 T on Path B -- the golden T-state must catch it.
//
// Run: node --test games/pooyan/translated/test/loc_113c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_113c } from "../loc_113c.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x113c, pcSeq: [],
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

// loc_0038 is a plain-ret routine: the pattern-A stub pops its pushed return via m.ret().
function installEnqueueStub(m) {
  m.call = (addr, site) => { m.calls.push(addr); m.site = site; m.ret(); return undefined; };
}

test("loc_113c Path A: timer!=0 -> dec, enqueue DE=0x0315 via rst 0x38; 80 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installEnqueueStub(m);
  m.mem.write8(0x8f62, 0x03); // timer non-zero

  loc_113c(m);

  assert.equal(m.tstates, 80, "Path A T = 10+7+4+7+11+10+11 +10(stub ret) +10(final ret)");
  assert.deepEqual(m.pcSeq, [0x113f, 0x1140, 0x1141, 0x1143, 0x1144, 0x1147, 0x0038, 0x1148, CALLER_RET],
    "not-taken path: dec/de/rst, stub rets to 0x1148, final ret to caller");
  assert.deepEqual(m.calls, [0x0038], "delegates the enqueue to loc_0038");
  assert.equal(m.mem.read8(0x8f62), 0x02, "timer decremented 0x03 -> 0x02");
  assert.equal(m.regs.de, 0x0315, "DE = display command 0x0315");
  assert.equal(m.pc, CALLER_RET, "returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (rst push popped + final ret)");
});

test("loc_113c Path B: timer==0 -> reload 0x80, bump selector 0x8f5c; 71 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f62, 0x00); // timer expired
  m.mem.write8(0x8f5c, 0x04); // sub-state selector before bump

  loc_113c(m);

  assert.equal(m.tstates, 71, "Path B T = 10+7+4+12+10+7+11+10");
  assert.deepEqual(m.pcSeq, [0x113f, 0x1140, 0x1141, 0x1149, 0x114b, 0x114d, 0x114e, CALLER_RET],
    "taken path: reload timer, retarget HL to 0x8f5c, inc, ret");
  assert.deepEqual(m.calls, [], "no rst enqueue on the reload path");
  assert.equal(m.mem.read8(0x8f62), 0x80, "timer reloaded to 0x80");
  assert.equal(m.mem.read8(0x8f5c), 0x05, "sub-state selector incremented 0x04 -> 0x05");
  assert.equal(m.pc, CALLER_RET, "returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_113c MUTATION: `jr z` taken mis-charged 7T (not 12T) on Path B is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f62, 0x00);
  m.mem.write8(0x8f5c, 0x04);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1149 ? 7 : c);

  loc_113c(m);

  assert.equal(m.tstates, 66, "mutation loses 5 T (12 -> 7)");
  assert.notEqual(m.tstates, 71, "golden T-state total catches the mutant");
});
