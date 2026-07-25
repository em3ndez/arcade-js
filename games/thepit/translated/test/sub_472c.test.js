// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_472c (ROM 0x472C-0x4784, The Pit). Asserts the T-state
// total and the routine's key register/flag/memory/control-flow effects against
// the disassembly, on BOTH branch paths of `jr nc,0x476a`, plus a deliberate
// mutation the invariant checker must catch.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_472c } from "../sub_472c.js";

// Minimal faithful stand-in for the machine: real Regs / AddressSpace / Io, and
// step/call/ret/push16 modelled exactly like the DK machine. call RECORDS its
// target (the callees 0x4644/0x46af/0x47e1/0x48e5 are stubbed) so the routine is
// tested in isolation. Because the callees are stubbed, IX is NOT changed by
// sub_46af here -- so we seed IX to a VRAM base (as sub_46af would leave it), so
// the (ix-0x20)/(ix-0x40) blanking writes land in mapped video RAM.
class MockMachine {
  constructor() {
    this.regs = new Regs();
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs.sp = 0x8780; // stack inside work RAM so push16 lands in mapped RAM
    this.regs.ix = 0x90c1; // VRAM base sub_46af would have set (else-branch value)
    this.cycles = 0;
    this.pc = 0x472c;
    this.calls = [];
    this.returned = false;
  }
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.cycles += cycles;
  }
  call(addr) {
    this.calls.push(addr);
    return undefined; // stubbed callee -- we assert only that the call happened
  }
  ret(cycles = 10) {
    this.cycles += cycles;
    this.returned = true;
  }
  push16(value) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, value & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (value >> 8) & 0xff);
  }
}

// IX seed and the two cells the routine blanks (ix-0x20, ix-0x40).
const IX = 0x90c1;
const BLANK1 = (IX - 0x20) & 0xffff; // 0x90a1
const BLANK2 = (IX - 0x40) & 0xffff; // 0x9081

// The colour columns painted 0x02: 0x8BA1 down 9 cells, 0x8961 down 10 cells,
// stride -0x20. First and last cell of each are the boundary probes.
const COL1_FIRST = 0x8ba1;
const COL1_LAST = 0x8ba1 - 8 * 0x20; // 0x8aa1
const COL2_FIRST = 0x8961;
const COL2_LAST = 0x8961 - 9 * 0x20; // 0x8841

// Effects that are IDENTICAL on both branch paths (everything except the single
// HUD-variant call and the total cycle count).
function checkCommon(m, activePlayer) {
  // Both blanking passes hit the SAME two cells (IX never changes here) -> 0x00.
  assert.equal(m.mem.read8(BLANK1), 0x00, "(ix-0x20) blanked");
  assert.equal(m.mem.read8(BLANK2), 0x00, "(ix-0x40) blanked");
  // 0x8002 saved in E and restored to the entry value.
  assert.equal(m.mem.read8(0x8002), activePlayer, "0x8002 restored to entry (via E)");
  // Both colour columns painted 0x02 end to end.
  assert.equal(m.mem.read8(COL1_FIRST), 0x02, "colour column 1 first cell = 0x02");
  assert.equal(m.mem.read8(COL1_LAST), 0x02, "colour column 1 last cell = 0x02");
  assert.equal(m.mem.read8(COL2_FIRST), 0x02, "colour column 2 first cell = 0x02");
  assert.equal(m.mem.read8(COL2_LAST), 0x02, "colour column 2 last cell = 0x02");
  // The cell just past column 2's end must NOT be painted (loop stopped at 10).
  assert.equal(m.mem.read8((COL2_LAST - 0x20) & 0xffff), 0x00, "column 2 did not overrun");
  // Register end-state: A=0x02, B=0x00, DE=0xFFE0, HL walked one past the last cell.
  assert.equal(m.regs.a, 0x02, "A = 0x02 (colour) at exit");
  assert.equal(m.regs.b, 0x00, "B = 0x00 after both djnz loops");
  assert.equal(m.regs.de, 0xffe0, "DE = 0xFFE0 (-0x20)");
  assert.equal(m.regs.hl, (COL2_LAST - 0x20) & 0xffff, "HL = last cell + DE");
  assert.equal(m.returned, true, "routine returned");
}

// Full invariant for the 1-2 player path (jr nc NOT taken -> call 0x47E1).
function checkPathA(m) {
  assert.equal(m.cycles, 935, "T-state total (jr nc not taken, call 0x47E1)");
  assert.deepEqual(
    m.calls,
    [0x4644, 0x46af, 0x4644, 0x46af, 0x4644, 0x47e1],
    "call sequence: P1/P2 draw + active copy + 1-2 player HUD (0x47E1)",
  );
  checkCommon(m, 0x05);
}

// Full invariant for the 3+ player path (jr nc taken -> call 0x48E5).
function checkPathB(m) {
  assert.equal(m.cycles, 928, "T-state total (jr nc taken, call 0x48E5)");
  assert.deepEqual(
    m.calls,
    [0x4644, 0x46af, 0x4644, 0x46af, 0x4644, 0x48e5],
    "call sequence: P1/P2 draw + active copy + 3+ player HUD (0x48E5)",
  );
  checkCommon(m, 0x05);
}

