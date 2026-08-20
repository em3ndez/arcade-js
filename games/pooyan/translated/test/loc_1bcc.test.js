// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1bcc (ROM 0x1bcc-0x1c02, Pooyan) -- a leaf 0x15a8 handler.
 * If 0x8948 is nonzero it clears 0x880d; then it ldir-copies 0x8900..0x893e -> 0x8980..0x89be
 * (0x3f bytes, leaving DE=0x89bf), clears 0x880a, and runs a 0x0e-iteration checksum over ROM at
 * 0x5328: each byte masked to 5 bits is added to E (the leftover DE low byte 0xbf), carrying into
 * D. If the result is E==0x60 and D==0x8a it returns; otherwise it bumps 0x8a38 and returns. No
 * calls -> the only stack op is the terminal `ret`. Self-contained mock (real Regs, flat 64K RAM,
 * real ldirAt mirroring Machine.ldirAt, popping call).
 *
 * Paths cover every branch outcome:
 *   A: 0x8948!=0 (jr z NOT taken, 0x880d=0); all-zero ROM -> no carries -> E=0xbf -> jr nz taken -> bump 0x8a38.
 *   B: 0x8948==0 (jr z taken); ROM yields E=0x60,D=0x8a with ONE carry -> jr nz not taken, ret z TAKEN.
 *   C: 0x8948==0 (jr z taken); ROM (0xff bytes, masked) yields E=0x60,D=0x8b with TWO carries -> ret z NOT taken -> bump 0x8a38.
 * TEETH: mis-charge `ld de,0x8980` (10 T) as 4 T -> the golden catches it.
 * POSITIVE CONTROL: no push16 exists in this leaf; the mischarged-step variant is the proof-of-failure.
 *
 * Run: node --test games/pooyan/translated/test/loc_1bcc.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1bcc } from "../loc_1bcc.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1bcc, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
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

function seedBlock(m) {
  for (let i = 0; i < 0x3f; i++) {
    m.mem.write8(0x8900 + i, (i + 1) & 0xff); // source pattern 1..0x3f
    m.mem.write8(0x8980 + i, 0x77);            // destination pre-dirtied
  }
  m.mem.write8(0x8900, 0xaa);       // first source byte
  m.mem.write8(0x893e, 0xbb);       // last source byte (i = 0x3e)
  m.mem.write8(0x880a, 0x55);       // will be cleared
  m.mem.write8(0x880d, 0x99);       // cleared only when 0x8948 != 0
  m.mem.write8(0x8a38, 0x10);       // checksum-miss counter
}

function setRom(m, bytes) {
  for (let i = 0; i < 14; i++) m.mem.write8(0x5328 + i, bytes[i]);
}

function ldirBlock(self, next, count) {
  const a = [];
  for (let i = 0; i < count - 1; i++) a.push(self);
  a.push(next);
  return a;
}

// Loop body pcSeq for 14 iterations; carry[i]=true means jr nc NOT taken (inc d executed).
function loopSeq(carry) {
  const a = [];
  for (let i = 0; i < 14; i++) {
    a.push(0x1beb, 0x1bed, 0x1bee, 0x1bef);
    if (carry[i]) a.push(0x1bf1, 0x1bf2); else a.push(0x1bf2);
    a.push(0x1bf3);
    a.push(i < 13 ? 0x1bea : 0x1bf5);
  }
  return a;
}

// setup after the jr z, through `ld b,0x0e` (ends on the first loop-top landing 0x1bea)
const MID = [0x1bd9, 0x1bdc, 0x1bdf, ...ldirBlock(0x1bdf, 0x1be1, 0x3f), 0x1be2, 0x1be5, 0x1be8, 0x1bea];
// 10+10+10 + ldir(1318) + xor a 4 + ld(nn)a 13 + ld hl 10 + ld b 7 = 1382
const MID_T = 30 + 1318 + 4 + 13 + 10 + 7;

function assertBlockCopied(m) {
  assert.equal(m.mem.read8(0x8980), 0xaa, "first dest byte copied from source");
  assert.equal(m.mem.read8(0x89be), 0xbb, "last dest byte (i=0x3e) copied from source");
  assert.equal(m.mem.read8(0x8981), 0x02, "second dest byte matches source pattern");
  assert.equal(m.mem.read8(0x880a), 0x00, "0x880a cleared");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [], "leaf -- no calls");
}

