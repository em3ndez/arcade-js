// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4df8 (ROM 0x4df8-0x4ee9, The Pit): stage a multi-part
// labelled tilemap display, then run a frame-paced animation loop that decrements
// the step counter at 0x804b and finally either TAIL-jumps to 0x4cca (counter hit
// zero) or returns via `ret nc` once the frame counter 0x8010 reaches 0x3c.
//
// There is no built Pit Machine yet, so the routine is driven against a minimal
// mock of the surface it touches: a real Regs (so cp/or flags and the fZ/fNZ/fNC
// tests are genuine), a real Pit AddressSpace (so the work/colour/video-RAM writes
// hit the true memory map), a `step` that accumulates T-states + tracks the PC, a
// `ret` that charges cycles and marks the routine returned, and a `call` that
// RECORDS its target and runs an optional per-callee HOOK. The hook is what makes
// the loop terminate deterministically: the real 0x4eea (per-frame handler) and
// 0x4bff (frame-wait) mutate 0x804b / 0x8010, and here a hook on 0x4eea stands in
// for that side effect so a single loop pass reaches a chosen exit. Callees are
// otherwise STUBBED, so the measured T-state total is loc_4df8's OWN charge.
//
// Paths pinned against the disassembly (T-state totals hand-derived from the opcode
// timings -- call 17, jr 12/7, jp 10, ret cc 11/5, ld ix,nn 14, ld (nn),a 13, ...):
//   * TAIL exit (selector 0x8048 = else): the 0x4eea hook zeroes 0x804b, so
//     `jr nz` is NOT taken, the finish block runs (sounds 0xd0 + 0x05, wait, clear
//     0x8048) and `jp 0x4cca` fires. 875 T; returns loc_4cca's result; no ret.
//   * RET exit (selector = else): the 0x4eea hook sets 0x8010 = 0x3c and leaves
//     0x804b = 3, so `jr nz` IS taken, loc_4ee2 sees (0x8010) >= 0x3c and `ret nc`
//     returns. 816 T; the finish block never runs (0x8048 keeps its seed).
//   * variant coverage: selector 0x03 and 0x02 pick the other IX/HL/DE/B bundles
//     and different taken-branch cycle costs (833 T / 885 T on the tail exit).
//
// MUTATION: the `ld ix,0x8039` at 0x4e88 (DD 21, 14 T) mis-charged as 10 T -- the
// classic "forgot the DD prefix adds 4 T" copy error, same value, wrong cycle
// budget -- must be CAUGHT by the tail-exit T-state total (875 -> 871).
//
// Run: node --test games/thepit/translated/test/loc_4df8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4df8 } from "../loc_4df8.js";

const RET = 0x1234; // sentinel return address the `ret` path leaves on the stack
const SENTINEL = "RET_FROM_4cca"; // stands in for loc_4cca's return-through

// Callees loc_4df8 issues, in order, up to and including the 0x4cca tail-jump.
// (The two variant branches contain no calls, so this order is selector-independent.)
const CALLS_TAIL = [
  0x4b55, 0x4b44, 0x3cc1, 0x3e1d, 0x3e1d, 0x3e1d, 0x3dae, 0x3dc9, // 0x4df8..0x4e28 setup
  0x3dea, 0x3e1d, 0x3dae, 0x3dc9, 0x3dea, 0x3e1d,                 // 0x4e49..0x4e75 second block
  0x4bff, 0x4bff, 0x4eea,                                         // loop body
  0x4b46, 0x4c63, 0x4bff, 0x4cca,                                 // finish block + tail-jump
];
// The RET path stops at the loop's 0x4eea and never reaches the finish block.
const CALLS_RET = CALLS_TAIL.slice(0, 17);

function makeMachine({ sel = 0x00, hooks = {} } = {}) {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  mem.write8(0x8048, sel & 0xff); // the variant selector both branches read
  const regs = new Regs();
  regs.sp = 0x8780; // stack inside work RAM (0x8000-0x87FF)

  const m = {
    regs,
    mem,
    io,
    cycles: 0,
    pc: 0x4df8,
    calls: [],
    returned: false,
    hooks,
    step(addr, cycles) {
      this.pc = addr;
      this.cycles += cycles;
    },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      if (this.hooks[addr]) this.hooks[addr](this); // stand in for the callee's side effects
      return SENTINEL; // used only by the `return m.call(0x4cca)` tail-jump
    },
  };
  m.push16(RET);
  return m;
}

