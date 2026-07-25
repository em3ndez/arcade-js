// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated sub_33da (ROM 0x33DA-0x340F, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags
 * + exact cpir, a flat 64K RAM so the ROM-region search tables at 0x34FE/0x35FE
 * are writable, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine is exercised in isolation without a ROM image. Asserts the T-state
 * totals, the register/flag/memory/control-flow effects on all three control
 * paths against the disassembly, plus a deliberate mutation the invariant
 * checker must catch.
 *
 * Run: node --test games/thepit/translated/test/sub_33da.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { sub_33da } from "../sub_33da.js";

// Minimal machine matching the surface sub_33da uses: regs, mem, step, ret,
// push16/pop16. `tstates` accumulates charged cycles; `pc` tracks the last step
// target; `returned` records that a `ret`/`ret cc` fired.
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
  return {
    regs,
    mem,
    ram,
    tstates: 0,
    pc: 0x33da,
    returned: false,
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
      this.returned = true;
      this.step(this.pop16(), cycles); // pops the caller's return address
    },
  };
}

// Seat a return address on the stack so any `ret`/`ret cc` pops a known value.
const CALLER_RET = 0xabcd;
function seatCaller(m) {
  m.regs.sp = 0x8780; // inside The Pit work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
}

// ---- Path A: FULL path -- both searches hit -------------------------------
// (0x808d) = 0x05  -> add 0x20 -> de = 0x0025
// (0x8089) = 0x8200 -> hl = 0x8200-0x20 = 0x81e0 -> (0x8134) = 0x81e0
// (0x81e0) = 0x42 = key1 ; table1 base = 0x34fe+0x25 = 0x3523, hit at 0x3526 (n1=4)
// (0x808d) != 0 -> second search: sub 0x20 -> de = 0x00e5
//   ix = 0x81e0 ; key2 = (0x81e1) = 0x77 ; table2 base = 0x35fe+0xe5 = 0x36e3,
//   hit at 0x36e4 (n2=2)
function setupFull(m) {
  seatCaller(m);
  m.mem.write8(0x808d, 0x05);
  m.mem.write16(0x8089, 0x8200);
  m.mem.write8(0x81e0, 0x42); // key1, read via (hl)
  m.mem.write8(0x81e1, 0x77); // key2, read via (ix+0x01)
  m.mem.write8(0x3526, 0x42); // first-table match (offset 3 from 0x3523)
  m.mem.write8(0x36e4, 0x77); // second-table match (offset 1 from 0x36e3)
}

// The invariants that define correct behaviour on the full path. Shared by the
// real-routine test and the mutation test so the mutation is caught by exactly
// the checks that pass for the real routine.
function checkFull(m) {
  assert.equal(m.tstates, 356, "T-state total (cpir n1=4, n2=2, both ret-not-taken)");
  assert.equal(m.mem.read16(0x8134), 0x81e0, "(0x8134) = (0x8089) - 0x20");
  assert.equal(m.regs.ix, 0x81e0, "ix reloaded from (0x8134)");
  assert.equal(m.regs.a, 0x77, "A holds key2 through the second cpir");
  assert.equal(m.regs.hl, 0x36e5, "hl left one past the second-table match (post-inc)");
  assert.equal(m.regs.bc, 0x001e, "bc = 0x20 - 2 after the second cpir");
  assert.equal(m.regs.fZ, true, "final Z set (second search matched)");
  assert.equal(m.pc, CALLER_RET, "final ret popped the caller's return address");
  assert.equal(m.returned, true, "routine returned");
}

test("sub_33da Path A: both cpir searches hit, ix/hl/a as disassembled", () => {
  const m = makeMachine();
  setupFull(m);
  sub_33da(m);
  checkFull(m);
});

// ---- Path B: first search MISSES -> ret nz --------------------------------
test("sub_33da Path B: key1 absent -> cpir exhausts 32 entries -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x808d, 0x05);
  m.mem.write16(0x8089, 0x8200);
  m.mem.write8(0x81e0, 0x99); // key1 that appears nowhere in the zeroed table

  sub_33da(m);

  // block1 (122) + cpir n=32 (21*31+16 = 667) + ret nz taken (11) = 800
  assert.equal(m.tstates, 800, "block1 + full 32-entry cpir + ret nz taken");
  assert.equal(m.mem.read16(0x8134), 0x81e0, "(0x8134) written before the branch");
  assert.equal(m.regs.fNZ, true, "cpir exhausted BC without a match -> NZ");
  assert.equal(m.regs.ix, 0xffff, "second block never ran -- ix untouched (power-on 0xFFFF)");
  assert.equal(m.pc, CALLER_RET, "ret nz popped the caller's return address");
  assert.equal(m.returned, true, "routine returned via ret nz");
});

