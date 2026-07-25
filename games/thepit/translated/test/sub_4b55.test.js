// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_4b55 (ROM 0x4b55-0x4bc6, The Pit): decode the DSW byte at
// 0xb000 into a block of gameplay-parameter bytes (0x804c..0x8053) plus two LS259
// latch writes (0xb006/0xb007); if DSW bit 7 is set, TAIL-jump to loc_4f47, else ret.
//
// There is no built Pit Machine yet, so the routine is driven against a minimal mock
// of the Machine surface it touches: a real Regs (so and/xor/sub/inc/dec/sla flags and
// the fZ/fNZ tests are genuine), a real Pit AddressSpace (so the 0xb000 DSW read, the
// work-RAM writes, and the 0xb006/0xb007 LS259 latch writes hit the true memory map),
// a `step` that accumulates T-states + records the PC-boundary sequence, a `ret` that
// pops the sentinel return address, and a `call` that captures the conditional
// tail-jump (target + machine state at the jump) and returns a sentinel.
//
// Two full paths are pinned against the disassembly:
//   * DSW=0x00  -> (DSW&3)!=3 cluster, every jr resolves so as to keep the constants,
//                  jp nz NOT taken -> the real ret. Exact 419 T-state total, the full
//                  0x804c..0x8053 parameter block, the boundary sequence (stepcheck),
//                  and the ret landing on the caller.
//   * DSW=0xFF  -> the mirror path (HL=0x0000, every one-bit adjust applies), exercising
//                  the CONDITIONAL TAIL-jump: jp nz taken -> return m.call(0x4f47) with
//                  no ret. 373 T at the jump, the decoded block, and the args into 0x4f47.
//
// TEETH: a faithful twin with the core `and c` (0x4baa) swapped for `or c` -- the
// compensating-error-prone fold at 0x4ba6 -- must be CAUGHT by the DSW=0xFF contract
// (it changes 0x8051 from 0x02 to 0x08 and the LS259 b6/b7 datum from 1 to 0).
//
// Run: node --test games/thepit/translated/test/sub_4b55.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_S, F_C } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_4b55 } from "../sub_4b55.js";

const RET = 0x1234; // sentinel return address the `ret` path must pop
const TAIL = 0x4f47; // loc_4f47, the conditional tail-jump target
const SENTINEL = "RET_FROM_4f47"; // stands in for loc_4f47's return-through

function makeMachine({ dsw = 0x00, mem8002 = 0x00, f = 0x00 } = {}) {
  const io = new Io();
  io.dsw = dsw & 0xff; // 0xb000 read returns this
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  mem.write8(0x8002, mem8002 & 0xff); // seed the byte the 0x4ba6 fold reads
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)
  regs.f = f & 0xff;

  const m = {
    regs,
    mem,
    io,
    tstates: 0,
    pc: 0x4b55,
    pcSeq: [], // every step target, in order (stepcheck)
    returned: false,
    tail: null, // captured tail dispatch, if the jp is taken
    step(addr, cycles) {
      this.pc = addr;
      this.tstates += cycles;
      this.pcSeq.push(addr);
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
      this.returned = true;
    },
    call(addr) {
      // Conditional tail-jump modelled as `return m.call(target)`: capture the
      // machine state at the instant control leaves sub_4b55 and hand back a sentinel.
      this.tail = {
        addr,
        cyclesAtJump: this.tstates,
        a: regs.a & 0xff,
        b: regs.b & 0xff,
        c: regs.c & 0xff,
        d: regs.d & 0xff,
        hl: regs.hl,
      };
      return SENTINEL;
    },
  };
  m.push16(RET); // the return address sub_4b55's `ret` must pop on the non-tail path
  return m;
}

// -- DSW = 0x00 : the ret path -----------------------------------------------