test("loc_1bcc A: 0x8948!=0 (jr z not taken), zero checksum -> jr nz taken -> bump 0x8a38", () => {
  const m = makeMachine();
  seatCaller(m);
  seedBlock(m);
  m.mem.write8(0x8948, 0x01); // jr z not taken -> clear 0x880d
  setRom(m, new Array(14).fill(0x00));

  loc_1bcc(m);

  const carry = new Array(14).fill(false);
  assert.deepEqual(
    m.pcSeq,
    [0x1bcf, 0x1bd0, 0x1bd2, 0x1bd3, 0x1bd6, ...MID, ...loopSeq(carry), 0x1bf7, 0x1bf8, 0x1bfe, 0x1c01, 0x1c02, CALLER_RET],
    "A step boundaries",
  );
  // prefix 41 + MID 1382 + loop(737-0) + suffix(7+4+12 jr nz taken +10+11+10)=54
  assert.equal(m.tstates, 41 + MID_T + 737 + 54, "A T-state total"); // 2214
  assertBlockCopied(m);
  assert.equal(m.mem.read8(0x880d), 0x00, "0x880d cleared (0x8948 nonzero)");
  assert.equal(m.regs.e, 0xbf, "E unchanged by zero checksum");
  assert.equal(m.regs.d, 0x89, "D unchanged (no carry)");
  assert.equal(m.mem.read8(0x8a38), 0x11, "0x8a38 bumped (checksum miss)");
});

test("loc_1bcc B: 0x8948==0 (jr z taken), E=0x60 D=0x8a (1 carry) -> ret z taken", () => {
  const m = makeMachine();
  seatCaller(m);
  seedBlock(m);
  m.mem.write8(0x8948, 0x00); // jr z taken -> skip clearing 0x880d
  setRom(m, [0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x06, 0, 0, 0, 0, 0, 0, 0, 0]);

  loc_1bcc(m);

  const carry = [false, false, true, false, false, false, false, false, false, false, false, false, false, false];
  assert.deepEqual(
    m.pcSeq,
    [0x1bcf, 0x1bd0, 0x1bd6, ...MID, ...loopSeq(carry), 0x1bf7, 0x1bf8, 0x1bfa, 0x1bfc, 0x1bfd, CALLER_RET],
    "B step boundaries",
  );
  // prefix 29 + MID 1382 + loop(737-1=736) + suffix(7+4+7 jr nz not +7+4+11 ret z taken)=40
  assert.equal(m.tstates, 29 + MID_T + 736 + 40, "B T-state total"); // 2187
  assertBlockCopied(m);
  assert.equal(m.mem.read8(0x880d), 0x99, "0x880d untouched (jr z taken)");
  assert.equal(m.regs.e, 0x60, "E == 0x60");
  assert.equal(m.regs.d, 0x8a, "D == 0x8a");
  assert.equal(m.mem.read8(0x8a38), 0x10, "0x8a38 NOT bumped (checksum matched)");
});

test("loc_1bcc C: 0x8948==0, masked 0xff bytes -> E=0x60 D=0x8b (2 carries) -> ret z not taken -> bump", () => {
  const m = makeMachine();
  seatCaller(m);
  seedBlock(m);
  m.mem.write8(0x8948, 0x00);
  setRom(m, [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x0e]);

  loc_1bcc(m);

  const carry = [false, false, true, false, false, false, false, false, false, false, true, false, false, false];
  assert.deepEqual(
    m.pcSeq,
    [0x1bcf, 0x1bd0, 0x1bd6, ...MID, ...loopSeq(carry), 0x1bf7, 0x1bf8, 0x1bfa, 0x1bfc, 0x1bfd, 0x1bfe, 0x1c01, 0x1c02, CALLER_RET],
    "C step boundaries",
  );
  // prefix 29 + MID 1382 + loop(737-2=735) + suffix(7+4+7+7+4+5 ret z not +10+11+10)=65
  assert.equal(m.tstates, 29 + MID_T + 735 + 65, "C T-state total"); // 2211
  assertBlockCopied(m);
  assert.equal(m.mem.read8(0x880d), 0x99, "0x880d untouched (jr z taken)");
  assert.equal(m.regs.e, 0x60, "E == 0x60 (0xff masked to 0x1f)");
  assert.equal(m.regs.d, 0x8b, "D == 0x8b (two carries)");
  assert.equal(m.mem.read8(0x8a38), 0x11, "0x8a38 bumped (checksum miss)");
});

test("loc_1bcc MUTATION: `ld de,0x8980` mis-charged 4T (not 10) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  seedBlock(m);
  m.mem.write8(0x8948, 0x01);
  setRom(m, new Array(14).fill(0x00));
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1bd9 ? 4 : cycles);

  loc_1bcc(m);

  assert.equal(m.tstates, 2214 - 6, "mutation loses 6 T (10 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 2214, "A T-state total"),
    /T-state total/,
    "the 2214-T golden must fail on the mutant",
  );
});
