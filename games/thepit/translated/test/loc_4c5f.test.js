// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4c5f (ROM 0x4C5F-0x4C61, The Pit): load command id 0x04
// into A, then unconditionally TAIL-jump (`jr 0x4ca5`) into the shared enqueue
// body loc_4ca5 — whose own `ret` unwinds to loc_4c5f's caller.
//
// loc_4c5f writes NO memory of its own; its entire contract is:
//   (1) A = 0x04 handed to the callee,
//   (2) 19 T charged (ld a,n = 7  +  jr = 12) BEFORE control leaves,
//   (3) a tail-transfer to 0x4ca5 modelled as `return m.call(0x4ca5)` (no ret of
//       its own), so the callee's ret pops loc_4c5f's caller.
// To give the register/memory assertions real teeth we run a faithful test-local
// model of the callee loc_4ca5 (the tail target — NOT the routine under test)
// inside m.call, so the end-to-end effect (0x04 -> `or 0x80` -> 0x84 written into
// the 0x8020 ring at the 0x801e cursor) is observable. Ends with a MUTATION (the
// wrong command id 0x05, the byte that distinguishes this stub from sibling
// loc_4c63) proven caught.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4c5f } from "../loc_4c5f.js";

const RET = 0x1234; // sentinel return address pushed before the call
const RING_BASE = 0x8020; // 8-entry command ring buffer
const CURSOR = 0x801e; // 3-bit write index into the ring
const START_INDEX = 0x07; // start at 7 so the callee's `and 0x07` wrap is exercised
const OWN_T = 19; // loc_4c5f's own cost: ld a,n (7) + jr (12)
const CALLEE_T = 143; // loc_4ca5 body incl. its ret (see model below)
const FULL_T = OWN_T + CALLEE_T; // 162 end-to-end

// Faithful, test-local model of the tail target loc_4ca5 (ROM 0x4CA5-0x4CBE):
//   or 0x80 / push de / push hl / ld d,a / ld a,(0x801e) / ld e,a / inc a /
//   and 0x07 / ld (0x801e),a / ld hl,0x8020 / ld a,d / ld d,0x00 / add hl,de /
//   ld (hl),a / pop hl / pop de / ret.  Appends A|0x80 to ring[oldIndex] and
//   advances the cursor (oldIndex+1)&7.  This is the CALLEE, not loc_4c5f — it
//   lives here only so the enqueue is observable end-to-end.
function loc_4ca5(m) {
  const { regs, mem } = m;
  regs.or(0x80); // 4ca5  or 0x80
  m.step(0x4ca7, 7);
  m.push16(regs.de); // 4ca7  push de
  m.step(0x4ca8, 11);
  m.push16(regs.hl); // 4ca8  push hl
  m.step(0x4ca9, 11);
  regs.d = regs.a; // 4ca9  ld d,a
  m.step(0x4caa, 4);
  regs.a = mem.read8(0x801e); // 4caa  ld a,(0x801e)
  m.step(0x4cad, 13);
  regs.e = regs.a; // 4cad  ld e,a
  m.step(0x4cae, 4);
  regs.a = regs.inc8(regs.a); // 4cae  inc a
  m.step(0x4caf, 4);
  regs.and(0x07); // 4caf  and 0x07
  m.step(0x4cb1, 7);
  mem.write8(0x801e, regs.a); // 4cb1  ld (0x801e),a
  m.step(0x4cb4, 13);
  regs.hl = 0x8020; // 4cb4  ld hl,0x8020
  m.step(0x4cb7, 10);
  regs.a = regs.d; // 4cb7  ld a,d
  m.step(0x4cb8, 4);
  regs.d = 0x00; // 4cb8  ld d,0x00
  m.step(0x4cba, 7);
  regs.addHl(regs.de); // 4cba  add hl,de
  m.step(0x4cbb, 11);
  mem.write8(regs.hl, regs.a); // 4cbb  ld (hl),a
  m.step(0x4cbc, 7);
  regs.hl = m.pop16(); // 4cbc  pop hl
  m.step(0x4cbd, 10);
  regs.de = m.pop16(); // 4cbd  pop de
  m.step(0x4cbe, 10);
  m.ret(); // 4cbe  ret
}

