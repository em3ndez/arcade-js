// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_42da (ROM 0x42da, Pooyan) -- the object-slot initializer.
 * iy = the slot. Bails via `ret c` when the slot is live (bit0 of (iy+0)|(iy+1)); otherwise marks
 * it active, copies the 4-byte position block ix+3->iy+3 (ldir), seeds anim/state fields, resolves
 * an animation (loc_0c45/loc_5c75/loc_381e), then `pop af`+`ret` -- SKIP-RETURN: it discards its own
 * return address and returns one frame up, aborting the caller's (loc_4221) spawn loop.
 *
 * The mock's `call` POPS the return address the call site pushed (models the callee's `ret`); a call
 * site that forgot its push16 then desyncs the stack (the pop af/ret miss their seated frames) and
 * fails the SP-baseline tooth. The MAIN path seats TWO frames (INNER discarded by pop af, OUTER is
 * the real return) and asserts SP unwinds to the pre-seat baseline. ldirAt models the 4-byte copy
 * exactly (21T/iter, 16T last).
 *
 * Run: node --test games/pooyan/translated/test/loc_42da.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_42da } from "../loc_42da.js";

const INNER_RET = 0xbeef; // loc_4221's continuation -- discarded by `pop af`
const OUTER_RET = 0x1234; // loc_4221's own return -- the real destination of the skip-return
const CALLER_RET = 0xabcd; // single-frame return for the slot-busy path

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x42da, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
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
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The callee's `ret` pops the return address the call site pushed -- model that pop so a missing
    // push16 desyncs the stack and fails the balance tooth. loc_0c45/loc_5c75/loc_381e are pure sinks here.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
    // Full LDIR: 21T/iter while BC!=0 after the decrement, 16T on the last (matches machine.js).
    ldirAt(self, nextAddr) {
      for (;;) {
        const b = mem.read8(regs.hl);
        mem.write8(regs.de, b);
        regs.hl = (regs.hl + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff;
        regs.bc = (regs.bc - 1) & 0xffff;
        const n = (regs.a + b) & 0xff;
        regs.f = (regs.f & 0xc1) | (regs.bc !== 0 ? 0x04 : 0) | (n & 0x08 ? 0x08 : 0) | (n & 0x02 ? 0x20 : 0);
        if (regs.bc === 0) { this.step(nextAddr, 16); return; }
        regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28);
        this.step(self, 21);
      }
    },
  };
}

const PC_MAIN = [
  0x42dd, 0x42e0, 0x42e1, 0x42e2,
  0x42e6, 0x42ea, 0x42ec, 0x42ed, 0x42ef, 0x42f0,
  0x42f1, 0x42f2, 0x42f3, 0x42f4, 0x42f5, 0x42f6,
  0x42f9,                             // ld bc,0x0004 -> next
  0x42f9, 0x42f9, 0x42f9, 0x42fb,     // ldir: 3 repeats + final
  0x42fd, 0x4300, 0x4302, 0x4305, 0x4308, 0x430b, 0x430d, 0x430e, 0x4310,
  0x0c45,                             // call 0x0c45 -> target
  0x5c75,                             // call 0x5c75 -> target
  0x4317, 0x431a, 0x431d,
  0x381e,                             // call 0x381e -> target
  0x4324, 0x4328, 0x432b, 0x432c,
  OUTER_RET,                          // pop af discards INNER_RET, ret lands on OUTER_RET
];

function setupMain(m) {
  m.regs.sp = 0x8780;
  m.push16(OUTER_RET); // seated below
  m.push16(INNER_RET); // seated call frame (loc_4221 -> loc_42da), discarded by pop af
  m.regs.ix = 0x8b00;
  m.regs.iy = 0x8c00;
  // slot idle: (iy+0)|(iy+1) bit0 clear -> ret c not taken
  m.mem.write8(0x8c00, 0x00);
  m.mem.write8(0x8c01, 0x00);
  // inc (ix+0x02) subject
  m.mem.write8(0x8b02, 0x05);
  // 4-byte source block ix+3..ix+6
  m.mem.write8(0x8b03, 0x11);
  m.mem.write8(0x8b04, 0x22);
  m.mem.write8(0x8b05, 0x33);
  m.mem.write8(0x8b06, 0x44);
  // 0x8907 -> anim selector fed to loc_0c45 (mock ignores it)
  m.mem.write8(0x8907, 0x06);
}

