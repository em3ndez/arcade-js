// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for the loc_0b32 cluster (ROM 0x0b32-0x0c44): loc_0b32 (attract sub-state 6),
// loc_0bb5 (shared handler epilogue), loc_0c2a (IN0 start poll).
// Self-contained mock (real Regs for exact flags, flat 64K RAM). Delegated returning calls push a
// return and the stub balances it (SP += 2); tail-jp targets are recorded the same way (SP is not
// asserted on a jump exit).
//
// Run: node --test games/pooyan/translated/test/loc_0b32.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0b32, loc_0bb5, loc_0c2a } from "../loc_0b32.js";

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
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }
// loc_0c2a wipes 0x8400-0x87fe, which spans the default seat -- seat the stack above the wipe.
function seatCallerHi(m) { m.regs.sp = 0x9000; m.push16(CALLER_RET); }

// ── loc_0b32: all rows equal -> 10-pass verify loop, then timers early-exit via ret nz ──────────
function setupB32PathA(m) {
  seatCaller(m);
  m.mem.write8(0x8d41, 0x02); // dec -> 1, non-zero: jr nz skips call 0x0a28
  m.mem.write8(0x8e50, 0x05); // dec -> 4, non-zero: ret nz fires
}

test("loc_0b32 Path A: 0x82bc rows equal -> verify loop 10x, timer ret nz; 584 T", () => {
  const m = makeMachine();
  setupB32PathA(m);

  loc_0b32(m);

  assert.equal(m.tstates, 584, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.regs.sp, 0x8780, "call push balanced, ret popped the caller");
  assert.deepEqual(m.calls, [0x09f8], "no 0x08b3 trap; 0x0a28 skipped; only 0x09f8");
  const loopLandings = m.pcSeq.filter((p) => p === 0x0b3a).length;
  assert.equal(loopLandings, 10, "verify loop head lands once per pass (10)");
  assert.equal(m.mem.read8(0x8d41), 0x01, "(0x8d41) decremented");
  assert.equal(m.mem.read8(0x8e50), 0x04, "(0x8e50) decremented, ret nz");
});

test("loc_0b32 MUTATION: a dropped loop `cp (hl)` step (7 -> 0) loses 10*7 = 70 T", () => {
  const full = makeMachine();
  setupB32PathA(full);
  loc_0b32(full);

  const mut = makeMachine();
  setupB32PathA(mut);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x0b3d ? 0 : c);
  loc_0b32(mut);

  assert.equal(full.tstates - mut.tstates, 70, "the 10 loop compares contribute 70 T");
  assert.notEqual(mut.tstates, 584, "golden total catches the mutant");
});

test("loc_0b32 row mismatch: first pair differs -> jp nz re-enters 0x08b3", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x82bc, 0x01); // A = 1
  m.mem.write8(0x829c, 0x00); // (hl-0x20) = 0 -> cp != 0 -> jp nz

  loc_0b32(m);

  assert.equal(m.pc, 0x08b3, "jumps to attract sub-state 0 on mismatch");
  assert.deepEqual(m.calls, [0x08b3], "tail-jp to 0x08b3, nothing else");
});

// ── loc_0bb5: (0x8806) armed -> skip scan; (0x882c)!=0x0f -> drop path; (0x8802)=0 -> ret z ──────
test("loc_0bb5 Path A: 0x8806 armed, no coin, no drop -> ret z; 89 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01); // and a -> non-zero: jr nz to 0x0bfc (skip scan)
  m.mem.write8(0x882c, 0x00); // != 0x0f: jr nz to 0x0c1c
  m.mem.write8(0x8802, 0x00); // and a -> zero: ret z

  loc_0bb5(m);

  assert.equal(m.tstates, 89, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.deepEqual(m.calls, [], "no delegates on this path");
  assert.deepEqual(m.pcSeq,
    [0x0bb8, 0x0bb9, 0x0bfc, 0x0bff, 0x0c01, 0x0c1c, 0x0c1f, 0x0c20, CALLER_RET],
    "Path A step boundaries");
});

test("loc_0bb5 MUTATION: a mis-charged jr-taken step (12 -> 0) loses 12 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x882c, 0x00);
  m.mem.write8(0x8802, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0bfc ? 0 : c);
  loc_0bb5(m);
  assert.equal(m.tstates, 77, "mutation loses the 12 T of the jr to 0x0bfc");
  assert.notEqual(m.tstates, 89, "golden total catches the mutant");
});