// Instruction-boundary sequence for DSW=0x00, straight off the disassembly.
const EXPECTED_PC_SEQ_00 = [
  0x4b58, 0x4b59, 0x4b5b, 0x4b5d, // ld a / ld b,a / and / xor
  0x4b64, 0x4b67, 0x4b69,         // jr nz taken -> loc_4b64; ld hl,0201; bit 0,b
  0x4b70, 0x4b72,                 // jr z taken -> loc_4b70; bit 1,b
  0x4b77,                         // jr z taken -> loc_4b77 (HL stays 0x0201)
  0x4b7a, 0x4b7c, 0x4b7e,         // ld (804c),hl; ld a,0c; bit 2,b
  0x4b80, 0x4b82,                 // jr nz NOT taken -> 4b80; sub 0x02
  0x4b85, 0x4b87, 0x4b89,         // ld (804e),a; ld a,37; bit 3,b
  0x4b8d,                         // jr z taken -> loc_4b8d
  0x4b90, 0x4b92, 0x4b94,         // ld (804f),a; ld a,00; bit 4,b
  0x4b97,                         // jr z taken -> loc_4b97
  0x4b9a, 0x4b9b, 0x4b9d, 0x4b9f, // ld (8050),a; ld d,a; ld a,00; bit 5,b
  0x4ba2,                         // jr z taken -> loc_4ba2
  0x4ba5, 0x4ba6, 0x4ba9, 0x4baa, 0x4bab, 0x4bac, // ld c,a; ld a,(8002); dec; and c; xor d; ld (b006),a
  0x4baf, 0x4bb2, 0x4bb4,         // ld (b007),a; sla a; ld (8051),a
  0x4bb7, 0x4bb9, 0x4bbb,         // ld a,03; bit 6,b
  0x4bbe,                         // jr z taken -> loc_4bbe
  0x4bc1, 0x4bc3,                 // ld (8053),a; bit 7,b
  0x4bc6,                         // jp nz NOT taken -> 4bc6 (fall to ret)
];

test("DSW=0x00: decodes the parameter block, 419 T, boundaries, returns", () => {
  const m = makeMachine({ dsw: 0x00, mem8002: 0x00 });
  const ret = sub_4b55(m);

  // 0x804c word = 0x0201 (the (DSW&3)!=3 default, both low bits clear).
  assert.equal(m.mem.read8(0x804c), 0x01, "0x804c = L of HL(0x0201)");
  assert.equal(m.mem.read8(0x804d), 0x02, "0x804d = H of HL(0x0201)");
  // bit 2 clear -> 0x0c - 0x02.
  assert.equal(m.mem.read8(0x804e), 0x0a, "0x804e = 0x0c - 0x02 (bit 2 clear)");
  // bit 3 set (jr z taken) -> 0x37 unadjusted.
  assert.equal(m.mem.read8(0x804f), 0x37, "0x804f = 0x37 (bit 3 clear -> no sub)");
  assert.equal(m.mem.read8(0x8050), 0x00, "0x8050 = 0x00 (bit 4 clear)");
  assert.equal(m.mem.read8(0x8052), 0x00, "0x8052 = 0x00 (bit 5 clear)");
  // fold: a=(0x00 dec = 0xff) & c(0x00) ^ d(0x00) = 0x00; 0x8051 = 0x00<<1 = 0x00.
  assert.equal(m.mem.read8(0x8051), 0x00, "0x8051 = fold(0x00)<<1");
  assert.equal(m.io.latch & 0xc0, 0x00, "LS259 b6/b7 clear (fold byte bit0 = 0)");
  assert.equal(m.mem.read8(0x8053), 0x03, "0x8053 = 0x03 (bit 6 clear)");

  // Control flow: bit 7 clear -> jp nz NOT taken -> ret to the caller.
  assert.equal(m.tail, null, "no tail-jump (DSW bit 7 clear)");
  assert.equal(m.returned, true, "ret executed");
  assert.equal(m.pc, RET, "ret popped the sentinel return address");
  assert.equal(ret, undefined, "the ret path returns nothing");

  // Exact local T-state total for this path.
  assert.equal(m.tstates, 419, "DSW=0x00 path is 419 T");

  // stepcheck: every step target is a real instruction boundary, in order.
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_00, "step targets match the disassembly boundaries");
  console.log("  sub_4b55 DSW=0x00: 419 T, block=[01 02|0a|37|00|00|00(0x8051)|03], ret");
});

test("DSW=0x00: touches only A/B/C/D/HL/F -- flags at exit are from bit 7,b", () => {
  const seedF = F_S | F_C; // prove the seeded flags do NOT survive to the exit
  const m = makeMachine({ dsw: 0x00, f: seedF });
  sub_4b55(m);
  // bit 7,b with b=0x00 -> Z set (+H, +PV since !bit sets PV); seeded S/C are gone.
  assert.equal((m.regs.f & 0x40) !== 0, true, "Z set by the final bit 7,b (b bit7 = 0)");
  assert.equal(m.regs.f & F_S, 0, "S cleared -- flags come from bit 7,b, not the caller");
});

// -- DSW = 0xFF : the conditional tail-jump path -----------------------------

