// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_15a1 (ROM 0x15a1-0x15a7): the rst 0x28 state dispatcher. It pushes HL
// (the return the SELECTED handler ret's to), reads index (0x880a)&0x1f, then rst 0x28 -> loc_0028
// reads the inline word table at 0x15a8 and jp (hl)'s to the handler. loc_0028 DISPATCHES (pops the
// table base, delegates) rather than plain-ret'ing to us, so -- exactly as loc_0899's test does --
// the call stub is RECORD-ONLY and the teeth are the explicit stack layout: table base 0x15a8 on
// top, the pushed handler return beneath it, the seated caller beneath that.
//
// Run: node --test games/pooyan/translated/test/loc_15a1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_15a1 } from "../loc_15a1.js";

const CALLER_RET = 0xabcd;
const HANDLER_RET = 0x15d1; // HL on entry (what loc_159b seeds)

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x15a1, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    call(addr, site) { this.calls.push(addr); this.site = site; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_15a1: rst 0x28 dispatch on (0x880a)&0x1f -> loc_0028; handler return seated; 42 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = HANDLER_RET;
  m.mem.write8(0x880a, 0x25); // & 0x1f -> index 5

  loc_15a1(m);

  assert.equal(m.tstates, 42, "T = 11 (push) + 13 (ld a) + 7 (and) + 11 (rst)");
  assert.deepEqual(m.pcSeq, [0x15a2, 0x15a5, 0x15a7, 0x0028], "boundaries; last is the rst target");
  assert.deepEqual(m.calls, [0x0028], "delegates to the generic dispatcher loc_0028");
  assert.equal(m.regs.a, 0x05, "A = (0x880a) masked to the state index");
  // stack: rst's return (table base 0x15a8) on top, then the handler return HL, then caller
  assert.equal(m.pop16(), 0x15a8, "top of stack = rst 0x28 return = inline table base 0x15a8");
  assert.equal(m.pop16(), HANDLER_RET, "beneath it = the handler return address (pushed HL)");
  assert.equal(m.pop16(), CALLER_RET, "beneath that = the seated caller return");
});

// ── POSITIVE CONTROL: dropping `push hl` mis-seats the handler return ────────────────────────────
test("loc_15a1 POSITIVE CONTROL: dropping push16(HL) leaves the wrong handler return on the stack", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = HANDLER_RET;
  m.mem.write8(0x880a, 0x25);
  let dropped = false;
  const realPush = m.push16.bind(m);
  m.push16 = (v) => { if (!dropped && v === HANDLER_RET) { dropped = true; return; } return realPush(v); };

  loc_15a1(m);

  assert.equal(m.pop16(), 0x15a8, "table base still on top");
  assert.notEqual(m.pop16(), HANDLER_RET, "without push hl the handler-return slot is corrupted");
});

test("loc_15a1 MUTATION: `ld a,(0x880a)` mis-charged 13T->7T is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = HANDLER_RET;
  m.mem.write8(0x880a, 0x25);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x15a5 ? 7 : c);

  loc_15a1(m);

  assert.equal(m.tstates, 36, "mutation loses 6 T");
  assert.notEqual(m.tstates, 42, "golden T catches the mis-charge");
});
