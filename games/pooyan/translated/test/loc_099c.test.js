// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for translated loc_099c (ROM 0x099c, Pooyan) -- attract sub-state 4.
// Frame-timer gate (0x02ce / ret nz), a spin-verify of 0x0d ROM byte pairs (0x07c9.. vs 0x0a65..),
// attribute-map fill (0x075d) + rst-0x38 display cmd, a 256-byte zero-fill of the 0x8b70 bank
// (rst 0x10, B=0), a loc_0a0c object-build loop until the 0x0a7e entry byte reads 0xff, two init
// calls (0x0a52 / 0x0a25), two vector seats (0x8e54/0x8e56), the 0x8e50 block, then FALL-THROUGH
// into loc_09f8 (modeled as a tail `m.call(0x09f8)`).
//
// Flat-RAM mock (real Regs). The `call` stub records + balances (SP += 2). The 0x0a0c stub does NOT
// advance DE (the real routine does), so mem[0x0a7e]=0xff makes the build loop exit after one pass.
// The final tail into loc_09f8 is stubbed; its SP += 2 models loc_09f8 eventually ret'ing to caller.
//
// Run: node --test games/pooyan/translated/test/loc_099c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_099c } from "../loc_099c.js";

const CALLER_RET = 0xabcd;
const F_Z = 0x40;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x099c, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

function setupPass(m) {
  seatCaller(m);
  m.regs.f = F_Z;             // (0x02ce) stubbed; Z seated -> ret nz falls through
  for (let i = 0; i < 0x0d; i++) { m.mem.write8(0x07c9 + i, 0); m.mem.write8(0x0a65 + i, 0); } // pairs match
  m.mem.write8(0x0a7e, 0xff); // build loop exits after one pass
  m.mem.write8(0x8e51, 0x04); // sub-state -> 0x05
}

function expectedPassSeq() {
  const seq = [0x099e, 0x02ce, 0x09a2, 0x09a4, 0x09a7, 0x09aa];
  for (let i = 0; i < 0x0d; i++) {
    seq.push(0x09ab, 0x09ac, 0x09ae, 0x09af, 0x09b0, 0x09b1);
    seq.push(i < 0x0c ? 0x09aa : 0x09b3); // jr nz taken 12x, then falls through
  }
  seq.push(0x09b6, 0x075d, 0x09bc, 0x0038, 0x09c0, 0x09c1, 0x09c2, 0x0010); // block2
  seq.push(0x09c6, 0x09c9, 0x09cd); // block3
  seq.push(0x0a0c, 0x09d3, 0x09d5, 0x09d6, 0x09d7, 0x09d9); // build loop (1 pass)
  seq.push(0x0a52, 0x0a25, 0x09e2, 0x09e5, 0x09e8, 0x09eb, 0x09ee,
    0x09f0, 0x09f1, 0x09f2, 0x09f3, 0x09f5, 0x09f6, 0x09f8); // block4 -> fall through
  return seq;
}

test("loc_099c: full path -- spin-verify + fills + build loop + fall-through into loc_09f8; 1008 T", () => {
  const m = makeMachine();
  setupPass(m);

  loc_099c(m);

  assert.equal(m.tstates, 1008, "full-path total T");
  assert.equal(m.pc, 0x09f8, "last step is the fall-through into loc_09f8");
  assert.equal(m.regs.sp, 0x8780, "mid-body calls balanced; loc_09f8's tail consumes the caller slot");
  assert.deepEqual(m.calls,
    [0x02ce, 0x075d, 0x0038, 0x0010, 0x0a0c, 0x0a52, 0x0a25, 0x09f8],
    "delegated calls in order, ending with the loc_09f8 fall-through");
  assert.equal(m.mem.read16(0x8e54), 0x0a87, "(0x8e54) vector");
  assert.equal(m.mem.read16(0x8e56), 0x8648, "(0x8e56) vector");
  assert.equal(m.mem.read8(0x8e50), 0x32, "(0x8e50) block byte");
  assert.equal(m.mem.read8(0x8e51), 0x05, "(0x8e51) sub-state advanced 4 -> 5");
  assert.equal(m.mem.read8(0x8e52), 0x0d, "(0x8e52) block byte");
  assert.equal(m.mem.read8(0x8e53), 0x05, "(0x8e53) block byte");
  assert.deepEqual(m.pcSeq, expectedPassSeq(), "full instruction-boundary sequence");
});

test("loc_099c: ret nz early-out while the frame timer counts; 35 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.f = 0x00; // Z clear -> ret nz taken

  loc_099c(m);

  assert.equal(m.tstates, 35, "7 (ld b) + 17 (call) + 11 (ret nz taken)");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.regs.sp, 0x8780, "ret nz popped the caller");
  assert.deepEqual(m.calls, [0x02ce], "only the frame timer ran");
  assert.deepEqual(m.pcSeq, [0x099e, 0x02ce, CALLER_RET], "early-out step boundaries");
});

test("loc_099c MUTATION: per-iteration `dec d` step dropped (0T) loses 13x4 T", () => {
  const full = makeMachine();
  setupPass(full);
  loc_099c(full);

  const mut = makeMachine();
  setupPass(mut);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x09b1 ? 0 : c);
  loc_099c(mut);

  assert.equal(full.tstates - mut.tstates, 52, "the 0x0d verify iterations each charge dec d 4 T");
  assert.notEqual(mut.tstates, 1008, "golden T-state total catches the dropped step");
});
