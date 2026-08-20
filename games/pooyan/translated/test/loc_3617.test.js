// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_3617 (ROM 0x3617, Pooyan) -- the B<0x20 dispatch guard.
 * ld a,b; cp 0x20; ret nc (B>=0x20); else tail jr loc_365d. Reached as a rst 0x20 dispatch
 * target (word at 0x359c), so the ret/tail run in the dispatcher's caller frame: ret nc returns
 * to that seated caller, and the tail jr's callee ret also lands there. The mock's `call` POPS
 * (models the tail callee's ret consuming the seated return), so a stray push/pop desyncs SP --
 * the baseline assertion has teeth.
 *
 * Path RET (B>=0x20): ld a,b + cp + ret nc, pcSeq [0x3618, 0x361a, CALLER_RET], T=22.
 * Path TAIL (B<0x20): + ret-nc-not-taken + jr, pcSeq [0x3618, 0x361a, 0x361b, 0x365d], T=28.
 * No push16 in this leaf, so the positive control is the T-state mutation tooth (cp 7T->4T).
 *
 * Run: node --test games/pooyan/translated/test/loc_3617.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3617 } from "../loc_3617.js";

const CALLER_RET = 0xabcd;
const BASE = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x3617, pcSeq: [],
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
    // The tail callee's `ret` pops the seated return address -- model that pop so the stack balances.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = BASE; m.push16(CALLER_RET); }

test("loc_3617 RET: B>=0x20 -> ret nc to the seated caller", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x20; // B>=0x20 -> cp clears carry -> ret nc

  loc_3617(m);

  assert.equal(m.tstates, 22, "ld a,b(4) + cp(7) + ret nc(11)");
  assert.deepEqual(m.pcSeq, [0x3618, 0x361a, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nc lands on the seated caller");
  assert.equal(m.regs.a, 0x20, "A holds the compared B");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, BASE, "stack fully unwound");
});

test("loc_3617 TAIL: B<0x20 -> jr loc_365d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x1f; // B<0x20 -> cp sets carry -> ret nc not taken

  loc_3617(m);

  assert.equal(m.tstates, 28, "ld a,b(4) + cp(7) + ret-nc-not(5) + jr(12)");
  assert.deepEqual(m.pcSeq, [0x3618, 0x361a, 0x361b, 0x365d]);
  assert.equal(m.pc, 0x365d, "tail jr lands on loc_365d");
  assert.deepEqual(m.calls, [0x365d]);
  assert.equal(m.regs.sp, BASE, "tail callee ret pops the seated caller -> baseline");
});

test("loc_3617 MUTATION: cp mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x361a ? 4 : c); // cp n is 7T, not 4T
  seatCaller(m);
  m.regs.b = 0x20;

  loc_3617(m);

  assert.equal(m.tstates, 19, "mutation loses 3 T (7 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 22, "Path RET T-state total"), /22/);
});
