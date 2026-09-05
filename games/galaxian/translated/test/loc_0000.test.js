// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0000 (Galaxian reset vector, ROM 0x0000-0x0006):
//   0000  af        xor a          ; A=0
//   0001  32 01 70  ld (0x7001),a  ; clear irq_enable (vblank NMI off during boot)
//   0004  c3 55 1a  jp 0x1a55      ; tail-jump into cold-boot init
// Contract: 3 instr, 27 T (4+13+10), A=0, the 0x7001 latch write clears irq_enable, TAIL-jump into
// 0x1a55 (via m.call, result propagates).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0000 } from "../loc_0000.js";

function mk(stubs = {}) {
  const routines = new Map();
  for (const [a, k] of Object.entries(stubs)) {
    routines.set(Number(a), k === "tail" ? () => "TAIL" : (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; });
  }
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

function checkSpec(res) {
  assert.equal(res.cycles, 27, "T-state total (4+13+10)");
  assert.deepEqual(res.calls, [0x1a55], "tail-jumps into cold-boot init 0x1a55");
  assert.equal(res.ret, "TAIL", "the tail-jump's callee result propagates out");
  assert.equal(res.a, 0, "xor a -> A=0");
  assert.equal(res.irq, 0, "ld (0x7001),a wrote A(=0) -> irq_enable cleared");
}

function run(fn, stubs = { 0x1a55: "tail" }, preIrq = 1) {
  const m = mk(stubs);
  m.io.irqEnable = preIrq; // pre-set so the latch write's effect is observable
  const ret = fn(m);
  return { cycles: m.cycles, calls: m.calls, ret, a: m.regs.a, irq: m.io.irqEnable };
}

test("loc_0000: reset vector clears A + irq_enable, tail-jumps 0x1a55; 27 T", () => {
  checkSpec(run(loc_0000));
});

// MUTATION-PATCH  file: games/galaxian/translated/loc_0000.js
//   find: m.step(0x1a55, 10);\n  return m.call(0x1a55);
//   repl: m.step(0x1a65, 10);\n  return m.call(0x1a65);
//   expect: FAIL  (jumps to 0x1a65 -- caught by calls == [0x1a55])
//   verified-anchor: count == 1  (the sole "return m.call(0x1a55)" in loc_0000.js)
test("loc_0000: the contract catches a wrong tail-jump target", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.xor(regs.a);
    m.step(0x0001, 4);
    mem.write8(0x7001, regs.a, 10);
    m.step(0x0004, 13);
    m.step(0x1a65, 10); // MUTANT: wrong target
    return m.call(0x1a65);
  };
  assert.throws(() => checkSpec(run(mutant, { 0x1a65: "tail" })));
});