test("loc_42da MAIN: idle slot -> init + 4-byte copy + skip-return one frame up", () => {
  const m = makeMachine();
  setupMain(m);

  loc_42da(m);

  assert.equal(m.tstates, 502, "MAIN T-state total");
  assert.deepEqual(m.pcSeq, PC_MAIN, "step boundaries match the ROM bytes");
  assert.deepEqual(m.calls, [0x0c45, 0x5c75, 0x381e], "three animation-resolve calls");
  // slot marked active
  assert.equal(m.mem.read8(0x8c00), 0x01, "(iy+0) = 0x01 active flag");
  assert.equal(m.mem.read8(0x8c02), 0x0d, "(iy+2) = 0x0d state");
  // ldir copied ix+3..ix+6 -> iy+3..iy+6
  assert.equal(m.mem.read8(0x8c03), 0x11, "copied byte 0");
  assert.equal(m.mem.read8(0x8c04), 0x22, "copied byte 1");
  assert.equal(m.mem.read8(0x8c05), 0x33, "copied byte 2");
  assert.equal(m.mem.read8(0x8c06), 0x44, "copied byte 3");
  // anim seeds: (iy+9)=0x2a, (iy+0a)=neg(0x2a)=0xd6
  assert.equal(m.mem.read8(0x8c09), 0x2a, "(iy+9) = 0x2a");
  assert.equal(m.mem.read8(0x8c0a), 0xd6, "(iy+0a) = -0x2a = 0xd6");
  assert.equal(m.mem.read8(0x8d5b), 0x00, "(0x8d5b) cleared by xor a");
  assert.equal(m.mem.read8(0x8b11), 0x30, "(ix+0x11) = 0x30");
  assert.equal(m.mem.read8(0x8c11), 0x04, "(iy+0x11) = 0x04");
  assert.equal(m.mem.read8(0x8b02), 0x06, "(ix+0x02) incremented 0x05 -> 0x06");
  // skip-return: pop af discarded INNER_RET into AF, ret landed on OUTER_RET
  assert.equal(m.regs.a, 0xbe, "pop af loaded AF high from the discarded INNER_RET");
  assert.equal(m.pc, OUTER_RET, "ret returns one frame up (aborts the caller's loop)");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound past BOTH seated frames to baseline");
});

test("loc_42da BUSY: live slot -> `ret c` normal return to caller", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.iy = 0x8c00;
  m.mem.write8(0x8c00, 0x01); // bit0 set -> after rrca carry set -> ret c
  m.mem.write8(0x8c01, 0x00);

  loc_42da(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 11, "ld a + or + rrca + ret c taken");
  assert.deepEqual(m.pcSeq, [0x42dd, 0x42e0, 0x42e1, CALLER_RET]);
  assert.deepEqual(m.calls, [], "no init work");
  assert.equal(m.pc, CALLER_RET, "normal return to the caller");
  assert.equal(m.regs.sp, 0x8780, "single frame unwound to baseline");
  assert.equal(m.mem.read8(0x8c00), 0x01, "slot untouched (already active)");
});

test("loc_42da MUTATION: `neg` mis-charged 4T (not 8T) is caught by the golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4302 ? 4 : cycles);
  setupMain(m);

  loc_42da(m);

  assert.equal(m.tstates, 498, "mutation loses 4 T (8 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 502, "MAIN T-state total"),
    /502/,
    "the 502-T golden must fail on the mutant",
  );
});
