// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_1694 (ROM 0x1694-0x16ad, Pooyan): compare the 0xff-terminated pattern at
// 0x16ae (bytes 0a 10 1b 1f 1e 11 1d 19 ff) against RAM at 0x89f0. First mismatch -> tail-branch to
// loc_16b7 (reusing this frame, no push16). Full match -> clear the 7-cell field at 0x89f0 via rst 0x10
// (loc_0010) then ret.
//
// The mock's `call` POPS the return address the call site pushed (models the callee's `ret`); so the
// rst 0x10 push16(0x16ad) must balance, and the tail-branch (no push16) lets loc_16b7's ret consume the
// seated CALLER_RET. A missing push16 at the rst then desyncs the final ret -- the stack tooth catches it.
// Run: node --test games/pooyan/translated/test/loc_1694.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1694 } from "../loc_1694.js";

const CALLER_RET = 0xabcd;
const PATTERN = [0x0a, 0x10, 0x1b, 0x1f, 0x1e, 0x11, 0x1d, 0x19];

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1694, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // POPS the return address a call site pushed (models the callee's `ret`); a missing push16 desyncs.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function loadPattern(m) {
  PATTERN.forEach((b, i) => m.mem.write8(0x16ae + i, b));
  m.mem.write8(0x16ae + PATTERN.length, 0xff); // 0x16b6 terminator
}

function buildMatchSeq() {
  const seq = [0x1697, 0x169a];
  for (let i = 0; i < PATTERN.length; i++) {
    seq.push(0x169b, 0x169d, 0x169f, 0x16a0, 0x16a2, 0x16a3, 0x16a4, 0x169a); // matched byte
  }
  seq.push(0x169b, 0x169d, 0x16a6);                      // 0xff terminator -> jr z
  seq.push(0x16a9, 0x16aa, 0x16ac, 0x0010, CALLER_RET);  // reload + rst 0x10 + ret
  return seq;
}

test("loc_1694 MATCH: RAM equals the full pattern -> rst 0x10 fill + ret; 560 T", () => {
  const m = makeMachine();
  seatCaller(m);
  loadPattern(m);
  PATTERN.forEach((b, i) => m.mem.write8(0x89f0 + i, b)); // RAM matches every byte

  loc_1694(m);

  assert.equal(m.tstates, 560, "MATCH T-state total (20 + 8*59 + 26 + 42)");
  assert.deepEqual(m.pcSeq, buildMatchSeq(), "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller after the rst");
  assert.deepEqual(m.calls, [0x0010], "full match invokes the rst 0x10 fill helper");
  assert.equal(m.regs.a, 0x00, "A=0 passed to the fill helper (xor a)");
  assert.equal(m.regs.b, 0x07, "B=7 field length passed to the fill helper");
  assert.equal(m.regs.hl, 0x89f0, "HL reloaded to the field base for the fill");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (rst push16 matched, then ret pops CALLER_RET)");
});

test("loc_1694 MISMATCH: first byte differs -> tail-branch to loc_16b7", () => {
  const m = makeMachine();
  seatCaller(m);
  loadPattern(m);
  m.mem.write8(0x89f0, 0x99); // != pattern[0] (0x0a) -> jr nz on the first compare

  loc_1694(m);

  assert.equal(m.tstates, 60, "MISMATCH T-state total (20 + 7+7+7+7+12)");
  assert.deepEqual(m.pcSeq, [0x1697, 0x169a, 0x169b, 0x169d, 0x169f, 0x16a0, 0x16b7],
    "compare byte 0, cp (hl) mismatch -> jr nz to loc_16b7");
  assert.equal(m.pc, 0x16b7, "tail-branched to loc_16b7");
  assert.deepEqual(m.calls, [0x16b7], "loc_16b7 tail-invoked");
  // Tail branch pushes nothing; loc_16b7's ret consumes the seated CALLER_RET -> back to pre-seat baseline.
  assert.equal(m.regs.sp, 0x8780, "tail branch: stack unwinds to the pre-seat baseline");
});

test("loc_1694 MID-MISMATCH: pattern matches 3 bytes then differs -> tail-branch to loc_16b7", () => {
  const m = makeMachine();
  seatCaller(m);
  loadPattern(m);
  // match bytes 0..2, differ at byte 3
  m.mem.write8(0x89f0, PATTERN[0]);
  m.mem.write8(0x89f1, PATTERN[1]);
  m.mem.write8(0x89f2, PATTERN[2]);
  m.mem.write8(0x89f3, 0x00); // != pattern[3] (0x1f)

  loc_1694(m);

  const seq = [0x1697, 0x169a];
  for (let i = 0; i < 3; i++) seq.push(0x169b, 0x169d, 0x169f, 0x16a0, 0x16a2, 0x16a3, 0x16a4, 0x169a);
  seq.push(0x169b, 0x169d, 0x169f, 0x16a0, 0x16b7); // byte 3: cp (hl) mismatch -> jr nz
  assert.deepEqual(m.pcSeq, seq, "3 matched bytes then jr nz to loc_16b7");
  assert.equal(m.tstates, 20 + 3 * 59 + (7 + 7 + 7 + 7 + 12), "MID-MISMATCH T-state total");
  assert.deepEqual(m.calls, [0x16b7]);
  assert.equal(m.regs.sp, 0x8780, "tail branch unwinds to baseline");
});

test("loc_1694 MUTATION: rst 0x10 mis-charged 17T (CALL cost, not 11T RST) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0010 ? 17 : cycles);
  seatCaller(m);
  loadPattern(m);
  PATTERN.forEach((b, i) => m.mem.write8(0x89f0 + i, b));

  loc_1694(m);

  assert.equal(m.tstates, 566, "mutation adds 6 T (11 -> 17)");
  assert.throws(
    () => assert.equal(m.tstates, 560, "MATCH T-state total"),
    /560/,
    "the 560-T golden must fail on the mutant",
  );
});
