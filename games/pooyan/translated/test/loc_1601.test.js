// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1601 (ROM 0x1601-0x1691, Pooyan) -- gameplay-state idx0 handler
 * (round init). Runs 0x02c9 (bails via `ret nz` if it reported not-done), re-seats the scroll
 * pointer (0x02e3), zero-fills work RAM (0x19bc), blanks two spans via rst 0x10, then either takes
 * the once-per-round first-entry block (rst 0x38 + loc_075d) or skips it, and runs a common tail:
 * copies a 0x3f-byte block into 0x8900 and the 0xff-terminated 0x16ae table into 0x89f0.
 *
 * The mock's `call` POPS the pushed return (modelling each callee's `ret`), so a missing push16
 * desyncs SP and fails the balance tooth. The ONLY load-bearing callee effect is 0x02c9's `dec
 * (0x8809)` flag, consumed by `ret nz` at 0x1604 -- the mock models exactly that (decMem8 on
 * 0x8809). Every other callee runs inert (loc_1601 reloads anything it needs afterward).
 *
 * Path P (skip first-entry, 0x880e==0): full pcSeq + T=2124, tail copies from 0x8940.
 * Path Q (first-entry block, 0x880e!=0, latch clear): exercises rst 0x38 + loc_075d + the 0x8980
 *   ldir source, full pcSeq + T=2282.
 * Path EARLY (0x02c9 dec != 0): `ret nz` at 0x1604 returns immediately.
 * TEETH: mis-charge `inc (hl)` at 0x165a (11 T) as 7 T -> the 2124 golden catches it.
 * POSITIVE CONTROL (performed): deleting push16(0x1604) makes call(0x02c9) pop CALLER_RET, SP ends
 * off by 2, the final ret lands off CALLER_RET and the SP-baseline assertion throws; restored.
 *
 * Run: node --test games/pooyan/translated/test/loc_1601.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1601 } from "../loc_1601.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1601, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The callee's `ret` pops the return address the call site pushed -- model that pop so the stack
    // stays balanced (a missing push16 then desyncs SP and fails the test). The only load-bearing
    // effect is 0x02c9's terminal `dec (0x8809)`, whose Z flag `ret nz` at 0x1604 consumes.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x02c9) regs.decMem8(mem, 0x8809);
      return undefined;
    },
    ldirAt(self, nextAddr) {
      for (;;) {
        const byte = mem.read8(regs.hl);
        mem.write8(regs.de, byte);
        regs.hl = (regs.hl + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff;
        regs.bc = (regs.bc - 1) & 0xffff;
        const n = (regs.a + byte) & 0xff;
        regs.f = (regs.f & (0x80 | 0x40 | 0x01)) | (regs.bc !== 0 ? 0x04 : 0) | (n & 0x08 ? 0x08 : 0) | (n & 0x02 ? 0x20 : 0);
        if (regs.bc === 0) { this.step(nextAddr, 16); return; }
        regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28);
        this.step(self, 21);
      }
    },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// The 0xff-terminated table at ROM 0x16ae (copied into 0x89f0 by the tail loop).
const TABLE = [0x0a, 0x10, 0x1b, 0x1f, 0x1e, 0x11, 0x1d, 0x19, 0xff];
function seedTable(m) { for (let i = 0; i < TABLE.length; i++) m.mem.write8(0x16ae + i, TABLE[i]); }

function ldirBlock(self, next, count) {
  const a = [];
  for (let i = 0; i < count - 1; i++) a.push(self);
  a.push(next);
  return a;
}
// One full pass of the 0x168a table-copy loop (ret z not taken).
const LOOP_ITER = [0x168b, 0x168d, 0x168e, 0x168f, 0x1690, 0x1691, 0x168a];
function tableLoop(fullIters) {
  const a = [];
  for (let i = 0; i < fullIters; i++) a.push(...LOOP_ITER);
  a.push(0x168b, 0x168d, CALLER_RET); // terminator iter: read 0xff -> ret z
  return a;
}

// ---- Path P: 0x880e==0 -> skip first-entry block ----
const PC_P = [
  0x02c9, 0x1605, 0x02e3, 0x19bc, 0x160c, 0x160f, 0x1612, 0x1614, 0x0010,
  0x1618, 0x161a, 0x0010, 0x161e, 0x1621, 0x1624, 0x1625, 0x1627, 0x1653,
  0x1656, 0x1659, 0x165a, 0x165d, 0x1660, 0x1663, 0x1666, 0x1667, 0x166c,
  ...ldirBlock(0x166c, 0x166e, 63),
  0x1671, 0x1672, 0x1679, 0x167c, 0x167d, 0x167e, 0x1681, 0x1684, 0x1687, 0x168a,
  ...tableLoop(8),
];
const GOLDEN_P = 2124;

function setupP(m) {
  seatCaller(m);
  seedTable(m);
  m.mem.write8(0x8809, 0x01); // 0x02c9 dec -> 0 -> Z set -> ret nz not taken (continue)
  m.mem.write8(0x880e, 0x00); // jr z at 0x1627 taken -> skip first-entry block
  m.mem.write8(0x880d, 0x00); // ldir source stays 0x8940
  m.mem.write8(0x8903, 0x00); // jr z at 0x1672 taken
  m.mem.write8(0x8906, 0x00); // ret nz at 0x167d not taken -> table copy
  m.mem.write8(0x880a, 0x00); // inc (hl) -> 1
  m.mem.write8(0x8940, 0xaa); // ldir source marker
}

test("loc_1601 Path P: 0x880e==0 skips first-entry, tail copies table -> ret z", () => {
  const m = makeMachine();
  setupP(m);

  loc_1601(m);

  assert.equal(m.tstates, GOLDEN_P, "Path P T-state total");
  assert.deepEqual(m.pcSeq, PC_P, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret z at 0x168d returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, [0x02c9, 0x02e3, 0x19bc, 0x0010, 0x0010], "no first-entry rst 0x38/loc_075d");
  // writes
  assert.equal(m.mem.read8(0x8d21), 0x00, "(0x8d21) cleared");
  assert.equal(m.mem.read8(0x8f16), 0x00, "(0x8f16) cleared");
  assert.equal(m.mem.read8(0x8f17), 0x00, "(0x8f17) cleared");
  assert.equal(m.mem.read8(0x8808), 0x02, "(0x8808) = 0x02 (A after skip)");
  assert.equal(m.mem.read8(0x880a), 0x01, "(0x880a) incremented 0->1");
  assert.equal(m.mem.read8(0x8900), 0xaa, "ldir copied 0x8940 -> 0x8900");
  assert.equal(m.mem.read8(0x8905), 0x00, "(0x8905) cleared");
  assert.equal(m.mem.read8(0x890a), 0x00, "(0x890a) cleared");
  for (let i = 0; i < 8; i++) {
    assert.equal(m.mem.read8(0x89f0 + i), TABLE[i], `table byte ${i} copied to 0x89f0+${i}`);
  }
  assert.equal(m.regs.a, 0xff, "A = the 0xff terminator (last read)");
  assert.equal(m.regs.de, 0x16b6, "DE points at the terminator");
  assert.equal(m.regs.hl, 0x89f8, "HL advanced past the 8 copied bytes");
});

// ---- Path Q: 0x880e!=0, latch clear -> first-entry block (rst 0x38 + loc_075d) ----
const PC_Q = [
  0x02c9, 0x1605, 0x02e3, 0x19bc, 0x160c, 0x160f, 0x1612, 0x1614, 0x0010,
  0x1618, 0x161a, 0x0010, 0x161e, 0x1621, 0x1624, 0x1625, 0x1627,
  0x1629, 0x162c, 0x162d, 0x162f, 0x1630, 0x1633, 0x1636, 0x1637, 0x163a,
  0x1642, 0x1643, 0x1646, 0x1647, 0x164a, 0x0038, 0x164e, 0x075d, 0x1653,
  0x1656, 0x1659, 0x165a, 0x165d, 0x1660, 0x1663, 0x1666, 0x1667, 0x1669, 0x166c,
  ...ldirBlock(0x166c, 0x166e, 63),
  0x1671, 0x1672, 0x1679, 0x167c, 0x167d, 0x167e, 0x1681, 0x1684, 0x1687, 0x168a,
  ...tableLoop(8),
];
const GOLDEN_Q = 2282;

function setupQ(m) {
  seatCaller(m);
  seedTable(m);
  m.mem.write8(0x8809, 0x01); // continue
  m.mem.write8(0x880e, 0x01); // jr z at 0x1627 NOT taken
  m.mem.write8(0x89e3, 0x00); // latch clear -> jr nz at 0x162d NOT taken -> first entry
  m.mem.write8(0x880f, 0x01); // and a -> Z clear -> jr nz at 0x163a taken -> 0x1642
  m.mem.write8(0x880d, 0x02); // dec a -> 1; ldir source -> 0x8980 (jr z at 0x1667 not taken)
  m.mem.write8(0x8903, 0x00); // jr z at 0x1672 taken
  m.mem.write8(0x8906, 0x00); // ret nz at 0x167d not taken
  m.mem.write8(0x880a, 0x00);
  m.mem.write8(0x8980, 0xbb); // alternate ldir source marker
}

test("loc_1601 Path Q: first-entry block runs rst 0x38 + loc_075d, ldir from 0x8980", () => {
  const m = makeMachine();
  setupQ(m);

  loc_1601(m);

  assert.equal(m.tstates, GOLDEN_Q, "Path Q T-state total");
  assert.deepEqual(m.pcSeq, PC_Q, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret z returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.deepEqual(m.calls, [0x02c9, 0x02e3, 0x19bc, 0x0010, 0x0010, 0x0038, 0x075d],
    "first-entry block adds rst 0x38 (loc_0038) + loc_075d");
  assert.equal(m.mem.read8(0x89e3), 0x01, "once-per-round latch set");
  assert.equal(m.mem.read8(0x881f), 0x00, "0x1642 branch skips the (0x881f) store");
  assert.equal(m.mem.read8(0x8808), 0x80, "(0x8808) = 0x80 (A after first-entry block)");
  assert.equal(m.mem.read8(0x8900), 0xbb, "ldir copied the 0x8980 source -> 0x8900");
  assert.equal(m.mem.read8(0x8931), 0x00, "8903==0 -> (0x8931) fixup skipped");
  for (let i = 0; i < 8; i++) assert.equal(m.mem.read8(0x89f0 + i), TABLE[i], `table byte ${i}`);
});

test("loc_1601 Path EARLY: 0x02c9 reports not-done -> ret nz at 0x1604", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8809, 0x05); // 0x02c9 dec -> 0x04 -> Z clear -> ret nz taken

  loc_1601(m);

  assert.equal(m.tstates, 17 + 11, "call 0x02c9 (17) + ret nz taken (11)");
  assert.deepEqual(m.pcSeq, [0x02c9, CALLER_RET], "call target then immediate ret");
  assert.equal(m.pc, CALLER_RET, "ret nz to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, [0x02c9], "only 0x02c9 ran");
  assert.equal(m.mem.read8(0x8809), 0x04, "(0x8809) decremented 0x05 -> 0x04");
});

test("loc_1601 MUTATION: `inc (hl)` at 0x165a mis-charged 7T (not 11) is caught", () => {
  const m = makeMachine();
  setupP(m);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x165a ? 7 : cycles);

  loc_1601(m);

  assert.equal(m.tstates, GOLDEN_P - 4, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, GOLDEN_P, "Path P T-state total"),
    /Path P T-state total/,
    "the 2124-T golden must fail on the mutant",
  );
});
