// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6a35 (ROM 0x6a35-0x6a7e): per-record spawn/init, a CONDITIONAL caller-skip
// reached by loc_6a0f's sweep. Skips an already-active record ((ix+0)|(ix+1) bit0 SET -> ret c, a normal
// return that continues the sweep). Into an empty record it seeds the fields, arms (0x892a)=0x10, then
// reads-and-bumps the (0x892c) phase and picks the spawn data pointer DE by that phase:
//   0 -> 0x76d4 ;  1 -> 0x76d4 (also re-arms (0x892a)=0x1c) ;  2 -> 0x68ef ;  >=3 -> 0x6b0a.
// DE is handed to loc_381e, then pop af; ret returns to the caller's caller (aborting the sweep).
//
// Run: node --test games/pooyan/translated/test/loc_6a35.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6a35 } from "../loc_6a35.js";

const CALLER_RET = 0x6a2f;   // the caller's loop continuation (dropped by the skip)
const OUTER_RET = 0xabcd;    // the caller's caller (where the skip lands)
const REC = 0x8ae0;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0,
    step(n, c) { this.pc = n; this.tstates += c; },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(OUTER_RET); m.push16(CALLER_RET); m.regs.ix = REC; }

// opening (through ret c not taken) + field seed + (0x892a):=0x10 + phase read/bump + cp 0x02
const COMMON = (19 + 19 + 4 + 5) + (4 + 19 + 19 + 4 + 19 + 19 + 19 + 19 + 19) + (10 + 10 + 7 + 7 + 11 + 7);
const CONVERGE = 17 + 10 + 10 + 10; // call 0x381e (m.step 17 + mock ret 10), pop af, ret

test("already-active record -> ret c (normal return, no writes)", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(REC + 0, 0x01); // bit0 set -> ret c
  loc_6a35(m);
  assert.equal(m.pc, CALLER_RET, "ret c continues the sweep");
  assert.equal(m.tstates, 19 + 19 + 4 + 11);
  assert.deepEqual(m.calls, []);
});

function runPhase(phase) {
  const m = makeMachine();
  seat(m);
  m.mem.write8(REC + 0, 0x00); m.mem.write8(REC + 1, 0x00); // empty -> spawn
  m.mem.write8(0x892c, phase);
  loc_6a35(m);
  return m;
}

test("phase 0 -> de=0x76d4, (0x892a) stays 0x10, skip", () => {
  const m = runPhase(0x00);
  assert.equal(m.mem.read8(REC + 1), 0x01, "record activated");
  assert.equal(m.mem.read8(0x892a), 0x10, "delay armed to 0x10, not re-armed");
  assert.equal(m.mem.read8(0x892c), 0x01, "phase bumped 0->1");
  assert.equal(m.regs.de, 0x76d4, "phase 0 data pointer");
  assert.equal(m.pc, OUTER_RET, "skip to caller's caller");
  assert.deepEqual(m.calls, [0x381e]);
  const branch = 7 + 7 + 4 + 12 + 10 + 12; // jr z nt, jr nc nt, and a, jr z taken, de, jr 6a7a
  assert.equal(m.tstates, COMMON + branch + CONVERGE, "phase 0 T-states");
});

test("phase 1 -> de=0x76d4, (0x892a) re-armed to 0x1c, skip", () => {
  const m = runPhase(0x01);
  assert.equal(m.mem.read8(0x892a), 0x1c, "delay re-armed to 0x1c on phase 1");
  assert.equal(m.mem.read8(0x892c), 0x02, "phase bumped 1->2");
  assert.equal(m.regs.de, 0x76d4, "phase 1 data pointer");
  assert.equal(m.pc, OUTER_RET);
  assert.deepEqual(m.calls, [0x381e]);
  const branch = 7 + 7 + 4 + 7 + 7 + 10 + 10 + 12; // jr z nt, jr nc nt, and a, jr z nt, l=0x2a, (hl)=0x1c, de, jr
  assert.equal(m.tstates, COMMON + branch + CONVERGE, "phase 1 T-states");
});

test("phase 2 -> de=0x68ef, skip", () => {
  const m = runPhase(0x02);
  assert.equal(m.mem.read8(0x892a), 0x10, "delay stays 0x10");
  assert.equal(m.mem.read8(0x892c), 0x03, "phase bumped 2->3");
  assert.equal(m.regs.de, 0x68ef, "phase 2 data pointer");
  assert.equal(m.pc, OUTER_RET);
  assert.deepEqual(m.calls, [0x381e]);
  const branch = 12 + 10 + 12; // jr z taken, de=0x68ef, jr 6a7a
  assert.equal(m.tstates, COMMON + branch + CONVERGE, "phase 2 T-states");
});

test("phase 3 (>=3) -> de=0x6b0a, skip", () => {
  const m = runPhase(0x03);
  assert.equal(m.mem.read8(0x892a), 0x10, "delay stays 0x10");
  assert.equal(m.mem.read8(0x892c), 0x04, "phase bumped 3->4");
  assert.equal(m.regs.de, 0x6b0a, "phase >=3 data pointer");
  assert.equal(m.pc, OUTER_RET);
  assert.deepEqual(m.calls, [0x381e]);
  const branch = 7 + 12 + 10; // jr z nt, jr nc taken, de=0x6b0a (falls to 6a7a)
  assert.equal(m.tstates, COMMON + branch + CONVERGE, "phase 3 T-states");
});
