// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_2282 (ROM 0x2282, Pooyan) -- load motion params for the current
 * phase (0x8f0f): 0x8f0e <- table byte via rst 0x20 (loc_0020); 0x8f10 <- word loc_0c45(0x271c);
 * 0x8f12 <- word loc_0c45(0x2730). Then phase++, clamping 0x09 back to 0x08.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), then
 * models the callee's net register effect: loc_0020 does A = mem[HL+A] (HL += A); loc_0c45 does
 * DE = word[HL + 2A] (A *= 2, HL := HL + 2A + 1). A dropped push16 desyncs the stack and the final ret
 * pops garbage -- the SP-baseline tooth catches it.
 *
 * Path A (phase 3 -> 4, ret nz): all three loads land, ret nz to caller. T=213.
 * Path B (phase 8 -> 9 -> clamp 8): ret nz not taken, ld (hl),0x08, ret. T=227.
 * MUTATION: mis-charge `ld (0x8f10),de` 16T (not 20T) -> the 213-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_2282.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2282 } from "../loc_2282.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x2282, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Pop the return address the call site pushed, then model the callee's register effect.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) {           // loc_0020: A = mem[HL + A]; HL += A
        regs.hl = (regs.hl + regs.a) & 0xffff;
        regs.a = mem.read8(regs.hl);
      } else if (addr === 0x0c45) {    // loc_0c45: DE = word[HL + 2A]; A *= 2; HL := HL + 2A + 1
        const ea = (regs.hl + 2 * regs.a) & 0xffff;
        regs.de = mem.read16(ea);
        regs.a = (2 * regs.a) & 0xff;
        regs.hl = (ea + 1) & 0xffff;
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Seed the three ROM tables so the modelled callees resolve deterministic values for phase index `ph`.
function seedTables(m, ph) {
  m.mem.write8(0x2712 + ph, 0x42);          // rst 0x20 byte -> 0x8f0e
  m.mem.write16(0x271c + 2 * ph, 0x1234);   // loc_0c45 word -> 0x8f10
  m.mem.write16(0x2730 + 2 * ph, 0x5678);   // loc_0c45 word -> 0x8f12
}

const PC_A = [
  0x2285, 0x2288, 0x0020, 0x228c, 0x228f, 0x2292, 0x0c45, 0x2299,
  0x229c, 0x229f, 0x0c45, 0x22a6, 0x22a9, 0x22aa, 0x22ab, 0x22ad, CALLER_RET,
];

test("loc_2282 Path A: phase 3 -> 4, all params loaded, ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f0f, 0x03);
  seedTables(m, 0x03);

  loc_2282(m);

  assert.equal(m.tstates, 213, "Path A T-state total");
  assert.deepEqual(m.pcSeq, PC_A, "visits rst 0x20 / two loc_0c45 targets then ret");
  assert.equal(m.pc, CALLER_RET, "ret nz to the seated caller");
  assert.deepEqual(m.calls, [0x0020, 0x0c45, 0x0c45]);
  assert.equal(m.mem.read8(0x8f0e), 0x42, "0x8f0e <- rst 0x20 table byte");
  assert.equal(m.mem.read16(0x8f10), 0x1234, "0x8f10 <- loc_0c45(0x271c)");
  assert.equal(m.mem.read16(0x8f12), 0x5678, "0x8f12 <- loc_0c45(0x2730)");
  assert.equal(m.mem.read8(0x8f0f), 0x04, "phase advanced 3 -> 4");
  // SP TOOTH: three call sites each pushed and each callee ret popped; the final ret consumed
  // CALLER_RET. A dropped push16 would leave SP off by 2 and the ret would pop garbage.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_2282 Path B: phase 8 -> 9 -> clamp back to 8", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f0f, 0x08);
  seedTables(m, 0x08);

  loc_2282(m);

  assert.equal(m.tstates, 227, "Path B T-state total (ret nz not taken + clamp + ret)");
  assert.deepEqual(m.pcSeq, [
    0x2285, 0x2288, 0x0020, 0x228c, 0x228f, 0x2292, 0x0c45, 0x2299,
    0x229c, 0x229f, 0x0c45, 0x22a6, 0x22a9, 0x22aa, 0x22ab, 0x22ad,
    0x22ae, 0x22b0, CALLER_RET,
  ], "phase hits 9 -> ret nz falls through -> clamp -> ret");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8f0f), 0x08, "phase clamped 9 -> 8");
});

test("loc_2282 MUTATION: `ld (0x8f10),de` mis-charged 16T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x2299 ? 16 : cycles);
  seatCaller(m);
  m.mem.write8(0x8f0f, 0x03);
  seedTables(m, 0x03);

  loc_2282(m);

  assert.equal(m.tstates, 209, "mutation loses 4 T (20 -> 16)");
  assert.throws(() => assert.equal(m.tstates, 213, "golden"), /213/, "the 213-T golden must fail");
});
