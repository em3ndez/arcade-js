// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_15d1 (ROM 0x15d1-0x1600): loc_159b's post-dispatch continuation. Four exits,
// all returning to the caller (the NMI epilogue 0x06fa): ret nz on (0x8806); tail `jp z 0x0bb5` (shared
// epilogue) on (0x882c)==0x0f; ret z on (0x8802)==0; else force main state 2 + sub-index 0, call 0x2527
// and 0x02b9, blank an 8-tile column at 0x855f, ret. Flat-RAM mock with real Regs.
//
// The mock's `call` POPS (models each callee's ret): 0x2527/0x02b9 pop their pushed pattern-A return;
// the tail 0x0bb5 pops the caller return. SP-baseline + positive control are the stack teeth.
//
// Run: node --test games/pooyan/translated/test/loc_15d1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_15d1 } from "../loc_15d1.js";

const CALLER_RET = 0xabcd; // stands in for 0x06fa, the NMI epilogue

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x15d1, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.ret(0); return undefined; }, // callee ret pops+returns; for the tail 0x0bb5 this lands PC on the caller
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_15d1 MAIN: gates pass -> force state 2, call 0x2527/0x02b9, blank 8-tile column, ret; 481 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00); // ret nz not taken
  m.mem.write8(0x882c, 0x00); // != 0x0f, jp z not taken
  m.mem.write8(0x8802, 0x01); // != 0, ret z not taken

  loc_15d1(m);

  assert.equal(m.tstates, 481, "MAIN path T-state total");
  assert.equal(m.pc, CALLER_RET, "ret at 0x1600 to the caller");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (both pattern-A calls balanced, ret consumed caller)");
  assert.deepEqual(m.calls, [0x2527, 0x02b9], "runs 0x2527 then 0x02b9");
  assert.equal(m.mem.read8(0x8805), 0x02, "main state forced to 2");
  assert.equal(m.mem.read8(0x880a), 0x00, "sub-index cleared");
  assert.equal(m.mem.read8(0x855f), 0x10, "first blank tile at 0x855f");
  assert.equal(m.mem.read8(0x853f), 0x10, "second one row up (0x855f + 0xffe0)");
  assert.equal(m.mem.read8(0x847f), 0x10, "eighth tile (0x855f - 7*0x20)");
  assert.equal(m.regs.b, 0x00, "djnz ran the column to completion");
});

test("loc_15d1 RET-NZ: (0x8806) set -> immediate ret nz; 28 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01); // ret nz taken

  loc_15d1(m);

  assert.equal(m.tstates, 28, "T = ld a + and a + ret nz(11)");
  assert.equal(m.pc, CALLER_RET, "ret nz to the caller");
  assert.equal(m.regs.sp, 0x8780, "balanced");
  assert.deepEqual(m.calls, [], "no work");
  assert.deepEqual(m.pcSeq, [0x15d4, 0x15d5, CALLER_RET]);
});

test("loc_15d1 EPILOGUE: (0x882c)==0x0f -> tail jp 0x0bb5; 52 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00);
  m.mem.write8(0x882c, 0x0f); // jp z taken

  loc_15d1(m);

  assert.equal(m.tstates, 52, "T through the jp z 0x0bb5");
  assert.equal(m.pc, CALLER_RET, "the 0x0bb5 shared epilogue rets to the caller");
  assert.equal(m.regs.sp, 0x8780, "tail jp: 0x0bb5's ret consumes the caller return");
  assert.deepEqual(m.calls, [0x0bb5], "tail-delegates to the shared epilogue");
  assert.deepEqual(m.pcSeq, [0x15d4, 0x15d5, 0x15d6, 0x15d9, 0x15db, 0x0bb5, CALLER_RET]);
});

test("loc_15d1 RET-Z: (0x8802)==0 -> ret z; 80 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00);
  m.mem.write8(0x882c, 0x00);
  m.mem.write8(0x8802, 0x00); // ret z taken

  loc_15d1(m);

  assert.equal(m.tstates, 80, "T through the ret z");
  assert.equal(m.pc, CALLER_RET, "ret z to the caller");
  assert.equal(m.regs.sp, 0x8780, "balanced");
  assert.deepEqual(m.calls, [], "no work past the gate");
});

test("loc_15d1 MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00); m.mem.write8(0x882c, 0x00); m.mem.write8(0x8802, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x15fe ? 7 : c); // 0x15fe = post-`add hl,de` boundary
  loc_15d1(m);
  assert.equal(m.tstates, 481 - 8 * 4, "8 loop iterations each lose 4 T");
  assert.notEqual(m.tstates, 481, "the 481-T golden catches the mischarge");
});