// Minimal machine: real Regs + real Pit AddressSpace + the step/ret/push16/pop16
// seam, plus an m.call that records the tail transfer (target + A + T at entry)
// and runs the faithful loc_4ca5 model above.
function makeMachine() {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)

  const spy = { target: null, aAtCall: null, tAtCall: null };

  const m = {
    regs,
    mem,
    spy,
    tstates: 0,
    pc: 0x4c5f,
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
      // record the tail transfer as loc_4c5f hands off — A and T are its own
      spy.target = addr;
      spy.aAtCall = regs.a;
      spy.tAtCall = this.tstates;
      if (addr !== 0x4ca5) throw new Error(`unexpected m.call(0x${addr.toString(16)})`);
      return loc_4ca5(this); // callee's ret unwinds to loc_4c5f's caller
    },
  };

  mem.write8(CURSOR, START_INDEX); // seed the write cursor at 7
  m.push16(RET); // the return address the callee's ret must pop
  return m;
}

// The canonical contract, shared by the real routine and the mutant so the
// mutation is measured against exactly the assertions the routine must pass.
function assertContract(fn) {
  const m = makeMachine();
  fn(m);

  // (1) the tail transfer: to 0x4ca5, with A = 0x04, after exactly its own 19 T
  assert.equal(m.spy.target, 0x4ca5, "tail-jumps to loc_4ca5");
  assert.equal(m.spy.aAtCall, 0x04, "A = 0x04 handed to the callee");
  assert.equal(m.spy.tAtCall, OWN_T, "loc_4c5f charged its own 19 T before the jump");

  // (2) end-to-end enqueue: 0x04 | 0x80 = 0x84 landed at ring[oldIndex=7], and
  // the cursor advanced (7+1)&7 = 0.
  assert.equal(m.mem.read8(RING_BASE + START_INDEX), 0x84, "0x84 written to ring[7] (0x8027)");
  assert.equal(m.mem.read8(CURSOR), 0x00, "cursor advanced (7+1)&7 = 0");

  // (3) control flow: the callee's ret popped loc_4c5f's caller
  assert.equal(m.returned, true, "control returned via the callee ret");
  assert.equal(m.pc, RET, "unwound to loc_4c5f's caller, not to 0x4ca5+n");
  assert.equal(m.tstates, FULL_T, "end-to-end T = 19 (own) + 143 (callee) = 162");
  return m;
}

test("loads 0x04, tail-jumps to 0x4ca5, enqueues 0x84, unwinds to caller", () => {
  assertContract(loc_4c5f);
});

// ---- MUTATION: wrong command id (0x05 instead of 0x04) ----------------------
// The immediate is the ENTIRE distinguishing content of this stub (0x05 is what
// sibling loc_4c63 loads). A mutant that loads 0x05 enqueues 0x85, not 0x84, and
// hands A = 0x05 to the callee -- caught by BOTH the aAtCall tooth and the ring
// byte, while the T-states are unchanged (which is exactly why the value
// assertions, not only the T total, must exist). Run through the SAME contract
// helper the real routine passes, and shown to throw.
function loc_4c5f_mut(m) {
  const { regs } = m;
  regs.a = 0x05; // BUG: wrong command id (sibling loc_4c63's), enqueues 0x85
  m.step(0x4c61, 7);
  m.step(0x4ca5, 12);
  return m.call(0x4ca5);
}

test("the assertions have teeth: the wrong-command-id (0x05) mutation is caught", () => {
  assertContract(loc_4c5f); // the real routine passes the contract
  assert.throws(
    () => assertContract(loc_4c5f_mut),
    /A = 0x04|0x84 written/,
    "mutant must fail the A-handoff or the enqueued-byte assertion",
  );
});
