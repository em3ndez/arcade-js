// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for translated loc_092c (ROM 0x092c, Pooyan) -- attract sub-state 2.
// Frame-timer gate (0x02ce / ret nz), then a copy-protection spin on the ROM byte (0x07f5)==0x11,
// then a 7-byte ROM signature verify (word table[b]@0x0976 via loc_0c45, byte at table[b]+0x1c vs
// (IX) descending from 0x0838). A mismatch jumps into the data word table -> modeled as a throw.
// Success paints the attribute map (0x075d) and queues three rst-0x38 display commands.
//
// Flat-RAM mock (real Regs). The `call` stub records, balances the pushed return (SP += 2), and for
// loc_0c45 seats DE=0x8500 (the table lookup result) so DE+0x1c=0x851c is the compared source byte.
//
// Run: node --test games/pooyan/translated/test/loc_092c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_092c } from "../loc_092c.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x092c, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) {
      this.calls.push(addr);
      regs.sp = (regs.sp + 2) & 0xffff;
      if (addr === 0x0c45) regs.de = 0x8500; // table lookup result
      return undefined;
    },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Frame timer proceeds (Z set -> ret nz not taken), spin passes, all 7 signature bytes match.
function setupPass(m) {
  seatCaller(m);
  m.regs.f = F_Z;            // (0x02ce) is stubbed; seat the Z flag it would leave -> ret nz falls through
  m.mem.write8(0x07f5, 0x11); // spin exits after one compare
  m.mem.write8(0x8e51, 0x02); // sub-state -> 0x03
  m.mem.write8(0x851c, 0x00); // compared source byte (DE=0x8500, +0x1c)
  for (let a = 0x0832; a <= 0x0838; a++) m.mem.write8(a, 0x00); // (IX) descending all match
}

function expectedPassSeq() {
  const seq = [
    0x092e, 0x02ce, 0x0932, 0x02e3, 0x0938, 0x0939, 0x02b9, 0x093f, 0x0941, // preamble
    0x0942, 0x0944, // spin (1 iteration)
    0x0948, 0x094a, // ld ix / ld b
  ];
  for (let i = 0; i < 7; i++) {
    seq.push(0x094d, 0x094e, 0x0c45, 0x0953, 0x0954, 0x0955, 0x0958,
      0x0959, 0x095a, 0x095d, 0x095e, 0x0960, 0x0962);
    seq.push(i < 6 ? 0x094a : 0x0964); // djnz taken 6x, then falls through
  }
  seq.push(0x0967, 0x075d, 0x096d, 0x0038, 0x0970, 0x0038, 0x0974, 0x0038, CALLER_RET);
  return seq;
}

test("loc_092c: full success path -- spin + 7-byte verify + display cmds, ret; 1082 T", () => {
  const m = makeMachine();
  setupPass(m);

  loc_092c(m);

  assert.equal(m.tstates, 1082, "full-path total T");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "all call pushes balanced, ret popped the caller");
  assert.equal(m.mem.read8(0x8e51), 0x03, "sub-state advanced 2 -> 3");
  assert.deepEqual(m.calls,
    [0x02ce, 0x02e3, 0x02b9, 0x0c45, 0x0c45, 0x0c45, 0x0c45, 0x0c45, 0x0c45, 0x0c45,
      0x075d, 0x0038, 0x0038, 0x0038],
    "delegated calls in order (7x loc_0c45, 3x rst 0x38)");
  assert.deepEqual(m.pcSeq, expectedPassSeq(), "full instruction-boundary sequence");
});

test("loc_092c: ret nz early-out while the frame timer counts; 35 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.f = 0x00; // Z clear -> ret nz taken

  loc_092c(m);

  assert.equal(m.tstates, 35, "7 (ld b) + 17 (call) + 11 (ret nz taken)");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.regs.sp, 0x8780, "ret nz popped the caller");
  assert.deepEqual(m.calls, [0x02ce], "only the frame timer ran");
  assert.deepEqual(m.pcSeq, [0x092e, 0x02ce, CALLER_RET], "early-out step boundaries");
});

test("loc_092c: signature mismatch takes the tamper-trap jump into data -> throws", () => {
  const m = makeMachine();
  setupPass(m);
  m.mem.write8(0x0838, 0x01); // first compared (IX) byte no longer matches the 0x00 source

  assert.throws(() => loc_092c(m), /tamper trap jump into data at 0x0976/, "mismatch throws");
});

test("loc_092c MUTATION: per-iteration `ld a,(ix+0)` mis-charged 10T (not 19T) is caught", () => {
  const full = makeMachine();
  setupPass(full);
  loc_092c(full);

  const mut = makeMachine();
  setupPass(mut);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x095d ? 10 : c);
  loc_092c(mut);

  assert.equal(full.tstates - mut.tstates, 63, "the 7 (ix+0) reads lose 9 T each (19 -> 10)");
  assert.notEqual(mut.tstates, 1082, "golden T-state total catches the mutant");
});
