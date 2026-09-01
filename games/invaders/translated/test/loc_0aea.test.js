// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0aea (ROM 0x0aea-0x0b88 + interior loc_0be8): per-round setup and
// the pre-round wait loops, ending by falling through into loc_0b89 (delegated). Seats the "else"
// arm of the three ana-a branches (0x20ec==0, 0x20ec==0, 0x21ff==0) so the long setup runs, and
// scripts the trigger poll 0x0a59's Z flag so each wait loop takes two passes (proving the back-
// edges): loc_0b71 [Z,then NZ], loc_0b83 [NZ,then Z]. Pins the whole call/delegate sequence, the
// push return addresses, register + memory writes, INTE, the OUT ports, and the T-states.
//
// Run: node --test games/invaders/translated/test/loc_0aea.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0aea } from "../loc_0aea.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const io = {
    outs: [],
    portOut(p, v) { this.outs.push([p & 0x07, v & 0xff]); },
    portIn(p) { return 0; },
    setInte(on) { this.inte = !!on; },
  };
  return {
    regs, mem, ram, io, calls: [], pushes: [], tstates: 0, pc: 0, pcSeq: [],
    // callFx models a record-only callee's flag effect (0x0a59 sets Z); everything else is inert.
    callFx: {},
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushes.push(v); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); const fx = this.callFx[addr]; if (fx) fx(this); return undefined; },
  };
}

test("loc_0aea: full else-arm round setup + two-pass waits, delegates to loc_0b89; 864 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.ram[0x20ec] = 0x00; // both cpi/ana branches take the else (longer) arm
  m.ram[0x21ff] = 0x00; // the 0x21ff ana branch takes the else arm
  // The trigger poll (0x0a59) sets Z: loc_0b71 loops while Z (Z then NZ -> 2 passes);
  // loc_0b83 loops while NZ (NZ then Z -> 2 passes). Queue is consumed across both loops.
  const zq = [true, false, false, true];
  m.callFx[0x0a59] = (mm) => { mm.regs.fZ = zq.shift(); };

  loc_0aea(m);

  assert.equal(m.tstates, 864, "golden T total for this arm-set");
  assert.deepEqual(
    m.calls,
    [
      0x1982, 0x0ab1, 0x0a93, 0x0acf, 0x0ab1, 0x1815, 0x0ab6,
      0x0ae2, 0x0a80, 0x0ae2, 0x0a80, 0x0ab1, 0x0ae2, 0x0a80, 0x0ab1, 0x14cb, 0x0ab6,
      0x09d6, 0x08d1, 0x1a7f,
      0x01e4, 0x01c0, 0x01ef, 0x021a, 0x01cf,
      0x1618, 0x0bf1, 0x0a59, 0x1618, 0x0bf1, 0x0a59, // loc_0b71 x2
      0x0a59, 0x0a59,                                 // loc_0b83 x2
      0x0b89,                                         // fall-through delegate
    ],
    "full call sequence ending in the delegate to loc_0b89",
  );
  assert.deepEqual(
    m.pushes,
    [
      0x0af2, 0x0af6, 0x0b08, 0x0b0e, 0x0b11, 0x0b14, 0x0b17,
      0x0b24, 0x0b27, 0x0b2d, 0x0b30, 0x0b33, 0x0b39, 0x0b3c, 0x0b3f, 0x0b47, 0x0b4a,
      0x0b4d, 0x0b57, 0x0b5d,
      0x0b60, 0x0b63, 0x0b66, 0x0b69, 0x0b71,
      0x0b74, 0x0b77, 0x0b7c, 0x0b74, 0x0b77, 0x0b7c,
      0x0b86, 0x0b86,
    ],
    "each call's return address is pushed in order",
  );
  assert.equal(m.regs.a, 0x00, "A cleared by the final xra a");
  assert.equal(m.regs.bc, 0x0a04, "BC := 0x0a04 (mvi b,0x0a over c=0x04)");
  assert.equal(m.regs.de, 0x1fc9, "DE := 0x1fc9 (last lxi d)");
  assert.equal(m.regs.hl, 0x33b7, "HL := 0x33b7 (last lxi h)");
  assert.equal(m.ram[0x20c1], 0x01, "0x20c1 := 1");
  assert.equal(m.ram[0x21ff], 0x00, "0x21ff := 0 (else arm store)");
  assert.equal(m.ram[0x2025], 0x00, "0x2025 cleared before loc_0b83");
  assert.equal(m.io.inte, true, "EI armed the interrupt-enable flip-flop");
  assert.deepEqual(m.io.outs, [[3, 0], [5, 0], [6, 1], [6, 1]], "OUT 3/5 silence, OUT 6 watchdog per loc_0b71 pass");
  assert.equal(m.pc, 0x0b89, "last step lands at the loc_0b89 entry");
});

test("loc_0aea MUTATION: `ei` mis-charged 10T (not 4T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.ram[0x20ec] = 0x00;
  m.ram[0x21ff] = 0x00;
  const zq = [true, false, false, true];
  m.callFx[0x0a59] = (mm) => { mm.regs.fZ = zq.shift(); };
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0af3 ? 10 : c); // ei's step target
  loc_0aea(m);
  assert.notEqual(m.tstates, 864, "golden T-state total catches the mutant");
});
