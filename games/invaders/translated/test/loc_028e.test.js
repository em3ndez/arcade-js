// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_028e (ROM 0x028e-0x02ec + interior blocks): the pchl-dispatch object handler.
// Record-only mock pins three arms -- the timer-not-expired early ret, a mutation, and the full spine
// through the calls to the fall-through delegate into loc_02ed.
//
// Run: node --test games/invaders/translated/test/loc_028e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_028e } from "../loc_028e.js";

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
    io: { inte: false, outs: [], setInte(on) { this.inte = !!on; }, portOut(p, v) { this.outs.push([p, v & 0xff]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

// Timer-not-expired arm: record ptr 0x2500; [0x2501]!=0xff; [0x2502] decrements to nonzero -> rnz rets.
function seatShort(m) {
  m.regs.sp = 0x2400;
  m.push16(0x9999);  // return address for the rnz
  m.push16(0x2500);  // popped by `pop h`
  m.ram[0x2501] = 0x05;  // != 0xff
  m.ram[0x2502] = 0x02;  // dcr m -> 0x01 (nonzero) -> rnz taken
}

test("loc_028e: timer not expired -> rnz early return; 65 T", () => {
  const m = makeMachine();
  seatShort(m);
  loc_028e(m);
  assert.equal(m.tstates, 10 + 5 + 7 + 7 + 10 + 5 + 10 + 11, "pop..rnz(taken) = 65");
  assert.equal(m.regs.hl, 0x2502, "HL walked to the timer cell");
  assert.equal(m.regs.a, 0x05, "A holds the record byte");
  assert.equal(m.ram[0x2502], 0x01, "dcr m wrote 0x01");
  assert.deepEqual(m.calls, [], "no sub-calls on the early-out arm");
  assert.equal(m.pc, 0x9999, "rnz returns to the seeded address");
});

test("loc_028e MUTATION: dcr m mis-charged 5T (dcr r) not 10T is caught", () => {
  const m = makeMachine();
  seatShort(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x0298 ? 5 : c);
  loc_028e(m);
  assert.notEqual(m.tstates, 65, "golden T total catches the mutant");
  assert.equal(m.tstates, 60, "mutation loses 5 T (10 -> 5)");
});

// Full spine: timer expires ([0x2502] & [0x2503] hit 0), all gate reads fall through, no interior
// branch taken, ending in the fall-through delegate into loc_02ed.
test("loc_028e: timer expiry -> full rebuild spine -> delegate loc_02ed", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(0x2500);        // popped by `pop h`
  m.ram[0x2501] = 0x01;    // record byte (!= 0xff), becomes B
  m.ram[0x2502] = 0x01;    // dcr m (0297) -> 0 -> rnz not taken
  m.ram[0x2503] = 0x01;    // dcr m (02aa) -> 0 -> jnz 039b not taken
  m.mem.write16(0x201a, 0x0000);
  m.ram[0x206d] = 0x00;    // ana a -> Z -> rnz(02ca) not taken
  m.ram[0x20ef] = 0x01;    // ana a -> NZ -> rz(02cf) not taken; stays A at 02da/02db
  m.ram[0x2010] = 0x01;    // mov a,m (02e1) -> NZ -> jz(02e3) not taken
  m.ram[0x20ce] = 0x01;    // ana a -> NZ -> jz(02ea) not taken -> fall to loc_02ed

  loc_028e(m);

  assert.deepEqual(
    m.calls,
    [0x1424, 0x1a32, 0x19dc, 0x19d7, 0x092e, 0x18e7, 0x02ed],
    "the spine's calls then the fall-through delegate",
  );
  assert.equal(m.ram[0x2068], 0x00, "sta 0x2068 <- 0");
  assert.equal(m.ram[0x2069], 0x00, "sta 0x2069 <- 0");
  assert.equal(m.ram[0x206a], 0x30, "sta 0x206a <- 0x30");
  assert.equal(m.ram[0x2502], 0x05, "mvi m,0x05 overwrote the timer cell");
  assert.equal(m.ram[0x2503], 0x00, "second dcr m left 0");
  assert.equal(m.io.inte, true, "EI armed interrupt-enable");
  assert.equal(m.pc, 0x02ed, "last step lands at loc_02ed");
});