// (0x8001) = 0x01 -> dec -> 0x00 -> cp 0x02 sets carry -> jr nc NOT taken -> 0x47E1.
function setupPathA(m) {
  m.mem.write8(0x8002, 0x05); // distinctive active-player index, must be restored
  m.mem.write8(0x8001, 0x01); // 1 player
}
// (0x8001) = 0x03 -> dec -> 0x02 -> cp 0x02 clears carry -> jr nc TAKEN -> 0x48E5.
function setupPathB(m) {
  m.mem.write8(0x8002, 0x05);
  m.mem.write8(0x8001, 0x03); // 3 players
}

test("sub_472c 1-2 player path: draws both scores, calls 0x47E1, paints HUD columns", () => {
  const m = new MockMachine();
  setupPathA(m);
  sub_472c(m);
  checkPathA(m);
});

test("sub_472c 3+ player path: jr nc taken selects 0x48E5 instead of 0x47E1", () => {
  const m = new MockMachine();
  setupPathB(m);
  sub_472c(m);
  checkPathB(m);
});

// ---- MUTATION --------------------------------------------------------------
// A faithful copy with ONE deliberate break: the `jr nc,0x476a` at 0x4763 tests
// the WRONG flag (`regs.fC` instead of `regs.fNC`) -- the classic carry-sense
// inversion. On the 1-2 player input (carry SET), the real routine falls through
// to call 0x47E1 (path A, 935 T); the mutant instead branches to call 0x48E5
// (path B, 928 T). checkPathA must reject it on BOTH the call sequence and the
// cycle total -- proving the control-flow invariant has teeth.
function sub_472c_MUTANT(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8002);
  m.step(0x472f, 13);
  regs.e = regs.a;
  m.step(0x4730, 4);
  regs.a = 0x01;
  m.step(0x4732, 7);
  mem.write8(0x8002, regs.a);
  m.step(0x4735, 13);
  m.push16(0x4738);
  m.step(0x4644, 17);
  m.call(0x4644);
  m.push16(0x473b);
  m.step(0x46af, 17);
  m.call(0x46af);
  mem.write8((regs.ix - 0x20) & 0xffff, 0x00);
  m.step(0x473f, 19);
  mem.write8((regs.ix - 0x40) & 0xffff, 0x00);
  m.step(0x4743, 19);
  regs.a = 0x02;
  m.step(0x4745, 7);
  mem.write8(0x8002, regs.a);
  m.step(0x4748, 13);
  m.push16(0x474b);
  m.step(0x4644, 17);
  m.call(0x4644);
  m.push16(0x474e);
  m.step(0x46af, 17);
  m.call(0x46af);
  mem.write8((regs.ix - 0x20) & 0xffff, 0x00);
  m.step(0x4752, 19);
  mem.write8((regs.ix - 0x40) & 0xffff, 0x00);
  m.step(0x4756, 19);
  regs.a = regs.e;
  m.step(0x4757, 4);
  mem.write8(0x8002, regs.a);
  m.step(0x475a, 13);
  m.push16(0x475d);
  m.step(0x4644, 17);
  m.call(0x4644);
  regs.a = mem.read8(0x8001);
  m.step(0x4760, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x4761, 4);
  regs.cp(0x02);
  m.step(0x4763, 7);
  if (regs.fC) {
    // <-- MUTATION: `jr c` (carry) instead of `jr nc` (no-carry)
    m.step(0x476a, 12);
    m.push16(0x476d);
    m.step(0x48e5, 17);
    m.call(0x48e5);
  } else {
    m.step(0x4765, 7);
    m.push16(0x4768);
    m.step(0x47e1, 17);
    m.call(0x47e1);
    m.step(0x476d, 12);
  }
  regs.hl = 0x8ba1;
  m.step(0x4770, 10);
  regs.de = 0xffe0;
  m.step(0x4773, 10);
  regs.a = 0x02;
  m.step(0x4775, 7);
  regs.b = 0x09;
  m.step(0x4777, 7);
  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x4778, 7);
    regs.addHl(regs.de);
    m.step(0x4779, 11);
    if (regs.djnz() !== 0) {
      m.step(0x4777, 13);
    } else {
      m.step(0x477b, 8);
      break;
    }
  }
  regs.hl = 0x8961;
  m.step(0x477e, 10);
  regs.b = 0x0a;
  m.step(0x4780, 7);
  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x4781, 7);
    regs.addHl(regs.de);
    m.step(0x4782, 11);
    if (regs.djnz() !== 0) {
      m.step(0x4780, 13);
    } else {
      m.step(0x4784, 8);
      break;
    }
  }
  m.ret();
}

test("MUTATION caught: `jr c` for `jr nc` calls the wrong HUD routine", () => {
  const good = new MockMachine();
  setupPathA(good);
  sub_472c(good);
  checkPathA(good); // sanity: the real routine passes path A

  const bad = new MockMachine();
  setupPathA(bad);
  sub_472c_MUTANT(bad);
  // The mutant branched the wrong way: called 0x48E5, 928 T, not 0x47E1, 935 T.
  assert.deepEqual(
    bad.calls,
    [0x4644, 0x46af, 0x4644, 0x46af, 0x4644, 0x48e5],
    "mutant calls 0x48E5 (wrong HUD) on the 1-2 player input",
  );
  assert.throws(() => checkPathA(bad), "the invariant checker must reject the mutant");
});
