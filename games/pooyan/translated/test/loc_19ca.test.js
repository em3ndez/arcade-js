// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_19ca (ROM 0x19ca, Pooyan) -- the periodic warning-siren tick.
 * Gated on (0x8806)==0 and (0x8d68)!=0; a countdown at 0x8d6a expires, reloads to 0x18, toggles a
 * phase bit at 0x8d69, and queues one of two sound commands (DE=0x060f / 0x068f) via rst 0x38.
 *
 * The mock's `call` POPS the return address the rst pushed (modelling the handler's `ret`), so a
 * missing push16 before the rst desyncs SP and the following ret pops garbage -- the stack tooth.
 *
 * Run: node --test games/pooyan/translated/test/loc_19ca.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_19ca } from "../loc_19ca.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x19ca, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
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
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Countdown expires (0x8d6a: 1 -> 0) and reloads. dec l -> HL=0x8d69 (phase byte).
function setupExpire(m, phaseByte) {
  seatCaller(m);
  m.mem.write8(0x8806, 0x00);  // gate open
  m.mem.write8(0x8d68, 0x01);  // enabled
  m.mem.write8(0x8d6a, 0x01);  // countdown -> 0 on this tick
  m.mem.write8(0x8d69, phaseByte);
}

test("loc_19ca Path PHASE-A: phase bit clear -> DE=0x060f, phase byte -> 0x01, rst 0x38", () => {
  const m = makeMachine();
  setupExpire(m, 0x00); // bit0 clear -> jr nz not taken

  loc_19ca(m);

  assert.equal(m.tstates, 144, "Path PHASE-A T-state total");
  assert.deepEqual(m.pcSeq, [
    0x19cd, 0x19ce, 0x19cf, 0x19d2, 0x19d3, 0x19d4, 0x19d7, 0x19d8, 0x19d9,
    0x19db, 0x19dc, 0x19de, 0x19e0, 0x19e2, 0x19e5, 0x0038, CALLER_RET,
  ], "phase-A path; rst 0x38 steps to 0x0038");
  assert.deepEqual(m.calls, [0x0038], "sound command queued via rst 0x38");
  assert.equal(m.mem.read8(0x8d6a), 0x18, "countdown reloaded");
  assert.equal(m.mem.read8(0x8d69), 0x01, "phase byte set to 0x01");
  assert.equal(m.regs.de, 0x060f, "DE = phase-A sound id");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (rst push matched handler ret)");
});

test("loc_19ca Path PHASE-B: phase bit set -> DE=0x068f, phase byte -> 0x00, rst 0x38", () => {
  const m = makeMachine();
  setupExpire(m, 0x01); // bit0 set -> jr nz taken

  loc_19ca(m);

  assert.equal(m.tstates, 149, "Path PHASE-B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x19cd, 0x19ce, 0x19cf, 0x19d2, 0x19d3, 0x19d4, 0x19d7, 0x19d8, 0x19d9,
    0x19db, 0x19dc, 0x19de, 0x19e7, 0x19e9, 0x19ec, 0x0038, CALLER_RET,
  ], "phase-B path via jr nz");
  assert.deepEqual(m.calls, [0x0038]);
  assert.equal(m.mem.read8(0x8d69), 0x00, "phase byte cleared to 0x00");
  assert.equal(m.regs.de, 0x068f, "DE = phase-B sound id");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_19ca Path GATE: 0x8806 non-zero -> ret nz immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01);

  loc_19ca(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ld a + and a + ret nz");
  assert.deepEqual(m.pcSeq, [0x19cd, 0x19ce, CALLER_RET]);
  assert.deepEqual(m.calls, []);
});

test("loc_19ca Path COUNTDOWN: countdown not yet expired -> ret nz at 0x19d8", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00);
  m.mem.write8(0x8d68, 0x01);
  m.mem.write8(0x8d6a, 0x05); // -> 0x04, non-zero

  loc_19ca(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 13 + 4 + 5 + 10 + 11 + 11, "Path COUNTDOWN T total");
  assert.deepEqual(m.pcSeq, [
    0x19cd, 0x19ce, 0x19cf, 0x19d2, 0x19d3, 0x19d4, 0x19d7, 0x19d8, CALLER_RET,
  ], "ret nz at 0x19d8, no reload");
  assert.equal(m.mem.read8(0x8d6a), 0x04, "countdown decremented, not reloaded");
  assert.deepEqual(m.calls, [], "no sound queued");
});

test("loc_19ca Path DISABLED: 0x8d68 zero -> ret z at 0x19d3", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00);
  m.mem.write8(0x8d68, 0x00); // disabled -> ret z

  loc_19ca(m);

  assert.equal(m.tstates, 13 + 4 + 5 + 13 + 4 + 11, "Path DISABLED T total");
  assert.deepEqual(m.pcSeq, [0x19cd, 0x19ce, 0x19cf, 0x19d2, 0x19d3, CALLER_RET]);
});

test("loc_19ca MUTATION: `dec (hl)` mis-charged 10T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x19d8 ? 10 : cycles);
  setupExpire(m, 0x00);

  loc_19ca(m);

  assert.equal(m.tstates, 143, "mutation loses 1 T");
  assert.throws(
    () => assert.equal(m.tstates, 144, "Path PHASE-A T-state total"),
    /144/,
    "the 144-T golden must fail on the mutant",
  );
});
