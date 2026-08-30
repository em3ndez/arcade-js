// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_14dc (ROM 0x14dc-0x1554, Pooyan) -- multi-sub-state object
 * handler off one IX record.
 *
 * The mock's `call` POPS one return: for a pattern-A `call` the site pushed the return first
 * (net-zero SP), for a tail `jp` (no push16) the callee's ret consumes the seated CALLER_RET so
 * the stack unwinds to the pre-seat baseline.
 *
 * Pinned paths:
 *   Path 1 -- mask build, state 2: (0x8d45)=2, (ix+0x12)=0, (ix+0x17) don't-care. Falls through
 *     cp<5 -> ld b,a/dec b (b=1) -> one sla -> mask 2 OR'd into 0x8f60 -> B=0x38 -> setup at 0x1508
 *     -> call 0x0c45/0x381e, inc (ix+0x02) -> 0x1518 call 0x4006, dec (ix+0x11) 0x38->0x37 (NZ)
 *     -> `ret nz` back to caller.  T = 331.
 *   Path 2 -- early jump + full run to tail 0x3553: (0x8d45)=0 -> jr z 0x1508 with B=1 -> setup
 *     -> 0x1518 dec (ix+0x11) 1->0 (Z) fall through -> (0x8f60)=0 so jr z 0x153a -> (ix+0x16)=0
 *     (!=7) advance -> 0x154d dec (ix+0x11) 1->0 (Z) -> tail jp 0x3553.  T = 387.
 *   Path 3 -- flags-set branch + tail 0x3d99: (0x8d45)=0, (ix+0x17)=5, (0x8f60)=1, (ix+0x16)=7.
 *     0x1518 falls through -> (0x8f60)*2=2 (NZ) so call 0x1131 -> C=5 (NZ) so ld (0x85e9),a ->
 *     0x1533 call 0x1119 -> 0x153a (ix+0x16)==7 -> tail jp 0x3d99.  T = 342.
 *
 * TEETH: mis-charge `ld c,(ix+0x17)` (19T) as 7T on Path 1 -- the 331 golden must throw.
 *
 * Run: node --test games/pooyan/translated/test/loc_14dc.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_14dc } from "../loc_14dc.js";

const CALLER_RET = 0xabcd;
const IX = 0x8b00; // RAM record base (all (ix+d) default 0 unless seeded)

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x14dc, pcSeq: [],
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
    // Callee ret pops what the site pushed (pattern-A call), or the seated caller (tail jp).
    call(addr, site) { this.calls.push(addr); this.site = site; this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_14dc Path 1: state 2 mask build, then `ret nz` at 0x151e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d45, 0x02);           // state 2 (non-zero -> no early jump)
  m.mem.write8((IX + 0x12) & 0xffff, 0x00); // inc c -> 1 (non-zero -> no early jump)
  m.mem.write8(0x8f60, 0x00);           // flags start empty

  loc_14dc(m);

  assert.equal(m.tstates, 331, "Path 1 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x14de, 0x14e1, 0x14e4, 0x14e5, 0x14e7, 0x14ea, 0x14eb, 0x14ed, 0x14ef, 0x14f3,
    0x14f4, 0x14f5, 0x14f6, 0x14f8, 0x14fa,
    0x14fc, 0x14fe,
    0x1501, 0x1502, 0x1503, 0x1505, 0x1506, 0x1508,
    0x150b, 0x150c, 0x150f, 0x0c45, 0x381e, 0x1518,
    0x4006, 0x151e, CALLER_RET,
  ], "mask-build path then early ret nz");
  assert.deepEqual(m.calls, [0x0c45, 0x381e, 0x4006], "setup + one service call");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced back to baseline");
  assert.equal(m.mem.read8(0x8f60), 0x02, "mask 1<<(2-1)=2 OR'd into 0x8f60");
  assert.equal(m.mem.read8((IX + 0x11) & 0xffff), 0x37, "(ix+0x11): 0x38 set then decremented");
  assert.equal(m.mem.read8((IX + 0x02) & 0xffff), 0x01, "(ix+0x02) sub-state advanced");
  assert.equal(m.regs.a, 0x01, "A = C (=(ix+0x12)+1... =1 here) loaded at 0x150b");
});