// -- TAIL exit: selector = else (0x05) ---------------------------------------
// The 0x4eea hook zeroes the step counter, so `jr nz` is NOT taken and control
// falls into the finish block and out via `jp 0x4cca`.
function checkTailElse(m, ret) {
  assert.equal(m.cycles, 875, "tail exit (selector else) T-state total"); // FIRST: cycle teeth
  assert.deepEqual(m.calls, CALLS_TAIL, "call order incl. the 0x4cca tail-jump");
  assert.equal(ret, SENTINEL, "loc_4df8 returns loc_4cca's result through the tail-jump");
  assert.equal(m.returned, false, "no m.ret executed on the tail path (single unwind)");
  assert.equal(m.calls[m.calls.length - 1], 0x4cca, "final transfer is the 0x4cca tail-jump");
  // display coords + fill counts (each written twice; assert the FINAL value)
  assert.equal(m.mem.read8(0x8058), 0x16, "(0x8058) = 0x16 (0x0f then 0x16)");
  assert.equal(m.mem.read8(0x8059), 0x03, "(0x8059) = 0x03 (0x08 then 0x03)");
  assert.equal(m.mem.read8(0x8055), 0x1a, "(0x8055) = 0x1a (0x12 then 0x1a)");
  // step counter zeroed by the hook -> the finish block ran and cleared 0x8048
  assert.equal(m.mem.read8(0x804b), 0x00, "step counter zeroed (0x4eea hook)");
  assert.equal(m.mem.read8(0x8048), 0x00, "selector cleared at 0x4edc (was 0x05)");
  // the else bundle: B=6, IX=0x8039, HL=0x939f (video), DE=0x8b9f (colour)
  assert.equal(m.regs.b, 0x06, "loop count B = 0x06 (else bundle)");
  assert.equal(m.regs.ix, 0x8039, "IX = 0x8039 (else bundle, final)");
  assert.equal(m.mem.read8(0x8b9f), 0x06, "(DE)=0x8b9f = B = 0x06 (ld (de),a)");
  assert.equal(m.mem.read8(0x939f), 0x24, "(HL)=0x939f = 0x24 (0x0a then 0x24)");
}

test("loc_4df8 TAIL exit (selector else): full setup, loop, jp 0x4cca, 875 T", () => {
  const m = makeMachine({ sel: 0x05, hooks: { 0x4eea: (mm) => mm.mem.write8(0x804b, 0x00) } });
  const ret = loc_4df8(m);
  checkTailElse(m, ret);
  console.log("  loc_4df8 tail(else): 875 T, B=6 IX=8039, (8b9f)=06 (939f)=24, jp -> 0x4cca");
});

// -- RET exit: selector = else, counter stays non-zero, frame counter hits 0x3c -
test("loc_4df8 RET exit (selector else): ret nc once (0x8010) >= 0x3c, 816 T", () => {
  // Hook leaves 0x804b = 3 (jr nz taken) and forces the frame counter to 0x3c.
  const m = makeMachine({ sel: 0x05, hooks: { 0x4eea: (mm) => mm.mem.write8(0x8010, 0x3c) } });
  const ret = loc_4df8(m);

  assert.equal(m.cycles, 816, "RET exit (selector else) T-state total");
  assert.equal(m.returned, true, "returned via ret nc");
  assert.equal(ret, undefined, "the ret path returns nothing");
  assert.deepEqual(m.calls, CALLS_RET, "calls stop at the loop's 0x4eea; finish block never ran");
  assert.equal(m.mem.read8(0x804b), 0x03, "step counter still 0x03 (0x4eea hook left it)");
  assert.equal(m.mem.read8(0x8010), 0x3c, "frame counter driven to 0x3c by the hook");
  assert.equal(m.mem.read8(0x8048), 0x05, "selector UNTOUCHED -- proves 0x4edc never ran");
  console.log("  loc_4df8 ret(else): 816 T, returned, (804b)=03 (8010)=3c, 0x8048 intact");
});

// -- variant coverage: the selector picks the IX/HL/DE/B bundle + branch cycles --
const VARIANTS = {
  0x03: { cycles: 833, b: 0x07, ix: 0x8043, de: 0x895f, hl: 0x915f },
  0x02: { cycles: 885, b: 0x04, ix: 0x803e, de: 0x8a7f, hl: 0x927f },
};

for (const [selKey, exp] of Object.entries(VARIANTS)) {
  const sel = Number(selKey);
  test(`loc_4df8 selector 0x${sel.toString(16)}: bundle B/IX/HL/DE + ${exp.cycles} T (tail)`, () => {
    const m = makeMachine({ sel, hooks: { 0x4eea: (mm) => mm.mem.write8(0x804b, 0x00) } });
    const ret = loc_4df8(m);
    assert.equal(m.cycles, exp.cycles, `selector 0x${sel.toString(16)} tail T-state total`);
    assert.equal(ret, SENTINEL, "tail-jumped to 0x4cca");
    assert.equal(m.calls[m.calls.length - 1], 0x4cca, "final transfer is the tail-jump");
    assert.equal(m.regs.b, exp.b, "loop count B for this bundle");
    assert.equal(m.regs.ix, exp.ix, "IX for this bundle (final)");
    assert.equal(m.mem.read8(exp.de), exp.b, "(DE) = B (ld (de),a into this bundle's colour cursor)");
    assert.equal(m.mem.read8(exp.hl), 0x24, "(HL) = 0x24 into this bundle's video cursor");
  });
}

// -- MUTATION: the tail-exit T-state total must have teeth --------------------
// Mis-charge the else-bundle `ld ix,0x8039` (0x4e88, DD 21, 14 T) as 10 T by
// intercepting its step. Same IX value, 4 T short. The tail-exit golden's FIRST
// assertion (the 875 T total) must catch it.
test("loc_4df8 MUTATION: `ld ix,0x8039` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine({ sel: 0x05, hooks: { 0x4eea: (mm) => mm.mem.write8(0x804b, 0x00) } });
  const realStep = m.step.bind(m);
  m.step = (addr, cycles) => realStep(addr, addr === 0x4e8c ? 10 : cycles); // the else ld ix,nn
  const ret = loc_4df8(m);

  assert.equal(m.cycles, 871, "mutation loses exactly 4 T (14 -> 10)");
  assert.throws(
    () => checkTailElse(m, ret),
    /T-state total/,
    "the tail-exit golden must fail on the mutant -- else it has no teeth",
  );
});
