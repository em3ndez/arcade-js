// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_7625 (ROM 0x7625-0x7638): the twin entry loc_7625 (seed B=0x08 ->
// delegate 0x7627) and the shared walk loc_7627. loc_7627 ticks B struct entries at IX (stride
// 0x18) via 0x7638, parking the counter in B' across each call (exx). A tick that returns false
// (caller-skip) has already unwound past loc_7627, so it must early-return with no ret of its own.
//
// The mocked 0x7638 mimics the real handler's stack effect: a normal tick pops the call-0x7638
// return we pushed (SP += 2) and returns true; a caller-skip pops that AND loc_7627's own return
// (unwinding two levels) and returns false. Run: node --test .../test/loc_7625.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7625, loc_7627 } from "../loc_7625.js";

const CALLER_RET = 0xabcd;
const DELEGATE_MARK = 0x7e57;

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
    call(addr) { this.calls.push(addr); return DELEGATE_MARK; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// A normal tick: balance the call-0x7638 return we pushed, then report "continue" (true).
function installNormalTick(m) {
  m.call = (addr) => { m.calls.push(addr); m.regs.sp = (m.regs.sp + 2) & 0xffff; return true; };
}

// ── loc_7625: twin entry ──────────────────────────────────────────────────────────────────────
test("loc_7625: seeds B=0x08, delegates to 0x7627; 7 T", () => {
  const m = makeMachine();
  seatCaller(m);

  const r = loc_7625(m);

  assert.equal(m.regs.b, 0x08, "B seeded 0x08");
  assert.equal(m.tstates, 7, "ld b,0x08");
  assert.deepEqual(m.calls, [0x7627], "falls into the shared body at 0x7627");
  assert.equal(r, DELEGATE_MARK, "propagates 0x7627's return");
  assert.deepEqual(m.pcSeq, [0x7627], "single boundary: ld b -> 0x7627");
});

// ── loc_7627: normal walk of B=2 entries ──────────────────────────────────────────────────────
test("loc_7627: ticks B=2 entries, IX += 2*0x18, ret; 135 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installNormalTick(m);
  m.regs.b = 2;

  loc_7627(m);

  assert.equal(m.tstates, 135, "loc_7627 B=2 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "every call push balanced, ret popped the caller");
  assert.deepEqual(m.calls, [0x7638, 0x7638], "one tick per entry");
  assert.equal(m.regs.ix, 0x8b10, "IX = 0x8ae0 + 2*0x18");
  assert.equal(m.regs.b, 0, "counter drained to 0");
  assert.deepEqual(m.pcSeq,
    [0x762b, 0x762e, 0x762f, 0x7638, 0x7633, 0x7635, 0x762e, 0x762f, 0x7638, 0x7633, 0x7635, 0x7637, CALLER_RET],
    "step boundaries across both iterations");
});

test("loc_7627 MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  installNormalTick(m);
  m.regs.b = 2;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7635 ? 11 : c); // charge add ix,de as a bare add hl
  loc_7627(m);
  assert.equal(m.tstates, 135 - 8, "mutation loses 4 T per iteration (15 -> 11), twice");
  assert.notEqual(m.tstates, 135, "golden T-state total catches the DD-prefix timing mutant");
});

// ── loc_7627: a tick caller-skips on the first entry -> abort the walk ─────────────────────────
test("loc_7627: caller-skip tick unwinds past loc_7627 -> early return, no own ret", () => {
  const GRAND = 0x76f0; // loc_7627's caller return, popped by the handler's `ret`
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(GRAND);
  m.regs.b = 5; // would tick 5, but the first tick aborts
  m.call = (addr) => {
    m.calls.push(addr);
    m.pop16();          // pop af: discard loc_7627's call-0x7638 return
    m.pc = m.pop16();   // ret: unwind to loc_7627's caller
    return false;       // caller-skip signalled
  };

  loc_7627(m);

  assert.deepEqual(m.calls, [0x7638], "aborted after the first tick");
  assert.equal(m.pc, GRAND, "control is at loc_7627's caller (two levels unwound)");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound by the handler; loc_7627 added no ret");
});