// ---- Path C: first hit but (0x808d) == 0 -> ret z -------------------------
test("sub_33da Path C: first hit but (0x808d)==0 -> ret z, no second search", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x808d, 0x00); // add 0x20 -> de = 0x20 ; and a -> Z later
  m.mem.write16(0x8089, 0x8200);
  m.mem.write8(0x81e0, 0x42); // key1
  m.mem.write8(0x351e, 0x42); // table1 base 0x34fe+0x20=0x351e -> hit at n1=1

  sub_33da(m);

  // block1 (122) + cpir n=1 (16) + ret nz not taken (5) + ld a (13) + and a (4)
  //   + ret z taken (11) = 171
  assert.equal(m.tstates, 171, "block1 + cpir n=1 + ret-nz-skip + ld/and + ret z");
  assert.equal(m.mem.read16(0x8134), 0x81e0, "(0x8134) still seeded");
  assert.equal(m.regs.ix, 0xffff, "second block never ran -- ix untouched");
  assert.equal(m.pc, CALLER_RET, "ret z popped the caller's return address");
  assert.equal(m.returned, true, "routine returned via ret z");
});

// ---- MUTATION: the 0xFFE0 (=-0x20) offset must have teeth ------------------
// A faithful copy of the translation with ONE deliberate break: `ld bc,0xffe0`
// at 0x33E5 replaced by `ld bc,0x0020` -- a realistic slip, because the IMMEDIATE
// sibling sub_3425 (ROM 0x3425) genuinely does `ld bc,0x0020 / add hl,bc` at that
// same spot. The mutant computes hl = (0x8089) + 0x20 = 0x8220 instead of 0x81e0,
// so (0x8134), ix, the keys and the search all shift -- which checkFull rejects.
function sub_33da_MUTANT(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x808d);
  m.step(0x33dd, 13);
  regs.add(0x20);
  m.step(0x33df, 7);
  regs.e = regs.a;
  m.step(0x33e0, 4);
  regs.d = 0x00;
  m.step(0x33e2, 7);
  regs.hl = mem.read16(0x8089);
  m.step(0x33e5, 16);
  regs.bc = 0x0020; // <-- MUTATION: 0x0020 instead of 0xffe0 (+0x20, not -0x20)
  m.step(0x33e8, 10);
  regs.addHl(regs.bc);
  m.step(0x33e9, 11);
  mem.write16(0x8134, regs.hl);
  m.step(0x33ec, 16);
  regs.a = mem.read8(regs.hl);
  m.step(0x33ed, 7);
  regs.hl = 0x34fe;
  m.step(0x33f0, 10);
  regs.addHl(regs.de);
  m.step(0x33f1, 11);
  regs.bc = 0x0020;
  m.step(0x33f4, 10);
  const n1 = regs.cpir(mem);
  m.step(0x33f6, 21 * (n1 - 1) + 16);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x33f7, 5);
  regs.a = mem.read8(0x808d);
  m.step(0x33fa, 13);
  regs.and(regs.a);
  m.step(0x33fb, 4);
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x33fc, 5);
  regs.sub(0x20);
  m.step(0x33fe, 7);
  regs.e = regs.a;
  m.step(0x33ff, 4);
  regs.ix = mem.read16(0x8134);
  m.step(0x3403, 20);
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x3406, 19);
  regs.hl = 0x35fe;
  m.step(0x3409, 10);
  regs.addHl(regs.de);
  m.step(0x340a, 11);
  regs.bc = 0x0020;
  m.step(0x340d, 10);
  const n2 = regs.cpir(mem);
  m.step(0x340f, 21 * (n2 - 1) + 16);
  m.ret(10);
}

test("sub_33da MUTATION caught: `ld bc,0x0020` for `ld bc,0xffe0` shifts the pointer", () => {
  const good = makeMachine();
  setupFull(good);
  sub_33da(good);
  checkFull(good); // sanity: the real routine passes the invariants

  const bad = makeMachine();
  setupFull(bad);
  sub_33da_MUTANT(bad);
  assert.equal(bad.mem.read16(0x8134), 0x8220, "mutant computes (0x8089) + 0x20 = 0x8220");
  assert.throws(() => checkFull(bad), "the invariant checker must reject the mutant");
});
