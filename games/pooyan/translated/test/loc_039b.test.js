// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_039b (ROM 0x039b-0x03c1): gated on (0x8806); paints a column at
// 0x8482 (stride 0x20) with N cells of tile 0x0c, N = min((0x8a80)+1, 8), then (8-N) cells of
// tile 0x10. Early ret when the gate is 0 or when N == 8.
//
// Run: node --test games/pooyan/translated/test/loc_039b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_039b } from "../loc_039b.js";

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
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Main path: gate set, (0x8a80)=2 -> N=3 (no clamp) -> 3 cells 0x0c then 5 cells 0x10.
test("loc_039b: N=3 -> three 0x0c cells then five 0x10 cells, ret; 378 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01); // gate non-zero
  m.mem.write8(0x8a80, 0x02); // +1 -> N = 3

  loc_039b(m);

  assert.equal(m.tstates, 378, "loc_039b main-path T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.regs.hl, 0x8582, "HL walked 8 cells of stride 0x20 from 0x8482");
  // 3 cells of 0x0c: 0x8482, 0x84a2, 0x84c2
  assert.equal(m.mem.read8(0x8482), 0x0c, "0x0c cell 0");
  assert.equal(m.mem.read8(0x84c2), 0x0c, "0x0c cell 2");
  // 5 cells of 0x10: 0x84e2 .. 0x8562
  assert.equal(m.mem.read8(0x84e2), 0x10, "0x10 cell 0");
  assert.equal(m.mem.read8(0x8562), 0x10, "0x10 cell 4");
  assert.equal(m.mem.read8(0x84c2 + 0x20), 0x10, "boundary cell (0x84e2) is 0x10 not 0x0c");

  assert.equal(m.pcSeq.filter((p) => p === 0x03b4).length, 3, "0x0c fill body ran 3x");
  assert.equal(m.pcSeq.filter((p) => p === 0x03be).length, 5, "0x10 fill body ran 5x");
});

// Gate clear -> immediate ret z, nothing painted.
test("loc_039b: gate (0x8806)=0 -> ret z immediately; 28 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00);
  m.mem.write8(0x8482, 0xaa); // sentinel: must stay untouched

  loc_039b(m);

  assert.equal(m.tstates, 28, "13 + 4 + 11 (ld a / and a / ret z)");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.equal(m.mem.read8(0x8482), 0xaa, "column untouched when gated off");
  assert.deepEqual(m.pcSeq, [0x039e, 0x039f, CALLER_RET], "gate path step boundaries");
});

test("loc_039b MUTATION: zeroing the `ld (hl),0x0c` step (10T) drops 3*10 = 30 T", () => {
  const full = makeMachine();
  seatCaller(full);
  full.mem.write8(0x8806, 0x01);
  full.mem.write8(0x8a80, 0x02);
  loc_039b(full);

  const mut = makeMachine();
  seatCaller(mut);
  mut.mem.write8(0x8806, 0x01);
  mut.mem.write8(0x8a80, 0x02);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x03b4 ? 0 : c);
  loc_039b(mut);

  assert.equal(full.tstates - mut.tstates, 30, "the 3 tile-0x0c store steps contribute 30 T");
});
