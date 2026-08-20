// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_159b (ROM 0x159b-0x15a0): tick loc_7912, load HL=0x15d1, fall through into
// loc_15a1's rst-0x28 dispatch, then continue at 0x15d1 (loc_159b's post-dispatch continuation, which
// ret's to the caller = the NMI epilogue 0x06fa). Flat-RAM mock with real Regs.
//
// The mock models each callee's REAL stack effect: 0x7912 is a pattern-A call (rets, popping the pushed
// 0x159e); 0x15a1 is the rst-0x28 TAIL DISPATCHER -- it pushes the handler return (HL) and the handler
// ret's popping it, so it is NET-ZERO on the stack and control lands at HL (=0x15d1); 0x15d1 is the
// continuation, which rets to loc_159b's caller (0x06fa). A record-only stub would hide a leak, so the
// SP-baseline assertion + positive control are the teeth. (This routine was previously mis-translated to
// STOP at the dispatch as a never-return tail, leaking 0x06fa; that desynced the NMI epilogue's ret.)
//
// Run: node --test games/pooyan/translated/test/loc_159b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_159b } from "../loc_159b.js";

const CALLER_RET = 0xabcd; // stands in for 0x06fa, the NMI epilogue loc_066d pushed

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x159b, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) {
      this.calls.push(addr);
      if (addr === 0x15a1) {
        // rst-0x28 tail dispatcher: pushes the handler return (HL) then the handler ret's popping it
        // -- net-zero on the stack; control resumes at HL.
        this.step(regs.hl, 0);
      } else {
        this.ret(0); // 0x7912 pops the pushed 0x159e; 0x15d1 pops the caller return (0x06fa)
      }
      return undefined;
    },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_159b: tick 0x7912, dispatch via 0x15a1, continue at 0x15d1, ret to caller; balanced; 27 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_159b(m);

  assert.equal(m.tstates, 27, "own T = 17 (call 0x7912) + 10 (ld hl)");
  assert.equal(m.regs.hl, 0x15d1, "HL seeded with the handler return / continuation address");
  assert.equal(m.pc, CALLER_RET, "the 0x15d1 continuation ret's to loc_159b's caller (0x06fa)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced -- the continuation consumes the caller return, no leak");
  assert.deepEqual(m.calls, [0x7912, 0x15a1, 0x15d1], "tick, dispatch, then the continuation");
  assert.deepEqual(m.pcSeq, [0x7912, 0x159e, 0x15a1, 0x15d1, CALLER_RET],
    "call 0x7912 (rets to 0x159e), delegate to 0x15a1 (dispatch lands at 0x15d1), 0x15d1 rets to caller");
});

// ── POSITIVE CONTROL: dropping the pattern-A push16(0x159e) leaks -> SP drifts off baseline ──────────
test("loc_159b POSITIVE CONTROL: dropping the call's push16 leaves SP unbalanced", () => {
  const m = makeMachine();
  seatCaller(m);
  let dropped = false;
  const realPush = m.push16.bind(m);
  m.push16 = (v) => { if (!dropped && v === 0x159e) { dropped = true; return; } return realPush(v); };

  loc_159b(m);

  assert.notEqual(m.regs.sp, 0x8780, "a missing push16 desyncs the stack -> SP drifts off baseline");
});

test("loc_159b MUTATION: a mis-charged `call 0x7912` step (17T->10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7912 ? 10 : c);

  loc_159b(m);

  assert.equal(m.tstates, 20, "mutation drops 7 T");
  assert.notEqual(m.tstates, 27, "golden T catches the dropped step");
});