// Shared contract for the DSW=0xFF path (0x8002 seeded to 0x05), used by the real
// run and the TEETH twin so the mutation is measured against the same assertions.
function checkContractFF(m, ret) {
  // HL=0x0000 (the (DSW&3)==3 arm), so the 0x804c word is zero.
  assert.equal(m.mem.read8(0x804c), 0x00, "0x804c = 0x00 (HL=0x0000 arm)");
  assert.equal(m.mem.read8(0x804d), 0x00, "0x804d = 0x00");
  assert.equal(m.mem.read8(0x804e), 0x0c, "0x804e = 0x0c (bit 2 set -> no sub)");
  assert.equal(m.mem.read8(0x804f), 0x2d, "0x804f = 0x37 - 0x0a (bit 3 set)");
  assert.equal(m.mem.read8(0x8050), 0x01, "0x8050 = 0x01 (bit 4 set -> inc)");
  assert.equal(m.mem.read8(0x8052), 0x01, "0x8052 = 0x01 (bit 5 set -> inc)");
  // fold: a = ((0x05 dec = 0x04) AND c(0x01)) XOR d(0x01) = 0x00 ^ 0x01 = 0x01.
  // 0x8051 = 0x01 << 1 = 0x02; LS259 b6/b7 datum = 0x01 & 1 = 1 -> both set.
  assert.equal(m.mem.read8(0x8051), 0x02, "0x8051 = fold(0x01)<<1 = 0x02");
  assert.equal(m.io.latch & 0xc0, 0xc0, "LS259 b6 AND b7 set (fold byte bit0 = 1)");
  assert.equal(m.mem.read8(0x8053), 0x04, "0x8053 = 0x03 + 1 (bit 6 set -> inc)");

  // Control flow: bit 7 set -> jp nz taken -> return m.call(0x4f47), no ret.
  assert.ok(m.tail, "must have tail-jumped (DSW bit 7 set)");
  assert.equal(m.tail.addr, TAIL, "tail-jump target must be loc_4f47");
  assert.equal(ret, SENTINEL, "sub_4b55 returns loc_4f47's result straight through");
  assert.equal(m.returned, false, "no ret executed on the tail path (single unwind)");
  assert.equal(m.tail.cyclesAtJump, 373, "DSW=0xFF path is 373 T up to and incl. the jp");

  // Args live into loc_4f47.
  assert.equal(m.tail.a, 0x04, "A into loc_4f47 = 0x8053's value 0x04");
  assert.equal(m.tail.b, 0xff, "B (whole DSW) preserved = 0xFF");
  assert.equal(m.tail.c, 0x01, "C = the bit-5 datum 0x01");
  assert.equal(m.tail.d, 0x01, "D = the bit-4 datum 0x01");
  assert.equal(m.tail.hl, 0x0000, "HL = 0x0000");
}

test("DSW=0xFF: mirror path decodes the block and tail-jumps to loc_4f47", () => {
  const m = makeMachine({ dsw: 0xff, mem8002: 0x05 });
  const ret = sub_4b55(m);
  checkContractFF(m, ret);
  console.log("  sub_4b55 DSW=0xFF: 373 T, block=[00 00|0c|2d|01|01|02(0x8051)|04], jp -> 0x4f47");
});

