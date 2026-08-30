// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_118d (ROM 0x118d, Pooyan) -- the object-slot spawn loop.
 * Entered with B = slot count and IX at the first 0x18-byte object record. Each pass seeds
 * E = 0x1d, `call 0x119a` (per-slot initializer), then `add ix,de` (de = 0x18) advances to the
 * next record; `djnz` loops. `ret`s to the caller when B hits 0.
 *
 * Pinned paths:
 *   B = 1 (single pass): ld e (7) + call (17) + ld de (10) + add ix (15) + djnz not-taken (8)
 *        + ret (10) = 67 T. One call to 0x119a. IX advances 0x8ae0 -> 0x8af8.
 *   B = 2 (two passes): pass1 7+17+10+15+13(djnz taken) = 62; pass2 7+17+10+15+8(nt) = 57;
 *        ret 10. Total 129 T. Two calls to 0x119a. IX advances 0x8ae0 -> 0x8b10.
 *
 * TEETH: mis-charge `ld e,0x1d` (7 T) as 4 T on the B=1 path -- the golden total must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_118d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_118d } from "../loc_118d.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x118d, pcSeq: [],
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
    // model the callee running to its own ret: pop the return the site pushed so SP rebalances
    call(addr, site) { this.calls.push(addr); this.site = site; this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_118d: B=1 runs one slot pass, advances IX by 0x18, then rets", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x8ae0;
  loc_118d(m);

  assert.equal(m.tstates, 67, "T = 7+17+10+15+8(djnz nt)+10(ret)");
  assert.deepEqual(m.pcSeq, [0x118f, 0x119a, 0x1195, 0x1197, 0x1199, CALLER_RET],
    "single pass falls out of djnz to the ret, then to the seated caller");
  assert.deepEqual(m.calls, [0x119a], "one call to the per-slot initializer loc_119a");
  assert.equal(m.regs.ix, 0x8af8, "IX advanced one 0x18 record: 0x8ae0 -> 0x8af8");
  assert.equal(m.regs.b, 0x00, "B decremented to 0");
  assert.equal(m.regs.e, 0x18, "E last written by `ld de,0x0018` (low byte 0x18)");
  assert.equal(m.regs.sp, 0x8780, "SP balanced: ret popped the caller return, back to seat base");
});

test("loc_118d: B=2 loops twice (djnz taken then not), two calls, IX += 0x30", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x02;
  m.regs.ix = 0x8ae0;
  loc_118d(m);

  assert.equal(m.tstates, 129, "T = 62(pass1, djnz taken) + 57(pass2, djnz nt) + 10(ret)");
  assert.deepEqual(m.pcSeq,
    [0x118f, 0x119a, 0x1195, 0x1197, 0x118d,
     0x118f, 0x119a, 0x1195, 0x1197, 0x1199, CALLER_RET],
    "pass1 djnz loops back to 0x118d; pass2 falls through to ret");
  assert.deepEqual(m.calls, [0x119a, 0x119a], "one initializer call per slot");
  assert.equal(m.regs.ix, 0x8b10, "IX advanced two records: 0x8ae0 -> 0x8b10");
  assert.equal(m.regs.b, 0x00, "B decremented to 0");
});

test("loc_118d MUTATION: `ld e,0x1d` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x118f ? 4 : cycles);
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x8ae0;
  loc_118d(m);

  assert.equal(m.tstates, 64, "mutation loses 3 T (7 -> 4)");
});
