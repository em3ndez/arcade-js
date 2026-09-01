// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1538 (ROM 0x1538-0x1544): decrement despawn timer 0x2003; while non-
// zero, rnz early-return. On expiry, reload HL from 0x2064, B=0x10, clear the column via loc_1424,
// then fall through into loc_1545. call is record-only, so pc rests at the last stepped address.
//
// Run: node --test games/invaders/translated/test/loc_1538.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1538 } from "../loc_1538.js";

const CALLER_RET = 0xbeef;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_1538 expiry arm: timer 0x01 -> 0x00, clears column via 0x1424, falls into 0x1545; 65 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2003, 0x01); // dcr -> 0, rnz not taken
  m.mem.write16(0x2064, 0x1234); // stored prize position

  loc_1538(m);

  assert.equal(m.mem.read8(0x2003), 0x00, "timer decremented to 0");
  assert.equal(m.regs.hl, 0x1234, "HL reloaded from 0x2064");
  assert.equal(m.regs.b, 0x10, "B := 0x10 rows");
  assert.equal(m.tstates, 10 + 10 + 5 + 16 + 7 + 17, "lxi+dcr+rnz(nt)+lhld+mvi+call");
  assert.deepEqual(m.calls, [0x1424, 0x1545], "clears column then falls into loc_1545");
  assert.equal(m.mem.read16(0x23fe), 0x1545, "call 0x1424 pushed return addr 0x1545");
  assert.equal(m.pc, 0x1424, "last step lands at loc_1424 (fall-through delegate takes no step)");
});

test("loc_1538 still-counting arm: timer 0x05 -> 0x04, rnz early return; 31 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2003, 0x05);

  loc_1538(m);

  assert.equal(m.mem.read8(0x2003), 0x04, "timer decremented, still non-zero");
  assert.equal(m.tstates, 10 + 10 + 11, "lxi+dcr+rnz(taken)");
  assert.deepEqual(m.calls, [], "no column clear while counting");
  assert.equal(m.pc, CALLER_RET, "rnz returns to caller");
});

test("loc_1538 MUTATION: `lhld 0x2064` mis-charged 10T (not 16T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2003, 0x01);
  m.mem.write16(0x2064, 0x1234);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1540 ? 10 : c); // lhld lands at 0x1540
  loc_1538(m);
  assert.notEqual(m.tstates, 65, "golden T-state total catches the mutant");
});