test("loc_14dc Path 2: early jump (0x8d45=0), full run to tail jp 0x3553", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d45, 0x00);           // -> jr z 0x1508 (B stays 1)
  m.mem.write8(0x8f60, 0x00);           // sla -> 0 -> jr z 0x153a
  m.mem.write8((IX + 0x16) & 0xffff, 0x00); // != 7 -> no 0x3d99 tail

  loc_14dc(m);

  assert.equal(m.tstates, 387, "Path 2 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x14de, 0x14e1, 0x14e4, 0x14e5, 0x1508,
    0x150b, 0x150c, 0x150f, 0x0c45, 0x381e, 0x1518,
    0x4006, 0x151e, 0x151f, 0x1522, 0x1524, 0x1525, 0x1526, 0x153a,
    0x153d, 0x153f, 0x1542, 0x1543, 0x1546, 0x154a, 0x154d,
    0x4006, 0x1553, 0x1554, 0x3553,
  ], "early jump -> countdown expires -> second countdown -> tail jp 0x3553");
  assert.deepEqual(m.calls, [0x0c45, 0x381e, 0x4006, 0x4006, 0x3553], "two services then tail");
  assert.equal(m.pc, 0x3553, "tail jp lands on 0x3553");
  assert.equal(m.regs.sp, 0x8780, "tail jp ret consumed CALLER_RET -> baseline");
  assert.equal(m.mem.read8((IX + 0x13) & 0xffff), 0x01, "(ix+0x13) = (ix+0x16)+1");
  assert.equal(m.mem.read8((IX + 0x02) & 0xffff), 0x02, "(ix+0x02) advanced twice");
});

test("loc_14dc Path 3: flags-set branch (0x1131/0x85e9/0x1119) then tail jp 0x3d99", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d45, 0x00);           // early jump, B=1
  m.mem.write8((IX + 0x17) & 0xffff, 0x05); // C=5 (non-zero -> ld (0x85e9),a)
  m.mem.write8(0x8f60, 0x01);           // sla -> 2 (non-zero -> call 0x1131 branch)
  m.mem.write8((IX + 0x16) & 0xffff, 0x07); // == 7 -> tail jp 0x3d99

  loc_14dc(m);

  assert.equal(m.tstates, 342, "Path 3 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x14de, 0x14e1, 0x14e4, 0x14e5, 0x1508,
    0x150b, 0x150c, 0x150f, 0x0c45, 0x381e, 0x1518,
    0x4006, 0x151e, 0x151f, 0x1522, 0x1524, 0x1525, 0x1526, 0x1528,
    0x1131, 0x152c, 0x152d, 0x152e, 0x1530, 0x1533,
    0x1536, 0x1537, 0x1119, 0x153d, 0x153f, 0x3d99,
  ], "call 0x1131 -> stash 0x85e9 -> call 0x1119 -> tail jp 0x3d99");
  assert.deepEqual(m.calls, [0x0c45, 0x381e, 0x4006, 0x1131, 0x1119, 0x3d99], "full call chain + tail");
  assert.equal(m.pc, 0x3d99, "tail jp lands on 0x3d99");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
  assert.equal(m.mem.read8(0x85e9), 0x05, "A (=C=5) stashed at 0x85e9");
  assert.equal(m.regs.e, 0x02, "E = A returned-through from 0x1131 (mock leaves A = sla result 2)");
  assert.equal(m.regs.a, 0x07, "A = (ix+0x16) = 7 at the cp");
});

test("loc_14dc MUTATION: `ld c,(ix+0x17)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x14e1 ? 7 : cycles);
  m.mem.write8(0x8d45, 0x02);
  m.mem.write8((IX + 0x12) & 0xffff, 0x00);

  loc_14dc(m);

  assert.equal(m.tstates, 319, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 331, "Path 1 T-state total"),
    /331/,
    "the 331-T golden must fail on the mutant",
  );
});
