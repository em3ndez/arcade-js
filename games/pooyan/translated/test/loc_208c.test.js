// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_208c (ROM 0x208c-0x20a9): the table-match check. Self-contained mock
// machine (real Regs for exact flags, flat 64K RAM). Every exit is a `ret`; the seated CALLER_RET
// proves the exit. loc_208c is a leaf (no calls). Boundaries are MAME-confirmed (see the source).
//
// Run: node --test games/pooyan/translated/test/loc_208c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_208c } from "../loc_208c.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Seed matching tables: DE[i] at 0x20aa+i, HL[i] at 0x066d+8*i (HL strides +8: 0x066d..0x06e5).
function seedMatch(m) {
  for (let i = 0; i < 0x10; i++) {
    const v = (0x40 + i) & 0xff;
    m.mem.write8(0x20aa + i, v);
    m.mem.write8(0x066d + 8 * i, v);
  }
}

test("loc_208c: all 0x10 entries match -> clean ret, (0x8ef0) untouched; 1168 T", () => {
  const m = makeMachine();
  seatCaller(m);
  seedMatch(m);

  loc_208c(m);

  assert.equal(m.tstates, 1168, "full-match T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.mem.read8(0x8ef0), 0x00, "match -> flag NOT set");
  assert.equal(m.pcSeq.filter((p) => p === 0x2095).length, 0x10, "loop body runs 16 times");
});

test("loc_208c: first mismatch -> (0x8ef0)=1, early ret; 71 T", () => {
  const m = makeMachine();
  seatCaller(m);
  seedMatch(m);
  m.mem.write8(0x20aa, 0x00); // DE[0] != HL[0] -> mismatch on iteration 1

  loc_208c(m);

  // prologue 27 + (2095:7,2096:7, jr nz taken 20a4:12, 20a6:7, 20a9:13) 46 + ret 10 = 83
  assert.equal(m.tstates, 27 + 7 + 7 + 12 + 7 + 13 + 10, "mismatch-on-first path T");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.mem.read8(0x8ef0), 0x01, "mismatch -> (0x8ef0)=1");
  assert.deepEqual(m.calls, [], "leaf");
});

test("loc_208c MUTATION: dropping the `cp (hl)` step (0x2096) loses 16*7=112 T", () => {
  const good = makeMachine(); seatCaller(good); seedMatch(good); loc_208c(good);
  const mut = makeMachine(); seatCaller(mut); seedMatch(mut);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x2096 ? 0 : c);
  loc_208c(mut);
  assert.equal(good.tstates - mut.tstates, 16 * 7, "16 cp-steps contribute 112 T");
  assert.notEqual(mut.tstates, 1168, "golden total catches the dropped step");
});
