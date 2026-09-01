// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1400 (ROM 0x1400-0x1421): call setup helper 0x1474, then over B passes
// OR-blit a shift-register byte across two dest bytes [HL],[HL+1], advancing DE by 1 and HL by 0x20
// each pass. The mock records m.call targets rather than running them, so the final `ret` pops the
// internal call's return (0x1404) -- a record-only artifact the golden PC assertion pins. IN 0x03 is
// seated to a fixed shifter output so the OR-blit writes are deterministic.
//
// Run: node --test games/invaders/translated/test/loc_1400.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1400 } from "../loc_1400.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const io = { outs: [], inValue: 0x0f, portOut(p, v) { this.outs.push([p, v & 0xff]); }, portIn() { return this.inValue; } };
  return {
    regs, mem, ram, io, calls: [], pushes: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushes.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

// B=2 passes: source [DE] = 0xab,0xcd; shifter (IN 0x03) fixed 0x0f -> each dest byte OR-blits to
// 0x0f. HL starts 0x2400, so writes land at 0x2400/0x2401 (pass 1) and 0x2420/0x2421 (pass 2).
function seat(m) {
  m.regs.sp = 0x2400;
  m.regs.bc = 0x0200; // B=2 passes, C=0
  m.regs.hl = 0x2400; // dest
  m.regs.de = 0x2000; // source stream
  m.ram[0x2000] = 0xab; m.ram[0x2001] = 0xcd;
}

test("loc_1400: calls 0x1474 then OR-blits 2 passes; 367 T", () => {
  const m = makeMachine();
  seat(m);

  loc_1400(m);

  assert.equal(m.mem.read8(0x2400), 0x0f, "pass1 lo blit");
  assert.equal(m.mem.read8(0x2401), 0x0f, "pass1 hi blit");
  assert.equal(m.mem.read8(0x2420), 0x0f, "pass2 lo blit (HL + 0x20)");
  assert.equal(m.mem.read8(0x2421), 0x0f, "pass2 hi blit");
  assert.equal(m.regs.a, 0x0f, "A holds the last blitted byte");
  assert.equal(m.regs.b, 0x00, "pass counter B ran to 0");
  assert.equal(m.regs.bc, 0x0000, "C preserved across pushes, B=0");
  assert.equal(m.regs.de, 0x2002, "DE consumed 2 source bytes (inx d per pass)");
  assert.equal(m.regs.hl, 0x2440, "HL advanced 0x20 twice");
  assert.deepEqual(m.io.outs, [[0x04, 0xab], [0x04, 0x00], [0x04, 0xcd], [0x04, 0x00]], "shifter loads: source then 0");
  assert.equal(m.tstates, 25 + 2 * 166 + 10, "nop+call+nop (25) + 2*(loop body 166) + ret (10)");
  assert.deepEqual(m.calls, [0x1474], "one delegation to helper 0x1474");
  assert.deepEqual(m.pushes, [0x1404, 0x0200, 0x2400, 0x0100, 0x2420], "call return then per-pass push b/push h");
  assert.equal(m.mem.read16(0x23fe), 0x1404, "call 0x1474 pushes return 0x1404");
  assert.equal(m.pc, 0x1404, "record-only ret pops the internal call's return 0x1404");
  assert.equal(m.regs.sp, 0x2400, "SP balanced (call push, per-pass push/pop, final ret)");
});

test("loc_1400 MUTATION: final ret mis-charged 5T (cond not-taken) not 10T is caught", () => {
  const m = makeMachine();
  seat(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1404 ? 5 : c); // 0x1404 is reached only by the final ret's pop
  loc_1400(m);
  assert.equal(m.tstates, 25 + 2 * 166 + 5, "mutation loses 5 T on the ret");
  assert.notEqual(m.tstates, 367, "golden T-state total catches the mutant");
});
