// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0935 (ROM 0x0935-0x097b): fetch an object record via 0x1910; bail if its
// state byte (HL-2) is 0; pick limit B from port-2 bit3 (0x15 or 0x10); bail if the counter (HL-1)
// is below B; else bump it (0x092e/inr m), fan a 4-step draw over 0x2501+, redraw (0x1439), clear
// the record and tail-jump to loc_18fa. Expected values derived from dk.asm. The mock's call is
// record-only, so HL is not reloaded across the two 0x1910 calls and pop psw pops the last pushed
// return -- both documented harness artifacts, asserted directly.
//
// Run: node --test games/invaders/translated/test/loc_0935.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0935 } from "../loc_0935.js";

function makeMachine(port2 = 0x00) {
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
    io: { portIn: () => port2 & 0xff },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_0935 BAIL rz: record state byte (HL-2) == 0 -> ret; 49 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write16(0x2400, 0x1234);
  m.regs.hl = 0x2410;           // 0x1910 is record-only, so HL is seated
  m.mem.write8(0x240e, 0x00);   // state byte at HL-2

  loc_0935(m);

  assert.equal(m.regs.hl, 0x240e, "HL -= 2 before reading the state byte");
  assert.equal(m.regs.a, 0x00, "A := state byte == 0");
  assert.equal(m.tstates, 17 + 5 + 5 + 7 + 4 + 11, "49 T");
  assert.deepEqual(m.calls, [0x1910], "only the fetch call");
  assert.equal(m.mem.read16(0x23fe), 0x0938, "call 0x1910 pushes return addr 0x0938");
  assert.equal(m.pc, 0x0938, "ARTIFACT: ret pops the internal call's return");
  assert.deepEqual(m.pcSeq, [0x1910, 0x0939, 0x093a, 0x093b, 0x093c, 0x0938], "step boundaries");
});

test("loc_0935 BAIL rc: counter (HL-1) below B -> ret; 121 T", () => {
  const m = makeMachine(0x00);      // port2 bit3 clear -> jz taken -> B stays 0x15
  m.regs.sp = 0x2400;
  m.mem.write16(0x2400, 0x1234);
  m.regs.hl = 0x2410;
  m.mem.write8(0x240e, 0x01);       // state byte nonzero
  m.mem.write8(0x240f, 0x05);       // counter < 0x15

  loc_0935(m);

  assert.equal(m.regs.b, 0x15, "port2 bit3 clear -> B = 0x15");
  assert.equal(m.regs.a, 0x05, "A := counter (HL-1)");
  assert.ok(m.regs.fC, "0x05 - 0x15 borrows -> rc taken");
  assert.equal(m.tstates, 17 + 5 + 5 + 7 + 4 + 5 + 7 + 10 + 7 + 10 + 17 + 5 + 7 + 4 + 11, "121 T");
  assert.deepEqual(m.calls, [0x1910, 0x09ca], "fetch then the counter-read call");
  assert.equal(m.mem.read8(0x240f), 0x05, "counter NOT bumped on the bail");
  assert.equal(m.pc, 0x094b, "ARTIFACT: ret pops the 0x09ca call's return");
});

test("loc_0935 FULL: bump + draw fan + redraw + clear, tail-jump 0x18fa; 742 T", () => {
  const m = makeMachine(0x08);      // port2 bit3 set -> jz not taken -> B = 0x10
  m.regs.sp = 0x2400;
  m.mem.write16(0x2400, 0x1234);
  m.regs.hl = 0x2410;
  m.mem.write8(0x240e, 0x01);       // state byte nonzero
  m.mem.write8(0x240f, 0x10);       // counter == B (0x10) -> no borrow, no bail

  loc_0935(m);

  assert.equal(m.regs.b, 0x10, "final mvi b,0x10");
  assert.equal(m.regs.a, 0xff, "mvi a,0xff before sta");
  assert.equal(m.regs.de, 0x1c60, "lxi d,0x1c60");
  assert.equal(m.mem.read8(0x240f), 0x11, "inr m bumps the counter 0x10 -> 0x11");
  assert.equal(m.mem.read8(0x2099), 0xff, "sta 0x2099 := 0xff");
  // A(after inr m) = 0x11 -> loop runs 17x, H += 2 each pass from 0x25: H = 0x25 + 34 = 0x47;
  // the 2nd 0x1910 is record-only so HL is not reloaded -> mvi m,0x00 hits 0x46ff (artifact).
  assert.equal(m.regs.hl, 0x46ff, "ARTIFACT: HL carried from the draw loop (0x1910 record-only)");
  assert.equal(m.mem.read8(0x46ff), 0x00, "mvi m,0x00 clears (carried) HL");
  assert.equal(
    m.tstates,
    177 + 17 * 25 + 140, // pre-loop(177) + 17 passes * 25T + post-loop(140) = 742
    "742 T",
  );
  assert.deepEqual(
    m.calls,
    [0x1910, 0x09ca, 0x092e, 0x1439, 0x1a8b, 0x1910, 0x18fa],
    "call/delegate sequence",
  );
  assert.equal(m.mem.read16(0x23fe), 0x0938, "first internal call (0x1910) return addr 0x0938");
  assert.equal(m.regs.sp, 0x23f4, "net stack depth after all pushes/pop psw");
  assert.equal(m.pc, 0x18fa, "tail-jump lands at 0x18fa");
});

test("loc_0935 MUTATION: sta 0x2099 mis-charged 7T not 13T is caught", () => {
  const m = makeMachine(0x08);
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2410;
  m.mem.write8(0x240e, 0x01);
  m.mem.write8(0x240f, 0x10);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0977 ? 7 : c);
  loc_0935(m);
  assert.equal(m.tstates, 736, "mutation loses 6 T (sta 13 -> 7)");
  assert.notEqual(m.tstates, 742, "golden T-state total catches the mutant");
});
