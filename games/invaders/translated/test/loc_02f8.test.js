// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_02f8 (ROM 0x02f8-0x032b): stows the 0x0878 result (E,D,B) into the record
// at HL, restores the saved flag (pop psw), picks a tile pair by its bit0, publishes 0x2067, clears
// 0x2011, drives OUT 05, writes 0x2098, and tail-jumps to 0x07f9.
//
// The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`) so
// the intervening CALLs stay stack-balanced and the `pop psw` at 0x0305 reads the flag word seated
// beneath the caller frame -- exactly the byte loc_02ed/loc_0332 pushed. The final `jmp 0x07f9`
// delegate carries no push, so its modelled pop unwinds the seated CALLER_RET frame.
//
// Run: node --test games/invaders/translated/test/loc_02f8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_02f8 } from "../loc_02f8.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const io = { out: [], portOut(port, v) { this.out.push([port, v & 0xff]); } };
  return {
    regs, mem, ram, io, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Callee `ret` pops the return address the CALL pushed -> keeps the stack balanced across calls.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

// Seat the caller frame then the saved PSW word (as loc_02ed's `push psw` left it) on top.
function seat(m, pswWord) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.push16(pswWord);
  m.regs.hl = 0x2500;
  m.regs.e = 0xaa;
  m.regs.d = 0xbb;
  m.regs.b = 0xcc;
}

test("loc_02f8: saved flag bit0 clear -> jnc taken -> tiles 0x21/0x00; 236 T", () => {
  const m = makeMachine();
  seat(m, 0x0200); // A=0x02 -> rrc clears carry -> jnc 0x0312 taken

  loc_02f8(m);

  assert.equal(m.tstates, 236, "full jnc-taken path");
  assert.equal(m.mem.read8(0x2500), 0xaa, "mov m,e stored E");
  assert.equal(m.mem.read8(0x2501), 0xbb, "inx h; mov m,d stored D");
  assert.equal(m.mem.read8(0x24ff), 0xcc, "dcx h; dcx h; mov m,b stored B");
  assert.equal(m.mem.read8(0x2067), 0x21, "published tile 0x21 (jnc arm)");
  assert.equal(m.mem.read8(0x2011), 0x00, "0x2011 cleared by xra a");
  assert.equal(m.mem.read8(0x2098), 0x01, "0x2098 := (mvi b,0x00) + inr a");
  assert.deepEqual(m.io.out, [[0x05, 0x00]], "OUT 05 <- B (0x00)");
  assert.equal(m.regs.a, 0x01, "A ends at 0x2098's value");
  assert.equal(m.pc, 0x07f9, "tail-jumps to 0x07f9");
  assert.deepEqual(m.calls, [0x0878, 0x01e4, 0x0ab6, 0x09d6, 0x1a7f, 0x07f9], "call/delegate order");
  assert.equal(m.regs.sp, 0x8780, "5 balanced calls; the tail delegate pop unwinds CALLER_RET");
  // each m.step target is the instruction's SUCCESSOR (an off-by-one lags PC -> stale return on an int)
  assert.deepEqual(
    m.pcSeq.slice(0, 9),
    [0x0878, 0x02fc, 0x02fd, 0x02fe, 0x02ff, 0x0300, 0x0301, 0x0302, 0x01e4],
    "0x02fb-0x0301 step targets advance one instruction each",
  );
});

test("loc_02f8: saved flag bit0 set -> jnc not taken -> tiles 0x22/0x20; 250 T", () => {
  const m = makeMachine();
  seat(m, 0x0300); // A=0x03 -> rrc sets carry -> jnc 0x0312 not taken

  loc_02f8(m);

  assert.equal(m.tstates, 250, "full jnc-not-taken path (+14 T for the two extra mvi)");
  assert.equal(m.mem.read8(0x2067), 0x22, "published tile 0x22 (fall-through arm)");
  assert.equal(m.mem.read8(0x2098), 0x21, "0x2098 := (mvi b,0x20) + inr a");
  assert.deepEqual(m.io.out, [[0x05, 0x20]], "OUT 05 <- B (0x20)");
  assert.equal(m.regs.a, 0x21, "A ends at 0x2098's value");
  assert.equal(m.pc, 0x07f9);
  assert.deepEqual(m.calls, [0x0878, 0x01e4, 0x0ab6, 0x09d6, 0x1a7f, 0x07f9]);
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_02f8 MUTATION: `out 0x05` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  seat(m, 0x0200);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x031f ? 7 : c);
  loc_02f8(m);
  assert.equal(m.tstates, 233, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 236, "golden T-state total catches the mutant");
});
