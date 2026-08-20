// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1bab (ROM 0x1bab-0x1bcb, Pooyan) -- a leaf 0x15a8 handler.
 * If both 0x880e and 0x8988 are nonzero it latches 0x880d=1; then it ldir-copies the 0x3f-byte
 * block 0x8900..0x893e -> 0x8940..0x897e, clears 0x880a, and returns. No calls -> the only stack
 * op is the terminal `ret`, whose pop returns to the seated caller. Self-contained mock (real
 * Regs, flat 64K RAM, real ldirAt mirroring Machine.ldirAt, popping call).
 *
 * Paths: Z1 (0x880e==0 -> first jr z), Z2 (0x880e!=0, 0x8988==0 -> second jr z),
 * LATCH (both !=0 -> 0x880d=1). All three converge on the ldir + tail; each pins full pcSeq + T.
 * TEETH: mis-charge `ld a,(0x880e)` (13 T) as 7 T -> the golden catches it.
 * POSITIVE CONTROL: no push16 exists in this leaf; the mischarged-step variant is the
 * proof-of-failure instead (per the loc_19bc pattern for push16-free leaves).
 *
 * Run: node --test games/pooyan/translated/test/loc_1bab.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1bab } from "../loc_1bab.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1bab, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // A popping call so a missing push16 would desync SP (this leaf has no calls, but keep the idiom).
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; },
    // Mirrors Machine.ldirAt: LDIR with the exact per-iteration flag and 21/16 T timing.
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

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// dirty the destination window + seed a source pattern so the copy is observable
function seedBlock(m) {
  for (let i = 0; i < 0x3f; i++) {
    m.mem.write8(0x8900 + i, (i + 1) & 0xff); // source pattern 1..0x3f
    m.mem.write8(0x8940 + i, 0x77);            // destination pre-dirtied
  }
  m.mem.write8(0x8900, 0xaa);       // first source byte
  m.mem.write8(0x893e, 0xbb);       // last source byte (i = 0x3e)
  m.mem.write8(0x880a, 0x55);       // will be cleared
  m.mem.write8(0x880d, 0x99);       // latched only on the LATCH path
}

function ldirBlock(self, next, count) {
  const a = [];
  for (let i = 0; i < count - 1; i++) a.push(self);
  a.push(next);
  return a;
}

// shared tail once control reaches 0x1bbc
const TAIL = [0x1bbf, 0x1bc2, 0x1bc5, ...ldirBlock(0x1bc5, 0x1bc7, 0x3f), 0x1bc8, 0x1bcb, CALLER_RET];
// 10+10+10 setup + ldir(62*21+16=1318) + xor a 4 + ld (nn),a 13 + ret 10
const TAIL_T = 30 + 1318 + 4 + 13 + 10; // 1375

function assertBlockCopied(m) {
  assert.equal(m.mem.read8(0x8940), 0xaa, "first dest byte copied from source");
  assert.equal(m.mem.read8(0x897e), 0xbb, "last dest byte (i=0x3e) copied from source");
  assert.equal(m.mem.read8(0x8941), 0x02, "second dest byte matches source pattern");
  assert.equal(m.mem.read8(0x880a), 0x00, "0x880a cleared");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [], "leaf -- no calls");
}

test("loc_1bab Z1: 0x880e==0 -> first jr z, no latch", () => {
  const m = makeMachine();
  seatCaller(m);
  seedBlock(m);
  m.mem.write8(0x880e, 0x00);

  loc_1bab(m);

  assert.deepEqual(m.pcSeq, [0x1bae, 0x1baf, 0x1bbc, ...TAIL], "Z1 step boundaries");
  assert.equal(m.tstates, 13 + 4 + 12 + TAIL_T, "Z1 T-state total"); // 1404
  assertBlockCopied(m);
  assert.equal(m.mem.read8(0x880d), 0x99, "0x880d untouched (no latch)");
});

test("loc_1bab Z2: 0x880e!=0, 0x8988==0 -> second jr z, no latch", () => {
  const m = makeMachine();
  seatCaller(m);
  seedBlock(m);
  m.mem.write8(0x880e, 0x01);
  m.mem.write8(0x8988, 0x00);

  loc_1bab(m);

  assert.deepEqual(m.pcSeq, [0x1bae, 0x1baf, 0x1bb1, 0x1bb4, 0x1bb5, 0x1bbc, ...TAIL], "Z2 step boundaries");
  assert.equal(m.tstates, 13 + 4 + 7 + 13 + 4 + 12 + TAIL_T, "Z2 T-state total"); // 1428
  assertBlockCopied(m);
  assert.equal(m.mem.read8(0x880d), 0x99, "0x880d untouched (no latch)");
});

test("loc_1bab LATCH: both nonzero -> 0x880d=1", () => {
  const m = makeMachine();
  seatCaller(m);
  seedBlock(m);
  m.mem.write8(0x880e, 0x01);
  m.mem.write8(0x8988, 0x01);

  loc_1bab(m);

  assert.deepEqual(
    m.pcSeq,
    [0x1bae, 0x1baf, 0x1bb1, 0x1bb4, 0x1bb5, 0x1bb7, 0x1bb9, 0x1bbc, ...TAIL],
    "LATCH step boundaries",
  );
  assert.equal(m.tstates, 13 + 4 + 7 + 13 + 4 + 7 + 7 + 13 + TAIL_T, "LATCH T-state total"); // 1443
  assertBlockCopied(m);
  assert.equal(m.mem.read8(0x880d), 0x01, "0x880d latched to 1");
});

test("loc_1bab MUTATION: `ld a,(0x880e)` mis-charged 7T (not 13) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  seedBlock(m);
  m.mem.write8(0x880e, 0x00);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1bae ? 7 : cycles);

  loc_1bab(m);

  assert.equal(m.tstates, 1404 - 6, "mutation loses 6 T (13 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 1404, "Z1 T-state total"),
    /T-state total/,
    "the 1404-T golden must fail on the mutant",
  );
});
