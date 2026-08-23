// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_1c66 (ROM 0x1c66-0x1ce6): the 0x15a8-table dispatch master. Ticks the
// (0x8808) phase timer; unarmed/not-expired -> loc_7e94 path. When (0x8e2a) is armed and the timer
// expires it fills 8 cells at 0x855f then checksums 0x82bc (C = sum of 0x0a bytes, stride -0x20)
// which must equal 0xaa or it ret-nz aborts; on a pass it disarms (0x8e2a) and branches on the
// (0x880e)/(0x880d)/(0x8948) flags to loc_1d15, loc_1cf6, or falls through into loc_1ce7. Self-
// contained mock; returning callees balance SP += 2 and rst 0x10 applies HL += B / B = 0.
//
// Run: node --test games/pooyan/translated/test/loc_1c66.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1c66 } from "../loc_1c66.js";

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
function installBalancingCalls(m) {
  m.call = (a) => {
    m.calls.push(a);
    m.regs.sp = (m.regs.sp + 2) & 0xffff;
    if (a === 0x0010) { m.regs.hl = (m.regs.hl + m.regs.b) & 0xffff; m.regs.b = 0; }
    return undefined;
  };
}

test("loc_1c66 unarmed: (0x8e2a)=0 -> loc_7e94, (0x89fc) clear -> ret z; 95 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  // (0x8e2a)=0 unarmed, (0x89fc)=0 clear (both default) -> jr z,0x1c74 then ret z

  loc_1c66(m);

  assert.equal(m.tstates, 95, "unarmed ret-z T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.deepEqual(m.calls, [0x7e94], "not re-initialising -> loc_7e94 only");
  assert.equal(m.mem.read8(0x8808), 0xff, "phase timer decremented (wrapped from 0)");
  assert.deepEqual(m.pcSeq, [0x1c69, 0x1c6a, 0x1c6d, 0x1c6e, 0x1c74, 0x7e94, 0x1c7a, 0x1c7b, CALLER_RET], "boundaries");
});

test("loc_1c66 checksum mismatch: armed+expired, sum!=0xaa -> ret nz, (0x8e2a) stays armed; 831 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8e2a, 0x01); // armed
  m.mem.write8(0x8808, 0x01); // dec -> 0, timer expired
  // 0x82bc.. all 0 -> checksum 0 != 0xaa

  loc_1c66(m);

  assert.equal(m.tstates, 831, "checksum-mismatch T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.calls, [], "aborts before any dispatch");
  assert.equal(m.mem.read8(0x855f), 0x10, "0x855f block filled before the checksum");
  assert.equal(m.mem.read8(0x8e2a), 0x01, "(0x8e2a) NOT disarmed on abort");
  assert.equal(m.pcSeq.filter((p) => p === 0x1cb4).length, 0x0a, "checksum sums 0x0a bytes");
});

test("loc_1c66 pass -> loc_1d15: (0x880e)=0 dispatch; 871 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8e2a, 0x01);
  m.mem.write8(0x8808, 0x01);
  m.mem.write8(0x82bc, 0xaa); // one byte -> sum 0xaa passes
  m.mem.write8(0x880e, 0x00); // -> jr z,0x1d15

  loc_1c66(m);

  assert.equal(m.tstates, 871, "pass->1d15 T-state total");
  assert.equal(m.pc, 0x1d15, "delegates to loc_1d15");
  assert.deepEqual(m.calls, [0x1d15], "single dispatch call");
  assert.equal(m.mem.read8(0x8e2a), 0x00, "(0x8e2a) disarmed on a passing checksum");
});

test("loc_1c66 pass -> loc_1cf6: (0x880e)!=0,(0x880d)=0 dispatch; 895 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8e2a, 0x01);
  m.mem.write8(0x8808, 0x01);
  m.mem.write8(0x82bc, 0xaa);
  m.mem.write8(0x880e, 0x05); // nonzero -> skip 0x1d15
  m.mem.write8(0x880d, 0x00); // -> jr z,0x1cf6

  loc_1c66(m);

  assert.equal(m.tstates, 895, "pass->1cf6 T-state total");
  assert.equal(m.pc, 0x1cf6, "delegates to loc_1cf6");
  assert.deepEqual(m.calls, [0x1cf6], "single dispatch call");
});

test("loc_1c66 pass -> fall into loc_1ce7: all flags set; rst 0x10 + loc_02e3 then tail 0x1ce7; 1006 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8e2a, 0x01);
  m.mem.write8(0x8808, 0x01);
  m.mem.write8(0x82bc, 0xaa);
  m.mem.write8(0x880e, 0x05);
  m.mem.write8(0x880d, 0x05);
  m.mem.write8(0x8948, 0x05); // all nonzero -> in-place reseed, fall into loc_1ce7

  loc_1c66(m);

  assert.equal(m.tstates, 1006, "fall-into-1ce7 T-state total");
  assert.deepEqual(m.calls, [0x0010, 0x02e3, 0x1ce7], "rst 0x10 fill, loc_02e3, tail into loc_1ce7");
  assert.equal(m.pc, 0x02e3, "last executed step is loc_02e3; the 0x1ce7 tail is a record-only call");
  assert.equal(m.mem.read8(0x880d), 0x00, "(0x880d) cleared");
  assert.equal(m.mem.read8(0x880a), 0x00, "(0x880a) cleared");
  assert.equal(m.mem.read8(0x881f), 0x01, "(0x881f)=1");
});

test("loc_1c66 MUTATION: dropping the `ld a,(hl)` checksum step (0x1cb4) loses 0x0a*7 T", () => {
  const m = makeMachine(); seatCaller(m); installBalancingCalls(m);
  m.mem.write8(0x8e2a, 0x01); m.mem.write8(0x8808, 0x01);
  m.mem.write8(0x82bc, 0xaa); m.mem.write8(0x880e, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1cb4 ? 0 : c);
  loc_1c66(m);
  assert.equal(871 - m.tstates, 0x0a * 7, "10 checksum reads contribute 70 T");
});
