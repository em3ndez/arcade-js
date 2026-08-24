// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for translated loc_7f0e (ROM 0x7f0e, Pooyan) -- 7e94 write-anim dispatch entry 1.
// Decrement the 16-bit counter (0x8e2b); on zero jp 0x7fa8 (tail). Else at loc_7f20 the byte at
// *(0x8e21) selects: bit 3 set -> loc_7f42 (index counts DOWN); bit 2 clear -> tail jr 0x7f5d; else
// count the index UP at 0x7f2b. Both index paths run a 0x0c reload at 0x8e24 (`ret nz` while it
// counts), then at loc_7f57 store the index byte through *(0x8e27) and fall into loc_7f5d (tail).
//
// Flat-RAM mock (real Regs for exact flags). Delegated tails/rets consume one stack slot: the mock's
// `call` pops (SP += 2) so a stray push16 would leave SP off the caller base and be caught.
//
// Run: node --test games/pooyan/translated/test/loc_7f0e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7f0e } from "../loc_7f0e.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x7f0e, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("Path A: counter (0x8e2b) reaches 0 -> jp 0x7fa8 tail; 78 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8e2b, 0x0001); // dec -> 0x0000: both H and L zero

  loc_7f0e(m);

  assert.equal(m.tstates, 78, "Path A total T");
  assert.equal(m.pc, 0x7fa8, "tail-delegates to 0x7fa8");
  assert.equal(m.regs.sp, 0x8780, "tail consumed the caller slot, SP clean");
  assert.deepEqual(m.calls, [0x7fa8], "single tail delegation");
  assert.equal(m.mem.read16(0x8e2b), 0x0000, "counter decremented to 0");
  assert.deepEqual(m.pcSeq,
    [0x7f11, 0x7f12, 0x7f15, 0x7f16, 0x7f17, 0x7f19, 0x7f1a, 0x7f1b, 0x7f1d, 0x7fa8],
    "Path A step boundaries");
});

test("Path B: bit 3 clear, bit 2 clear -> jr z 0x7f5d tail; 117 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8e2b, 0x0300); // dec -> 0x02ff: H != 0 -> jr nz taken to loc_7f20
  m.mem.write16(0x8e21, 0x9000); // phase pointer
  m.mem.write8(0x9000, 0x00);    // bit3 clear, bit2 clear

  loc_7f0e(m);

  assert.equal(m.tstates, 117, "Path B total T");
  assert.equal(m.pc, 0x7f5d, "tail-delegates to 0x7f5d");
  assert.equal(m.regs.sp, 0x8780, "tail consumed the caller slot, SP clean");
  assert.deepEqual(m.calls, [0x7f5d], "single tail delegation");
  assert.equal(m.mem.read16(0x8e2b), 0x02ff, "counter decremented, non-zero");
  assert.deepEqual(m.pcSeq,
    [0x7f11, 0x7f12, 0x7f15, 0x7f16, 0x7f17, 0x7f20, 0x7f23, 0x7f25, 0x7f27, 0x7f29, 0x7f5d],
    "Path B step boundaries");
});

test("Path C: bit 3 set, loc_7f42 reload still counting -> ret nz; 130 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8e2b, 0x0300);
  m.mem.write16(0x8e21, 0x9000);
  m.mem.write8(0x9000, 0x08);  // bit3 set -> loc_7f42
  m.mem.write8(0x8e24, 0x02);  // reload: dec -> 0x01 (non-zero) -> ret nz

  loc_7f0e(m);

  assert.equal(m.tstates, 130, "Path C total T");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.regs.sp, 0x8780, "ret nz popped the caller");
  assert.deepEqual(m.calls, [], "no delegation on the early-out");
  assert.equal(m.mem.read8(0x8e24), 0x01, "reload decremented, still counting");
  assert.deepEqual(m.pcSeq,
    [0x7f11, 0x7f12, 0x7f15, 0x7f16, 0x7f17, 0x7f20, 0x7f23, 0x7f25, 0x7f42, 0x7f45, 0x7f46, CALLER_RET],
    "Path C step boundaries");
});

