// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_4bc7 (ROM 0x4BC7, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags, a
 * flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. Asserts the T-state total, both
 * fill-table memory effects, the register/flag exit state, and the tail-jump
 * control flow against the disassembly, plus a deliberate mutation the golden
 * assertions must catch.
 *
 *   4bc7  21 80 82   ld hl,0x8280   (10)
 *   4bca  06 20      ld b,0x20      (7)
 *   loop1 x32: ld (hl),0x24 (10) + inc hl (6) + djnz (13 taken / 8 last)
 *   4bd1  21 39 80   ld hl,0x8039   (10)
 *   4bd4  06 03      ld b,0x03      (7)
 *   loop2 x3: 5*(ld (hl),n=10 + inc hl=6) + djnz (13 taken / 8 last)
 *   4be7  c3 ca 4c   jp 0x4cca      (10, tail-jump)
 *
 * T-states: 17 + [32*16 + 31*13 + 8] + 17 + [3*80 + 2*13 + 8] + 10
 *         = 17 + 923 + 17 + 274 + 10 = 1241.
 *
 * Run: node --test games/thepit/translated/test/loc_4bc7.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_S, F_C } from "../../../../core/cpu/z80.js";
import { loc_4bc7 } from "../loc_4bc7.js";

// Minimal machine matching the surface loc_4bc7 uses: regs, mem, step, call, ret,
// push16/pop16. `calls` records every m.call target in order; `tstates` accumulates
// charged cycles; `pc` tracks the last step target.
function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  regs.sp = 0x8780; // inside work RAM, though this routine pushes/pops nothing
  return {
    regs,
    mem,
    ram,
    calls: [],
    tstates: 0,
    pc: 0x4bc7,
    step(nextAddr, cycles) {
      this.pc = nextAddr;
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
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callees are stubbed in this isolated draft harness
    },
  };
}

// The record loop 2 writes three times, at 0x8039, 0x803e, 0x8043.
const RECORD = [0x10, 0x0a, 0x16, 0x00, 0x00];

// Golden assertions in one function so the mutation test can prove they fire.
function assertGolden(m) {
  // --- T-state total ---
  assert.equal(m.tstates, 1241, "T-state total");

  // --- Loop 1: 0x8280..0x829F all 0x24, and the boundary byte 0x82A0 untouched ---
  for (let a = 0x8280; a <= 0x829f; a++) {
    assert.equal(m.mem.read8(a), 0x24, `loop1 filled 0x${a.toString(16)} = 0x24`);
  }
  assert.equal(m.mem.read8(0x82a0), 0x00, "loop1 stops at 0x829F: 0x82A0 untouched");
  assert.equal(m.mem.read8(0x827f), 0x00, "loop1 starts at 0x8280: 0x827F untouched");

  // --- Loop 2: three 5-byte records at 0x8039, 0x803e, 0x8043 ---
  for (const base of [0x8039, 0x803e, 0x8043]) {
    for (let i = 0; i < RECORD.length; i++) {
      assert.equal(
        m.mem.read8(base + i),
        RECORD[i],
        `record@0x${base.toString(16)} byte ${i} = 0x${RECORD[i].toString(16)}`,
      );
    }
  }
  assert.equal(m.mem.read8(0x8038), 0x00, "loop2 starts at 0x8039: 0x8038 untouched");
  assert.equal(m.mem.read8(0x8048), 0x00, "loop2 ends at 0x8047: 0x8048 untouched");

  // --- Registers at exit ---
  assert.equal(m.regs.b, 0x00, "B decremented to 0 by the final djnz");
  assert.equal(m.regs.hl, 0x8048, "HL walked to 0x8048 (past the last record)");

  // --- Control flow: unconditional tail-jump to 0x4cca, no ret ---
  assert.deepEqual(m.calls, [0x4cca], "single tail-jump to 0x4cca");
  assert.equal(m.pc, 0x4cca, "PC ends at the tail-jump target 0x4cca");
}

function run(m) {
  loc_4bc7(m);
}

test("loc_4bc7: fills both tables, tail-jumps to 0x4cca, 1241 T", () => {
  const m = makeMachine();
  run(m);
  assertGolden(m);
});

test("loc_4bc7 touches no flags: F residue is the caller's", () => {
  const seedF = F_S | F_C; // an arbitrary non-trivial flag pattern
  const m = makeMachine();
  m.regs.f = seedF;
  run(m);
  assert.equal(m.regs.f, seedF, "ld / inc hl / djnz / jp leave F unchanged");
});

// ---- MUTATION: off-by-one loop-1 count (ld b,0x1F instead of 0x20) ----------------
// A classic fill-count slip: loading 0x1F loops only 31 times, leaving the LAST byte
// 0x829F unwritten (0x00). It also loses one iteration's worth of T-states, so BOTH
// the memory-boundary and the T-state assertions must reject it -- two independent
// teeth. (loop1 with 31 iters = 31*16 + 30*13 + 8 = 894, so total = 1212, not 1241.)
function loc_4bc7_mut(m) {
  const { regs, mem } = m;
  regs.hl = 0x8280;
  m.step(0x4bca, 10);
  regs.b = 0x1f; // BUG: 0x1F (31) instead of 0x20 (32) -- leaves 0x829F unwritten
  m.step(0x4bcc, 7);
  do {
    mem.write8(regs.hl, 0x24);
    m.step(0x4bce, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4bcf, 6);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4bcc : 0x4bd1, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  regs.hl = 0x8039;
  m.step(0x4bd4, 10);
  regs.b = 0x03;
  m.step(0x4bd6, 7);
  do {
    for (const v of RECORD) {
      mem.write8(regs.hl, v);
      m.step(0x4bd8, 10); // representative address; only the total matters here
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x4bd9, 6);
    }
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4bd6 : 0x4be7, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  m.step(0x4cca, 10);
  return m.call(0x4cca);
}

test("loc_4bc7 MUTATION: ld b,0x1F (fill 31 not 32) is caught", () => {
  const good = makeMachine();
  run(good);
  assertGolden(good); // the real routine passes

  const mut = makeMachine();
  loc_4bc7_mut(mut);
  assert.equal(mut.mem.read8(0x829f), 0x00, "mutant leaves 0x829F unwritten");
  assert.equal(mut.tstates, 1212, "mutant loses one loop-1 iteration (1241 -> 1212)");
  assert.throws(
    () => assertGolden(mut),
    /0x829f = 0x24|T-state total/,
    "the golden assertions must reject the off-by-one mutant",
  );
});
