// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0682 (ROM 0x0682-0x0706), the dispatched object handler. Covers two
// arms: the early `rnz` bail when the mode cell != 0x02, and the deep path (jnz 0x06ab taken ->
// loc_06ab -> jnz 0x06d6 taken -> loc_06d6) that decrements the countdown to 0x1f and delegates to
// loc_074b. 0x1a06 is a collision helper whose CY the record-only mock seats to drive that arm.
// Run: node --test games/invaders/translated/test/loc_0682.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0682 } from "../loc_0682.js";

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
    regs, mem, ram, calls: [], ports: [], tstates: 0, pc: 0, pcSeq: [],
    io: { portOut(p, v) { this.owner.ports.push([p, v]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

// The deep path: mode==2, object active, no lockout, obj-state nonzero (jnz 0x06ab taken), the
// 0x1a06 helper returns CY (seated below), 0x2085 nonzero (jnz 0x06d6 taken), and the 0x2086
// countdown 0x20 -> dcr -> 0x1f -> jz 0x074b.
function seatDeep(m) {
  m.regs.sp = 0x23fe;
  m.mem.write16(0x23fe, 0xdead); // popped and discarded by `pop h`
  m.mem.write8(0x2080, 0x02);    // cpi 0x02 -> Z, rnz falls through
  m.mem.write8(0x2083, 0x03);    // ana a -> NZ, jz 0x050f falls through
  m.mem.write8(0x2056, 0x00);    // ana a -> Z, jnz 0x050f falls through
  m.mem.write8(0x2084, 0x05);    // ana a -> NZ, jnz 0x06ab TAKEN
  m.mem.write8(0x2085, 0x01);    // ana a -> NZ, jnz 0x06d6 TAKEN
  m.mem.write8(0x2086, 0x20);    // dcr m -> 0x1f, jz 0x074b TAKEN
  const realCall = m.call.bind(m);
  m.call = (addr) => { if (addr === 0x1a06) m.regs.fC = true; return realCall(addr); }; // 0x1a06 returns CY
}

test("loc_0682 deep: jnz 06ab + jnz 06d6, countdown 0x20->0x1f, delegates to 0x074b; 245 T", () => {
  const m = makeMachine();
  m.io.owner = m;
  seatDeep(m);

  loc_0682(m);

  assert.equal(m.regs.a, 0x1f, "A := post-dcr countdown 0x1f");
  assert.equal(m.regs.b, 0xfe, "B := 0xfe (loc_06d6)");
  assert.equal(m.regs.hl, 0x2086, "HL walked 0x2085 -> 0x2086");
  assert.equal(m.regs.de, 0x208a, "DE := 0x208a (loc_06ab)");
  assert.equal(m.mem.read8(0x2086), 0x1f, "countdown cell 0x2086 decremented to 0x1f");
  assert.equal(m.tstates, 245, "T total for the deep -> 0x074b path");
  assert.equal(m.pc, 0x074b, "last step lands at the loc_074b delegate");
  assert.deepEqual(m.calls, [0x1a06, 0x19dc, 0x074b], "1a06, 19dc, then delegate 074b");
  assert.deepEqual(m.ports, [], "out 0x05 not reached on this arm");
  assert.equal(m.mem.read16(0x23fe), 0x06b1, "call 0x1a06 pushes return 0x06b1");
  assert.equal(m.mem.read16(0x23fc), 0x06db, "call 0x19dc pushes return 0x06db");
  assert.equal(m.regs.sp, 0x23fc, "SP: pop(+2) then two pushes(-4)");
});

test("loc_0682 early: mode cell != 0x02 -> rnz returns to caller; 41 T", () => {
  const m = makeMachine();
  m.io.owner = m;
  m.regs.sp = 0x2400;
  m.push16(0xabcd);            // the caller's real return, taken by rnz
  m.push16(0x9999);            // discarded by `pop h`
  m.mem.write8(0x2080, 0x00);  // cpi 0x02 -> NZ, rnz TAKEN

  loc_0682(m);

  assert.equal(m.tstates, 10 + 13 + 7 + 11, "T: pop(10)+lda(13)+cpi(7)+rnz-taken(11)");
  assert.equal(m.pc, 0xabcd, "rnz returns to the caller address");
  assert.deepEqual(m.calls, [], "no helper called on the early bail");
  assert.equal(m.regs.sp, 0x2400, "SP back to base: pop + rnz-pop");
});

test("loc_0682 MUTATION: call 0x19dc mischarged 11T not 17T is caught", () => {
  const m = makeMachine();
  m.io.owner = m;
  seatDeep(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x19dc ? 11 : c);
  loc_0682(m);
  assert.equal(m.tstates, 239, "mutation loses 6 T (17 -> 11)");
  assert.notEqual(m.tstates, 245, "golden T-state total catches the mutant");
});
