// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_05ee (ROM 0x05ee-0x0629): render a (0x8802)-derived counter as two HUD
// nibbles, then a ROM-checksum tripwire. Self-contained flat-RAM mock (real Regs). loc_05ee CALLs
// 0x05b2 and 0x062a, both plain-ret routines -> pattern-A stub: the stub runs m.ret() to pop the
// pushed return, so the stack stays balanced (a record-only stub would leak 2 bytes per call and the
// final ret would pop the wrong address). The stub does NOT touch A, so after the (stubbed) 0x062a
// call, A = the clamped (0x8802) byte -- which is what loc_05ee's own nibble logic then consumes.
// Path A: (0x8802)=0x12 (low BCD nibble 2) -> full checksum loop (all-zero bytes) -> mismatch vs
// 0x8c -> tamper bump at 0x8a3c; full pcSeq stepcheck. Path B: checksum == 0x8c -> ret z, no bump.
// Path C: (0x8802)=0x80 -> clamp to 0x63 -> low nibble 3 != 2 -> ret nz (no loop).
// TEETH: mis-charge `inc (hl)` (0x0629, 11 T) as 7 T; the 1392-T Path A golden must catch it.
//
// Run: node --test games/pooyan/translated/test/loc_05ee.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_05ee } from "../loc_05ee.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x05ee, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Both callees (0x05b2, 0x062a) are plain-ret routines: pattern-A stub pops each pushed return.
function installPatternAStub(m) {
  m.call = (addr) => { m.calls.push(addr); m.ret(); return undefined; };
}

// Path A pcSeq -- built independently of the loop count (31 rolling-checksum iterations).
const PC_A = [
  0x05f0, 0x05b2, 0x05f3, 0x05f6, 0x05f8, 0x05fc, 0x062a, 0x05ff,
  0x0600, 0x0602, 0x0604, 0x0605, 0x0606, 0x0607, 0x0608, 0x060b,
  0x060c, 0x060e, 0x0611, 0x0613, 0x0614, 0x0617, 0x061a,
];
for (let i = 0; i < 31; i++) {
  PC_A.push(0x061b, 0x061c, 0x061d, 0x061e, 0x061f);
  PC_A.push(i < 30 ? 0x061a : 0x0621); // jr nz taken 30x, not-taken on the last
}
PC_A.push(0x0623, 0x0624, 0x0627, 0x0628, 0x0629, CALLER_RET);

function assertPathAGolden(m) {
  assert.equal(m.tstates, 1392, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "Path A ends via `ret` (popped caller address)");
  assert.deepEqual(m.calls, [0x05b2, 0x062a], "renderer + BCD helper called in order");
  assert.equal(m.mem.read8(0x86bf), 0x01, "high nibble (0x12>>4 = 1) written");
  assert.equal(m.mem.read8(0x869f), 0x02, "low nibble (0x12&0xf = 2) written");
  assert.equal(m.mem.read8(0x8a3c), 0x01, "checksum mismatch bumped the tamper cell");
  assert.equal(m.regs.a, 0x00, "A = rolling checksum of all-zero bytes = 0");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (2 pattern-A calls + final ret)");
}

test("loc_05ee Path A: (0x8802)=0x12 -> nibble writes + checksum mismatch -> tamper bump", () => {
  const m = makeMachine();
  seatCaller(m);
  installPatternAStub(m);
  m.mem.write8(0x8802, 0x12);
  // checksum source ROM 0x64c8..0x64aa all zero (default) -> final A = 0 != 0x8c
  loc_05ee(m);
  assertPathAGolden(m);
  assert.deepEqual(m.pcSeq, PC_A, "Path A step boundaries match the ROM bytes");
});

test("loc_05ee Path B: checksum == 0x8c -> ret z, no tamper bump", () => {
  const m = makeMachine();
  seatCaller(m);
  installPatternAStub(m);
  m.mem.write8(0x8802, 0x12);
  m.mem.write8(0x64c8, 0x8c); // first byte 0x8c, rest 0 -> rolling sum stays 0x8c

  loc_05ee(m);

  assert.equal(m.tstates, 1356, "Path B T-state total (ret z taken, no tamper tail)");
  assert.equal(m.pc, CALLER_RET, "Path B ends via `ret z`");
  assert.equal(m.regs.a, 0x8c, "A = checksum = 0x8c");
  assert.equal(m.mem.read8(0x8a3c), 0x00, "checksum matched -> no tamper bump");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_05ee Path C: (0x8802)=0x80 -> clamp to 0x63, low nibble != 2 -> ret nz (no loop)", () => {
  const m = makeMachine();
  seatCaller(m);
  installPatternAStub(m);
  m.mem.write8(0x8802, 0x80); // >= 0x63 -> clamped

  loc_05ee(m);

  assert.equal(m.tstates, 184, "Path C T-state total");
  assert.equal(m.pc, CALLER_RET, "Path C ends via `ret nz`");
  assert.equal(m.mem.read8(0x86bf), 0x06, "high nibble (0x63>>4 = 6) written");
  assert.equal(m.mem.read8(0x869f), 0x03, "low nibble (0x63&0xf = 3) written");
  assert.deepEqual(m.calls, [0x05b2, 0x062a], "both callees still run before the ret nz");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(
    m.pcSeq,
    [
      0x05f0, 0x05b2, 0x05f3, 0x05f6, 0x05f8, 0x05fa, 0x05fc, 0x062a, 0x05ff,
      0x0600, 0x0602, 0x0604, 0x0605, 0x0606, 0x0607, 0x0608, 0x060b,
      0x060c, 0x060e, 0x0611, 0x0613, CALLER_RET,
    ],
    "Path C boundaries (jr c not taken -> clamp; ret nz)",
  );
});

test("loc_05ee MUTATION: `inc (hl)` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  installPatternAStub(m);
  m.mem.write8(0x8802, 0x12);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0629 ? 7 : cycles);

  loc_05ee(m);

  assert.equal(m.tstates, 1388, "mutation loses 4 T (11 -> 7)");
  assert.throws(() => assertPathAGolden(m), /Path A T-state total/,
    "the 1392-T golden must fail on the mutant");
});
