// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4c67 (ROM 0x4C67-0x4CBE): the PRODUCER of a command
// ring. It writes 0x06|0x80 = 0x86 into ring slot 0x8020[head] and advances the
// head pointer at 0x801e (mod 8), preserving DE and HL across the call.
//
// Asserts the fixed T-state total (162), the enqueued byte (0x86) landing at the
// OLD-head slot, the head pointer advancing (idx+1)&7 -- exercised at both a
// mid-ring index and the wrap point 7->0 -- DE/HL preservation, A residue, and
// that the ret popped the caller's address. Ends with a MUTATION (the `or 0x80`
// slot-full marker dropped) proven caught by the enqueued-byte tooth.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4c67 } from "../loc_4c67.js";

const RET = 0x1234; // sentinel return address pushed before the call
const HEAD = 0x801e; // ring head pointer (this producer owns it)
const RING = 0x8020; // ring base, 8 slots 0x8020..0x8027
const CMD = 0x86; // 0x06 | 0x80 -- command id with the slot-full marker
const T_TOTAL = 162; // 7+12 head + 7+11+11+4+13+4+4+7+13+10+4+7+11+7+10+10 tail + 10 ret

// Minimal machine: real Regs + real Pit AddressSpace + the step/ret/push16/pop16
// seam loc_4c67 drives (no m.call in this routine).
function makeMachine(headIndex, de = 0xbeef, hl = 0xcafe) {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)
  regs.de = de; // arbitrary -- must survive the call
  regs.hl = hl; // arbitrary -- must survive the call

  const m = {
    regs,
    mem,
    tstates: 0,
    pc: 0x4c67,
    returned: false,
    step(addr, cycles) {
      this.pc = addr;
      this.tstates += cycles;
    },
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
    ret(cycles = 10) {
      this.pc = this.pop16();
      this.tstates += cycles;
      this.returned = true;
    },
    call(addr) {
      throw new Error(`unexpected m.call(0x${addr.toString(16).padStart(4, "0")})`);
    },
  };

  mem.write8(HEAD, headIndex); // seed the head pointer
  // Fill all 8 slots with a sentinel so "0x86 written HERE" is observable and an
  // enqueue to the wrong slot is visible.
  for (let k = 0; k < 8; k++) mem.write8(RING + k, 0x11);

  m.push16(RET); // the return address loc_4c67's `ret` must pop
  return m;
}

// The canonical enqueue facts, shared by the real routine and the mutant so the
// mutation is measured against exactly the assertions the routine must pass.
function assertEnqueue(fn, headIndex) {
  const m = makeMachine(headIndex);
  fn(m);
  assert.equal(m.mem.read8(RING + headIndex), CMD, `slot ${headIndex} holds 0x86`);
  assert.equal(m.tstates, T_TOTAL, `enqueue costs ${T_TOTAL} T`);
}

test("enqueues 0x86 at the head slot and advances the head (mid-ring)", () => {
  const m = makeMachine(3);
  loc_4c67(m);

  // the command byte landed in the OLD head slot (3), and only that slot changed
  assert.equal(m.mem.read8(RING + 3), CMD, "slot 3 got 0x86");
  for (let k = 0; k < 8; k++) {
    if (k === 3) continue;
    assert.equal(m.mem.read8(RING + k), 0x11, `slot ${k} untouched`);
  }
  // head advanced 3 -> 4
  assert.equal(m.mem.read8(HEAD), 4, "head advanced to 4");

  // DE / HL preserved across the push/pop, A holds the command byte
  assert.equal(m.regs.de, 0xbeef, "DE preserved");
  assert.equal(m.regs.hl, 0xcafe, "HL preserved");
  assert.equal(m.regs.a, CMD, "A left holding 0x86");

  // control flow: the ret popped the caller's address
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);
  assert.equal(m.tstates, T_TOTAL, `costs ${T_TOTAL} T`);
});

test("head pointer wraps mod 8 (7 -> 0), enqueuing at slot 7", () => {
  const m = makeMachine(7);
  loc_4c67(m);
  assert.equal(m.mem.read8(RING + 7), CMD, "slot 7 got 0x86");
  assert.equal(m.mem.read8(HEAD), 0, "head wrapped 7 -> 0 (and 0x07)");
});

// ---- MUTATION: the `or 0x80` slot-full marker dropped ------------------------
// Faithful copy of loc_4c67 with `or 0x80` removed: the slot is filled with the
// bare command id 0x06 instead of 0x86, so the NMI consumer's `bit 7,a` would
// read the slot as empty. Same T-state total (the step stays), so the
// enqueued-byte tooth is what must reject it.
function loc_4c67_mut(m) {
  const { regs, mem } = m;
  regs.a = 0x06;
  m.step(0x4c69, 7);
  m.step(0x4ca5, 12);
  // BUG: `or 0x80` (regs.or(0x80)) dropped -> bit 7 never set, A stays 0x06.
  m.step(0x4ca7, 7);
  m.push16(regs.de);
  m.step(0x4ca8, 11);
  m.push16(regs.hl);
  m.step(0x4ca9, 11);
  regs.d = regs.a;
  m.step(0x4caa, 4);
  regs.a = mem.read8(0x801e);
  m.step(0x4cad, 13);
  regs.e = regs.a;
  m.step(0x4cae, 4);
  regs.a = regs.inc8(regs.a);
  m.step(0x4caf, 4);
  regs.and(0x07);
  m.step(0x4cb1, 7);
  mem.write8(0x801e, regs.a);
  m.step(0x4cb4, 13);
  regs.hl = 0x8020;
  m.step(0x4cb7, 10);
  regs.a = regs.d;
  m.step(0x4cb8, 4);
  regs.d = 0x00;
  m.step(0x4cba, 7);
  regs.addHl(regs.de);
  m.step(0x4cbb, 11);
  mem.write8(regs.hl, regs.a);
  m.step(0x4cbc, 7);
  regs.hl = m.pop16();
  m.step(0x4cbd, 10);
  regs.de = m.pop16();
  m.step(0x4cbe, 10);
  m.ret();
}

test("the assertions have teeth: the dropped-`or 0x80` mutation is caught", () => {
  assertEnqueue(loc_4c67, 3); // the real routine passes it
  assert.throws(
    () => assertEnqueue(loc_4c67_mut, 3),
    /slot 3 holds 0x86/,
    "mutant must fail the enqueued-byte assertion",
  );
});
