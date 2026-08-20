// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_62e6 (ROM 0x62e6, Pooyan) -- match-slot search + per-frame offset
 * apply. Scans up to C records (IY += DE per step) for one whose (iy+0x14) tag equals A; on the
 * found/exhausted exit it adds a signed table[0x6360] delta (rst 0x20) into (iy+0x0a), sets bit5 of
 * (iy+0x16), then tail-jumps loc_6274 via the shared 0x5c75 spawn.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling each callee's `ret`); rst
 * 0x20 -> loc_0020 additionally sets HL = HL+A, A = mem[HL] (loc_62e6 reads A right after). A call site
 * missing its push16 then desyncs SP and the pre-seat-baseline tooth fires.
 *
 * Path FOUND (match on the first record): jr z exit, delta applied, tail-jump loc_6274. Full pcSeq + T.
 * Path EXHAUST (C=2, no match): loop runs to C==0 (jr nz falls through), same tail from a walked IY.
 * TEETH: mis-charge `set 5,(iy+0x16)` (23 T) as 15 T -> the golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_62e6.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_62e6 } from "../loc_62e6.js";

const CALLER_RET = 0xabcd;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x62e6, pcSeq: [],
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
    // Every callee's `ret` pops the return address the call site pushed -- model that pop (a missing
    // push16 then desyncs SP). loc_0020 additionally: HL <- HL+A, A <- mem[HL]. loc_5c75/loc_6274 leave
    // no register loc_62e6 reads afterward (the tail-jump returns via loc_6274's own ret).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) {
        const hl2 = (regs.hl + regs.a) & 0xffff;
        regs.hl = hl2;
        regs.a = mem.read8(hl2);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Shared per-frame delta table + input registers used by both paths.
function armTail(m, iyBase) {
  m.mem.write8(0x8907, 0x04);          // (0x8907)&7 = 4; rra -> 2 (bit0 clear so carry-in stays 0)
  m.mem.write8(0x6362, 0x03);          // table[0x6360 + 2] = +3 delta
  m.mem.write8((iyBase + 0x0a) & 0xffff, 0x10); // (iy+0x0a) accumulator
  m.mem.write8((iyBase + 0x16) & 0xffff, 0x00); // (iy+0x16) flag byte
}

const TAIL_PC = [
  0x62f3, 0x62f6, 0x62f8, 0x62f9, 0x0020, 0x62fb, 0x62fe, 0x62ff, 0x6302, 0x6306, 0x6309, 0x5c75, 0x6274,
];
const TAIL_T = 10 + 13 + 7 + 4 + 11 + 4 + 19 + 4 + 19 + 23 + 10 + 17 + 10; // 151

test("loc_62e6 Path FOUND: tag matches the first record -> apply delta + tail-jump loc_6274", () => {
  const m = makeMachine();
  seatCaller(m);
  const IY = 0x8ae0;
  m.regs.iy = IY;
  m.regs.de = 0x0018;
  m.regs.c = 0x06;
  m.regs.a = 0x05;
  m.mem.write8((IY + 0x14) & 0xffff, 0x05); // first record matches
  armTail(m, IY);

  loc_62e6(m);

  assert.equal(m.tstates, 19 + 12 + TAIL_T, "Path FOUND T-state total");
  assert.deepEqual(m.pcSeq, [0x62e9, 0x62f0, ...TAIL_PC]);
  assert.equal(m.pc, 0x6274, "tail jp lands on loc_6274");
  assert.deepEqual(m.calls, [0x0020, 0x5c75, 0x6274]);
  assert.equal(m.regs.iy, IY, "IY unmoved (matched first record)");
  assert.equal(m.mem.read8((IY + 0x0a) & 0xffff), 0x13, "(iy+0x0a) += 3 delta");
  assert.equal(m.mem.read8((IY + 0x16) & 0xffff), 0x20, "bit5 of (iy+0x16) set");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (tail callee ret consumed CALLER_RET)");
});

test("loc_62e6 Path EXHAUST: C=2, no match -> loop to C==0 then the same tail from a walked IY", () => {
  const m = makeMachine();
  seatCaller(m);
  const IY0 = 0x8ae0;
  m.regs.iy = IY0;
  m.regs.de = 0x0018;
  m.regs.c = 0x02;
  m.regs.a = 0x05;
  // no record tag equals 0x05 (RAM is zero at every (iy+0x14)) -> full walk
  const IYend = (IY0 + 2 * 0x18) & 0xffff; // 0x8b10
  armTail(m, IYend);

  loc_62e6(m);

  assert.equal(m.tstates, (19 + 7 + 15 + 4 + 12) + (19 + 7 + 15 + 4 + 7) + TAIL_T, "Path EXHAUST T-state total");
  assert.deepEqual(m.pcSeq, [
    0x62e9, 0x62eb, 0x62ed, 0x62ee, 0x62e6, // iter1 (jr nz taken)
    0x62e9, 0x62eb, 0x62ed, 0x62ee, 0x62f0, // iter2 (C==0, jr nz falls through)
    ...TAIL_PC,
  ]);
  assert.equal(m.pc, 0x6274);
  assert.deepEqual(m.calls, [0x0020, 0x5c75, 0x6274]);
  assert.equal(m.regs.iy, IYend, "IY walked 2 records");
  assert.equal(m.regs.c, 0x00, "counter spent");
  assert.equal(m.mem.read8((IYend + 0x0a) & 0xffff), 0x13, "(iy+0x0a) += 3 delta at the walked slot");
  assert.equal(m.mem.read8((IYend + 0x16) & 0xffff), 0x20, "bit5 set at the walked slot");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_62e6 MUTATION: `set 5,(iy+0x16)` mis-charged 15T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6306 ? 15 : cycles);
  seatCaller(m);
  const IY = 0x8ae0;
  m.regs.iy = IY;
  m.regs.de = 0x0018;
  m.regs.c = 0x06;
  m.regs.a = 0x05;
  m.mem.write8((IY + 0x14) & 0xffff, 0x05);
  armTail(m, IY);

  loc_62e6(m);

  const golden = 19 + 12 + TAIL_T;
  assert.equal(m.tstates, golden - 8, "mutation loses 8 T (23 -> 15)");
  assert.throws(() => assert.equal(m.tstates, golden), /\d/, "the golden must fail on the mutant");
});
