// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4785 (ROM 0x4785-0x47A0): the border/HUD column drawer.
// It copies a 0x20-byte ROM tile strip (0x4ACB..0x4AEA) UP a video-RAM column
// (0x93FE descending by 0x20 each pass, via add hl,de with DE=0xFFE0 + inc ix),
// loads C=0x01 and A=0x1E, then TAIL-jumps into loc_3e1d.
//
// Asserts the T-state total (1980 = head 41 + loop 1915 + tail 24), the exact set
// of 32 source->dest copies (which proves the stride 0x20, the inc-ix source walk,
// AND the fixed 32-tile count), the register residue (IX=0x4AEB, HL=0x8FFE,
// DE=0xFFE0, B=0, C=0x01, A=0x1E), a balanced stack, and that the tail-jump is
// modelled as `return m.call(0x3e1d)` with NO spurious ret (m.returned stays false,
// SP unchanged, m.call forwarded). Ends with a MUTATION (the loop `inc ix` source
// advance dropped) proven caught by both the copy-mapping and T-state teeth.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4785 } from "../loc_4785.js";

const SRC_BASE = 0x4acb; // ROM tile strip start
const DST_TOP = 0x93fe; // top of the video column
const STRIDE = 0x20; // one tilemap row
const COUNT = 0x20; // 32 tiles
const CALL_SENTINEL = 0xbeef; // what the stubbed m.call(0x3e1d) returns

// 32 distinct, non-zero source bytes so a mis-mapped copy is visible per row.
const SRC = Array.from({ length: COUNT }, (_, k) => (0xa0 + k) & 0xff);
// dest[k] = 0x93FE - k*0x20 : the column walks UP (add hl,de, DE=0xFFE0)
const DST = Array.from({ length: COUNT }, (_, k) => (DST_TOP - k * STRIDE) & 0xffff);
const IX_END = (SRC_BASE + COUNT) & 0xffff; // 0x4AEB
const HL_END = (DST_TOP - COUNT * STRIDE) & 0xffff; // 0x8FFE (one stride past the last write)
// head 41 + loop (32*47 + 31*13 + 8) 1915 + tail 24 = 1980
const TOTAL_T = 41 + (COUNT * 47 + 31 * 13 + 8) + 24;

// Minimal machine: real Regs + real Pit AddressSpace + the step/ret/push16/pop16
// seam, plus a RECORDING m.call so the tail-jump into loc_3e1d is observed without
// actually running it (this isolates loc_4785's own T-states and effects).
function makeMachine() {
  const io = new Io();
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 0x5000
  for (let k = 0; k < COUNT; k++) rom[SRC_BASE + k] = SRC[k];
  const mem = new AddressSpace(rom, io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)

  const m = {
    regs,
    mem,
    tstates: 0,
    pc: 0x4785,
    returned: false,
    calls: [],
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
      this.returned = true; // loc_4785 must NEVER hit this (it tail-jumps)
    },
    call(addr) {
      this.calls.push(addr);
      this.pc = addr;
      return CALL_SENTINEL; // loc_4785 forwards this via `return m.call(...)`
    },
  };
  return m;
}

// The canonical copy-column facts, shared by the real routine and the mutant so
// the mutation is measured against exactly the assertions the routine must pass.
function assertCopyColumn(fn) {
  const m = makeMachine();
  fn(m);
  for (let k = 0; k < COUNT; k++) {
    assert.equal(
      m.mem.read8(DST[k]),
      SRC[k],
      `tile ${k}: 0x${DST[k].toString(16)} copies SRC 0x${SRC[k].toString(16)}`,
    );
  }
  assert.equal(m.tstates, TOTAL_T, `loc_4785 costs ${TOTAL_T} T`);
}

test("copies 32 tiles up 0x93FE (stride 0x20), then tail-jumps into loc_3e1d", () => {
  const m = makeMachine();
  const ret = loc_4785(m);

  // exactly 32 tiles, each source->dest correct (proves stride + inc-ix walk)
  for (let k = 0; k < COUNT; k++) {
    assert.equal(m.mem.read8(DST[k]), SRC[k], `tile ${k} at 0x${DST[k].toString(16)}`);
  }
  // no 33rd write: HL_END (0x8FFE) is where a 33rd tile would land, left untouched
  assert.equal(m.mem.read8(HL_END), 0x00, "the 33rd tile is NOT written (count fixed at 32)");

  // register residue at the tail
  assert.equal(m.regs.ix, IX_END, "IX walked source + 0x20 = 0x4AEB");
  assert.equal(m.regs.hl, HL_END, "HL = 0x93FE - 0x20*0x20 = 0x8FFE");
  assert.equal(m.regs.de, 0xffe0, "DE unchanged (the -0x20 stride)");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.c, 0x01, "C = 0x01, the fill byte handed to loc_3e1d");
  assert.equal(m.regs.a, 0x1e, "A = 0x1E, the column offset handed to loc_3e1d");

  // control flow: TAIL-jump, not call+ret
  assert.deepEqual(m.calls, [0x3e1d], "tail-jumps into loc_3e1d exactly once");
  assert.equal(m.returned, false, "loc_4785 issues NO ret — loc_3e1d's ret returns to our caller");
  assert.equal(m.regs.sp, 0x8700, "stack balanced: the tail JP pushes nothing");
  assert.equal(m.pc, 0x3e1d, "control transferred to 0x3e1d");
  assert.equal(ret, CALL_SENTINEL, "the tail m.call return value is forwarded");

  // T-state total
  assert.equal(m.tstates, TOTAL_T, `total is ${TOTAL_T} T`);
});

// ---- MUTATION: the loop `inc ix` source advance (and its 10 T) dropped ---------
// Faithful copy of loc_4785 with `inc ix` removed: every read takes SRC[0], so
// tiles 1..31 copy the wrong byte and the total loses 32*10 = 320 T. Both the
// copy-mapping teeth (tile 1 must be SRC[1]) and the T-state teeth (must be 1980)
// reject it.
function loc_4785_mut(m) {
  const { regs, mem } = m;
  regs.ix = 0x4acb; m.step(0x4789, 14);
  regs.hl = 0x93fe; m.step(0x478c, 10);
  regs.de = 0xffe0; m.step(0x478f, 10);
  regs.b = 0x20; m.step(0x4791, 7);
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x4794, 19);
    mem.write8(regs.hl, regs.a); m.step(0x4795, 7);
    regs.addHl(regs.de); m.step(0x4796, 11);
    // BUG: `inc ix` (regs.ix advance) and its 10 T omitted -> source never walks.
    if (regs.djnz() !== 0) {
      m.step(0x4791, 13);
    } else {
      m.step(0x479a, 8);
      break;
    }
  }
  regs.c = 0x01; m.step(0x479c, 7);
  regs.a = 0x1e; m.step(0x479e, 7);
  m.step(0x3e1d, 10);
  return m.call(0x3e1d);
}

test("the assertions have teeth: the dropped inc-ix mutation is caught", () => {
  assertCopyColumn(loc_4785); // the real routine passes it
  assert.throws(
    () => assertCopyColumn(loc_4785_mut),
    /tile 1:.*copies SRC|1980 T/,
    "mutant must fail the copy-mapping or T-state assertion",
  );
});