test("Path D: bit 3 set, loc_7f42 index DOWN (no wrap) -> loc_7f57 -> fall into 0x7f5d; 225 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8e2b, 0x0300);
  m.mem.write16(0x8e21, 0x9000);
  m.mem.write8(0x9000, 0x08);   // bit3 set -> loc_7f42
  m.mem.write8(0x8e24, 0x01);   // reload: dec -> 0x00 -> falls through ret nz
  m.mem.write8(0x8e23, 0x11);   // index: dec -> 0x10; cp 0x10 -> NC -> no wrap
  m.mem.write16(0x8e27, 0x9100); // store target for the index byte

  loc_7f0e(m);

  assert.equal(m.tstates, 225, "Path D total T");
  assert.equal(m.pc, 0x7f5d, "falls through into loc_7f5d (tail)");
  assert.equal(m.regs.sp, 0x8780, "tail consumed the caller slot, SP clean");
  assert.deepEqual(m.calls, [0x7f5d], "fall-through tail delegation");
  assert.equal(m.mem.read8(0x8e24), 0x0c, "reload reset to 0x0c");
  assert.equal(m.mem.read8(0x8e23), 0x10, "index counted down to 0x10 (no wrap)");
  assert.equal(m.mem.read8(0x9100), 0x10, "index byte stored via *(0x8e27)");
  assert.deepEqual(m.pcSeq,
    [0x7f11, 0x7f12, 0x7f15, 0x7f16, 0x7f17, 0x7f20, 0x7f23, 0x7f25,
     0x7f42, 0x7f45, 0x7f46, 0x7f47, 0x7f49, 0x7f4c, 0x7f4f, 0x7f50, 0x7f51, 0x7f53,
     0x7f57, 0x7f5b, 0x7f5c, 0x7f5d],
    "Path D step boundaries");
});

test("Path E: bit 3 clear, bit 2 set, index UP with wrap 0x2d->0x10 -> loc_7f57 -> fall 0x7f5d; 256 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8e2b, 0x0300);
  m.mem.write16(0x8e21, 0x9000);
  m.mem.write8(0x9000, 0x04);   // bit3 clear, bit2 set -> loc_7f20 count-up path
  m.mem.write8(0x8e24, 0x01);   // reload: dec -> 0x00 -> falls through ret nz
  m.mem.write8(0x8e23, 0x2c);   // index: inc -> 0x2d; cp 0x2d -> NC -> wrap to 0x10
  m.mem.write16(0x8e27, 0x9100);

  loc_7f0e(m);

  assert.equal(m.tstates, 256, "Path E total T");
  assert.equal(m.pc, 0x7f5d, "falls through into loc_7f5d (tail)");
  assert.equal(m.regs.sp, 0x8780, "tail consumed the caller slot, SP clean");
  assert.deepEqual(m.calls, [0x7f5d], "fall-through tail delegation");
  assert.equal(m.mem.read8(0x8e24), 0x0c, "reload reset to 0x0c");
  assert.equal(m.mem.read8(0x8e23), 0x10, "index wrapped 0x2d -> 0x10");
  assert.equal(m.mem.read8(0x9100), 0x10, "wrapped index byte stored via *(0x8e27)");
  assert.deepEqual(m.pcSeq,
    [0x7f11, 0x7f12, 0x7f15, 0x7f16, 0x7f17, 0x7f20, 0x7f23, 0x7f25, 0x7f27, 0x7f29,
     0x7f2b, 0x7f2e, 0x7f2f, 0x7f30, 0x7f32, 0x7f35, 0x7f38, 0x7f39, 0x7f3a, 0x7f3c,
     0x7f3e, 0x7f40, 0x7f57, 0x7f5b, 0x7f5c, 0x7f5d],
    "Path E step boundaries");
});

test("MUTATION: `ld bc,(0x8e27)` mis-charged 16T (not 20T) is caught by golden total", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8e2b, 0x0300);
  m.mem.write16(0x8e21, 0x9000);
  m.mem.write8(0x9000, 0x08);
  m.mem.write8(0x8e24, 0x01);
  m.mem.write8(0x8e23, 0x11);
  m.mem.write16(0x8e27, 0x9100);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7f5b ? 16 : c); // ld bc,(nn) landing addr

  loc_7f0e(m);

  assert.equal(m.tstates, 221, "mutation loses 4 T (20 -> 16)");
  assert.notEqual(m.tstates, 225, "golden T-state total catches the mutant");
});