test("loc_0bb5 coin path: 0x882c==0x0f + 0x8810 bit3 -> call 0x0ecf then jp 0x0dab; 121 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01); // skip scan
  m.mem.write8(0x882c, 0x0f); // coin credited -> stay on this branch
  m.mem.write8(0x8810, 0x08); // bit 3 set -> the 0x0dab builder

  loc_0bb5(m);

  assert.equal(m.tstates, 121, "coin-path T-state total");
  assert.equal(m.pc, 0x0dab, "jumps to the 0x0dab screen builder");
  assert.deepEqual(m.calls, [0x0ecf, 0x0dab], "0x0ecf helper then tail-jp 0x0dab");
  assert.equal(m.regs.hl, 0x0000, "HL cleared before the jump");
});

test("loc_0bb5 scan path: 0x86bc search + rst 0x20 lookup, match -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  // rst 0x20 (loc_0020) does HL += A then A = (HL); emulate that side effect in the stub.
  m.call = (addr) => {
    m.calls.push(addr);
    if (addr === 0x0020) {
      const ea = (m.regs.hl + m.regs.a) & 0xffff;
      m.regs.hl = ea;
      m.regs.a = m.mem.read8(ea);
    }
    m.regs.sp = (m.regs.sp + 2) & 0xffff;
    return undefined;
  };
  m.mem.write8(0x8806, 0x00); // and a zero -> do NOT skip the scan
  m.mem.write8(0x8805, 0x01); // dec -> 0 -> do NOT skip the scan
  m.mem.write8(0x8e51, 0x03); // == 3 -> jr z into the 0x0bd0 scan block
  m.mem.write8(0x20c2, 0x00); // scan byte matches (0x86bc)=0
  m.mem.write8(0x20c3, 0xff); // terminator: inc a -> 0 -> loop exits after one match
  m.mem.write8(0x882c, 0x00); // != 0x0f -> the (0x8802) drop path
  m.mem.write8(0x8802, 0x00); // and a zero -> ret z

  loc_0bb5(m);

  assert.equal(m.pc, CALLER_RET, "returns via ret z after the scan + lookup");
  assert.deepEqual(m.calls, [0x0020], "only the rst 0x20 table lookup delegated");
  assert.equal(m.mem.read8(0x8efe), 0x01, "(0x8efe) bumped on entry to the scan block");
  assert.equal(m.mem.read8(0x89e5), 0x00, "lookup matched -> 0x89e5 NOT armed");
  assert.ok(m.pcSeq.includes(0x0bde), "the 0x86bc scan loop body ran");
});

// ── loc_0c2a: IN0 idle (bit 3 set) -> ret nz; pressed (bit 3 clear) -> state 9 + video wipe ──────
test("loc_0c2a idle: IN0 bit 3 set -> ret nz, no wipe; 32 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0xa080, 0xff); // active-low idle: bit 3 set

  loc_0c2a(m);

  assert.equal(m.tstates, 32, "idle T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.pcSeq, [0x0c2d, 0x0c2f, CALLER_RET], "idle step boundaries");
  assert.equal(m.mem.read8(0x8e51), 0x00, "sub-state untouched");
});

test("loc_0c2a pressed: IN0 bit 3 clear -> sub-state 9 + wipe video RAM to 0x10; loop 1023x", () => {
  const m = makeMachine();
  seatCallerHi(m);
  m.mem.write8(0xa080, 0xf7); // bit 3 clear

  loc_0c2a(m);

  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf routine");
  assert.equal(m.mem.read8(0x8e51), 0x09, "sub-state set to 9");
  assert.equal(m.mem.read8(0x8400), 0x10, "first video cell wiped to 0x10");
  assert.equal(m.mem.read8(0x87fe), 0x10, "last written cell (0x03ff count) wiped");
  assert.equal(m.mem.read8(0x87ff), 0x00, "the 0x03ff count leaves the final cell untouched");
  const loopLandings = m.pcSeq.filter((p) => p === 0x0c3d).length;
  assert.equal(loopLandings, 1023, "the wipe loop head lands 0x03ff times");
});

test("loc_0c2a MUTATION: a dropped wipe `ld (hl),e` step (7 -> 0) loses 1023*7 = 7161 T", () => {
  const full = makeMachine();
  seatCallerHi(full);
  full.mem.write8(0xa080, 0xf7);
  loc_0c2a(full);

  const mut = makeMachine();
  seatCallerHi(mut);
  mut.mem.write8(0xa080, 0xf7);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x0c3e ? 0 : c);
  loc_0c2a(mut);

  assert.equal(full.tstates - mut.tstates, 7161, "the 1023 wipe stores contribute 7161 T");
});