// -- TEETH -------------------------------------------------------------------
// A faithful copy of sub_4b55 with EXACTLY ONE break: the core fold's `and c`
// (0x4baa, a1) is swapped for `or c` (b1) -- an opcode neighbour and the classic
// compensating-error site (a masked-then-xored byte feeds THREE sinks: 0xb006,
// 0xb007 and 0x8051). On the DSW=0xFF/0x8002=0x05 path the fold flips from 0x01 to
// 0x04, so 0x8051 becomes 0x08 (not 0x02) and the LS259 b6/b7 datum's bit0 becomes 0
// (latch b6/b7 CLEAR, not set). The DSW=0xFF contract rejects it on both.
function brokenSub4b55(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0xb000);
  m.step(0x4b58, 13);
  regs.b = regs.a;
  m.step(0x4b59, 4);
  regs.and(0x03);
  m.step(0x4b5b, 7);
  regs.xor(0x03);
  m.step(0x4b5d, 7);
  if (regs.fNZ) {
    m.step(0x4b64, 12);
    regs.hl = 0x0201;
    m.step(0x4b67, 10);
    regs.bit(0, regs.b);
    m.step(0x4b69, 8);
    if (regs.fZ) {
      m.step(0x4b70, 12);
      regs.bit(1, regs.b);
      m.step(0x4b72, 8);
      if (regs.fZ) {
        m.step(0x4b77, 12);
      } else {
        m.step(0x4b74, 7);
        regs.hl = 0x0402;
        m.step(0x4b77, 10);
      }
    } else {
      m.step(0x4b6b, 7);
      regs.hl = 0x0302;
      m.step(0x4b6e, 10);
      m.step(0x4b77, 12);
    }
  } else {
    m.step(0x4b5f, 7);
    regs.hl = 0x0000;
    m.step(0x4b62, 10);
    m.step(0x4b77, 12);
  }
  mem.write16(0x804c, regs.hl);
  m.step(0x4b7a, 16);
  regs.a = 0x0c;
  m.step(0x4b7c, 7);
  regs.bit(2, regs.b);
  m.step(0x4b7e, 8);
  if (regs.fNZ) {
    m.step(0x4b82, 12);
  } else {
    m.step(0x4b80, 7);
    regs.sub(0x02);
    m.step(0x4b82, 7);
  }
  mem.write8(0x804e, regs.a);
  m.step(0x4b85, 13);
  regs.a = 0x37;
  m.step(0x4b87, 7);
  regs.bit(3, regs.b);
  m.step(0x4b89, 8);
  if (regs.fZ) {
    m.step(0x4b8d, 12);
  } else {
    m.step(0x4b8b, 7);
    regs.sub(0x0a);
    m.step(0x4b8d, 7);
  }
  mem.write8(0x804f, regs.a);
  m.step(0x4b90, 13);
  regs.a = 0x00;
  m.step(0x4b92, 7);
  regs.bit(4, regs.b);
  m.step(0x4b94, 8);
  if (regs.fZ) {
    m.step(0x4b97, 12);
  } else {
    m.step(0x4b96, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x4b97, 4);
  }
  mem.write8(0x8050, regs.a);
  m.step(0x4b9a, 13);
  regs.d = regs.a;
  m.step(0x4b9b, 4);
  regs.a = 0x00;
  m.step(0x4b9d, 7);
  regs.bit(5, regs.b);
  m.step(0x4b9f, 8);
  if (regs.fZ) {
    m.step(0x4ba2, 12);
  } else {
    m.step(0x4ba1, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x4ba2, 4);
  }
  mem.write8(0x8052, regs.a);
  m.step(0x4ba5, 13);
  regs.c = regs.a;
  m.step(0x4ba6, 4);
  regs.a = mem.read8(0x8002);
  m.step(0x4ba9, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x4baa, 4);
  regs.or(regs.c); // BUG: `or c` instead of `and c` (0x4baa a1)
  m.step(0x4bab, 4);
  regs.xor(regs.d);
  m.step(0x4bac, 4);
  mem.write8(0xb006, regs.a, 10);
  m.step(0x4baf, 13);
  mem.write8(0xb007, regs.a, 10);
  m.step(0x4bb2, 13);
  regs.a = regs.sla(regs.a);
  m.step(0x4bb4, 8);
  mem.write8(0x8051, regs.a);
  m.step(0x4bb7, 13);
  regs.a = 0x03;
  m.step(0x4bb9, 7);
  regs.bit(6, regs.b);
  m.step(0x4bbb, 8);
  if (regs.fZ) {
    m.step(0x4bbe, 12);
  } else {
    m.step(0x4bbd, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x4bbe, 4);
  }
  mem.write8(0x8053, regs.a);
  m.step(0x4bc1, 13);
  regs.bit(7, regs.b);
  m.step(0x4bc3, 8);
  if (regs.fNZ) {
    m.step(0x4f47, 10);
    return m.call(0x4f47);
  }
  m.step(0x4bc6, 10);
  m.ret();
}

test("TEETH: the `and c` -> `or c` twin is CAUGHT by the DSW=0xFF contract", () => {
  // The real routine passes the contract.
  {
    const m = makeMachine({ dsw: 0xff, mem8002: 0x05 });
    checkContractFF(m, sub_4b55(m));
  }
  // The mutant fails it -- 0x8051 and the LS259 b6/b7 datum both diverge.
  const m = makeMachine({ dsw: 0xff, mem8002: 0x05 });
  const ret = brokenSub4b55(m);
  assert.throws(
    () => checkContractFF(m, ret),
    /0x8051|b6 AND b7/,
    "the contract FAILED to catch and-c -> or-c -- it has no teeth",
  );
  // Concretely: the fold flipped 0x01 -> 0x04, so 0x8051 = 0x08 and b6/b7 clear.
  assert.equal(m.mem.read8(0x8051), 0x08, "mutant: 0x8051 = fold(0x04)<<1 = 0x08");
  assert.equal(m.io.latch & 0xc0, 0x00, "mutant: LS259 b6/b7 clear (fold byte bit0 = 0)");
});
