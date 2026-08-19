// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_066d (ROM 0x066d-0x0713): the vblank NMI service routine.
//
// Self-contained mock machine (real Regs for exact flags, flat 64K RAM). The routine saves 20 bytes
// of registers, delegates, and restores them, so `call` balances the pushed return of a delegate:
// rst 0x28 (loc_0028) additionally consumes the handler-return pushed at 0x06eb, hence SP += 4 for
// 0x0028 and SP += 2 for a plain returning callee. Every exit is `ret`, so the caller's seated return
// address is the final PC and proves the 20-byte save/restore balanced.
//
// Run: node --test games/pooyan/translated/test/loc_066d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_066d } from "../loc_066d.js";

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
    call(addr) {
      this.calls.push(addr);
      // A returning callee pops its own pushed return (SP += 2). The rst 0x28 dispatch subtree also
      // consumes the handler-return pushed at 0x06eb, so its net effect is SP += 4.
      regs.sp = (regs.sp + (addr === 0x0028 ? 4 : 2)) & 0xffff;
      return undefined;
    },
  };
}

// state 4 path: (0x880a)==4 -> the jr z is taken -> four loc_0714 column draws.
function setup(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.mem.write8(0x880a, 0x04);   // main state 4 -> jr z taken
  m.mem.write8(0x8813, 0x11);   // ring feed
  m.mem.write8(0x8815, 0x22);
  m.mem.write16(0x8810, 0x1234); // fresh-frame input word, copied to 0x8813 before being overwritten
  m.mem.write8(0xa080, 0x0f);   // IN0 (inverted -> 0xf0)
  m.mem.write8(0xa0a0, 0xf0);   // IN1 (inverted -> 0x0f)
  m.mem.write8(0xa0c0, 0xaa);   // IN2 (inverted -> 0x55)
  m.mem.write8(0x883f, 0x05);   // frame counter A
  m.mem.write8(0x8a5f, 0x08);   // frame counter B
  m.mem.write8(0x8805, 0x00);   // dispatch selector (unused by the balancing stub)
}

function assertGolden(m) {
  assert.equal(m.tstates, 819, "loc_066d state-4 path T-state total");
  assert.equal(m.pc, CALLER_RET, "final PC = seated caller return (ret fired)");
  assert.equal(m.regs.sp, 0x8780, "20-byte save/restore + dispatch balanced back to entry SP");
  assert.deepEqual(m.calls, [0x0714, 0x0714, 0x0714, 0x0714, 0x59e8, 0x0e64, 0x0028],
    "four column draws, two frame updaters, then the rst-0x28 dispatch");
  // input edge-detect ring: 0x8816<-0x8815, 0x8815<-0x8813, 0x8813..14 <- old (0x8810) word
  assert.equal(m.mem.read8(0x8816), 0x22, "(0x8816) <- old (0x8815)");
  assert.equal(m.mem.read8(0x8815), 0x11, "(0x8815) <- old (0x8813)");
  assert.equal(m.mem.read16(0x8813), 0x1234, "(0x8813) <- old input word (0x8810)");
  // fresh inverted inputs land in 0x8810-0x8812
  assert.equal(m.mem.read8(0x8810), 0xf0, "(0x8810) = ~IN0");
  assert.equal(m.mem.read8(0x8811), 0x0f, "(0x8811) = ~IN1");
  assert.equal(m.mem.read8(0x8812), 0x55, "(0x8812) = ~IN2");
  assert.equal(m.mem.read8(0x883f), 0x04, "(0x883f) decremented");
  assert.equal(m.mem.read8(0x8a5f), 0x07, "(0x8a5f) decremented");
  assert.equal(m.mem.read8(0xa000), 0x04, "watchdog kicked (A held state 4 through the stub draws)");
  assert.equal(m.mem.read8(0xa180), 0x01, "NMI re-armed (LS259 b0 <- 1) in the epilogue");
}

test("loc_066d: state-4 vblank service -- saves regs, samples inputs, dispatches, restores; 819 T", () => {
  const m = makeMachine();
  setup(m);
  loc_066d(m);
  assertGolden(m);
  assert.deepEqual(m.pcSeq, [
    0x066e, 0x066f, 0x0670, 0x0671, 0x0672, 0x0673, 0x0674, 0x0675, 0x0676, 0x0677, 0x0679, 0x067b,
    0x067c, 0x067f, 0x0682, 0x0686, 0x0689, 0x068b, 0x068e, 0x0690, 0x0696, 0x0714, 0x069c, 0x069e,
    0x0714, 0x06a4, 0x06a6, 0x0714, 0x06ac, 0x06ae, 0x0714, 0x06b4, 0x06b7, 0x06ba, 0x06bd, 0x06c0,
    0x06c3, 0x06c6, 0x06c9, 0x06cc, 0x06cd, 0x06ce, 0x06cf, 0x06d2, 0x06d3, 0x06d4, 0x06d5, 0x06d8,
    0x06d9, 0x06da, 0x06dd, 0x06de, 0x06e1, 0x06e2, 0x59e8, 0x0e64, 0x06eb, 0x06ec, 0x06ef, 0x0028,
    0x06fd, 0x0700, 0x0702, 0x0704, 0x0705, 0x0706, 0x0707, 0x0708, 0x0709, 0x070a, 0x070b, 0x070c,
    0x070d, 0x070f, 0x0712, 0x0713, CALLER_RET,
  ], "step boundaries for the state-4 path");
});

test("loc_066d MUTATION: `push ix` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first && n === 0x0679) { first = false; return realStep(n, 11); } return realStep(n, c); };
  loc_066d(m);
  assert.equal(m.tstates, 815, "mutation loses 4 T (15 -> 11)");
  assert.throws(() => assertGolden(m), /T-state total/, "golden T-state assertion catches the mutant");
});

test("loc_066d MUTATION: a dropped `dec (0x8a5f)` step is caught by both value and T", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  // drop the T charge of the `dec (0x8a5f)` step (it lands at 0x06e2)
  m.step = (n, c) => realStep(n, n === 0x06e2 ? 0 : c);
  loc_066d(m);
  assert.equal(m.tstates, 808, "the dec (0x8a5f) step contributes 11 T; dropping it is caught");
});
