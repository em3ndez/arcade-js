// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_362d (ROM 0x362d, Pooyan) -- the (ix+0x06) phase dispatch.
 * Phase < 7 tail-jumps to loc_361d; phase >= 0x14 tail-jumps to loc_3625; a timer gate lets phase
 * 0x13 ret early; otherwise a delay byte (0x8d6b) counts down, and when it reaches 0 (with B < 0x80)
 * an offset from table 0x368e is looked up via rst 0x20 (loc_0020) and stored, falling into loc_365d.
 *
 * The mock's `call` POPS the pushed return (modelling the callee's `ret`); for loc_0020 it also
 * applies that helper's net effect (HL += A, then A = mem[HL]) so the stored byte is exercised.
 * The rst push16(0x365c) + loc_0020's pop stay balanced; the final tail delegate's pop unwinds
 * the seated caller return, so a missing push16 desyncs SP -- the stack-fidelity tooth.
 *
 * Paths: JC (phase<7 tail), JNC (phase>=0x14 tail), DELAY (dec(hl)+ret), FULL (rst 0x20 + fall
 * through to loc_365d). TEETH: mis-charge the rst (11->10) and assert the golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_362d.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_362d } from "../loc_362d.js";

const CALLER_RET = 0xabcd;
const IX = 0x8c00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x362d, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed. loc_0020 additionally does
    // HL += A then A = mem[HL] (its documented net effect); the tail delegates (0x361d/0x3625/0x365d)
    // just pop and record so a forgotten push16 unbalances SP.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) {
        const idx = regs.a;
        regs.hl = (regs.hl + idx) & 0xffff;
        regs.a = mem.read8(regs.hl);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_362d Path JC: phase < 7 -> tail jr to loc_361d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x06, 0x05); // phase 5 < 7 -> carry set

  loc_362d(m);

  assert.equal(m.tstates, 38, "T = ld a,(ix+6) + cp + jr c taken");
  assert.deepEqual(m.pcSeq, [0x3630, 0x3632, 0x361d]);
  assert.equal(m.pc, 0x361d, "tail jr lands on loc_361d");
  assert.deepEqual(m.calls, [0x361d]);
  assert.equal(m.regs.sp, 0x8780, "tail delegate's ret unwinds the seated caller");
});

test("loc_362d Path JNC: phase >= 0x14 -> tail jr to loc_3625", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x06, 0x20); // phase 0x20 >= 0x14

  loc_362d(m);

  assert.equal(m.tstates, 52, "T = ld + cp7 + jrc nt + cp14 + jrnc taken");
  assert.deepEqual(m.pcSeq, [0x3630, 0x3632, 0x3634, 0x3636, 0x3625]);
  assert.equal(m.pc, 0x3625);
  assert.deepEqual(m.calls, [0x3625]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_362d Path DELAY: timer open, delay byte non-zero -> dec (hl) + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x06, 0x10); // 7 <= 0x10 < 0x14
  m.mem.write8(0x8d7d, 0x05);    // < 0x0e -> jr c,0x3645 taken
  m.mem.write8(0x8d6b, 0x03);    // non-zero delay -> dec + ret

  loc_362d(m);

  assert.equal(m.tstates, 128, "Path DELAY T-state total");
  assert.deepEqual(m.pcSeq, [
    0x3630, 0x3632, 0x3634, 0x3636, 0x3638, 0x363b, 0x363d,
    0x3645, 0x3648, 0x3649, 0x364a, 0x364c, 0x364d, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret at 0x364d to the seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d6b), 0x02, "delay byte decremented");
  assert.equal(m.regs.sp, 0x8780, "ret unwinds the seated caller");
});

test("loc_362d Path FULL: delay elapsed -> rst 0x20 lookup, store, fall through to loc_365d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.regs.b = 0x10;               // B < 0x80 -> ret nc not taken
  m.mem.write8(IX + 0x06, 0x13); // exactly 0x13 -> ret c not taken (cp 0x13 -> Z)
  m.mem.write8(0x8d7d, 0x0e);    // >= 0x0e -> jr c not taken
  m.mem.write8(0x8d6b, 0x00);    // delay elapsed -> jr z to 0x364e
  m.mem.write8(0x8907, 0x05);    // index (& 7) = 5
  m.mem.write8(0x3693, 0x18);    // table 0x368e + 5 -> the looked-up offset byte

  loc_362d(m);

  assert.equal(m.tstates, 206, "Path FULL T-state total");
  assert.deepEqual(m.pcSeq, [
    0x3630, 0x3632, 0x3634, 0x3636, 0x3638, 0x363b, 0x363d,
    0x363f, 0x3642, 0x3644, 0x3645, 0x3648, 0x3649, 0x364a,
    0x364e, 0x364f, 0x3651, 0x3652, 0x3653, 0x3656, 0x3659, 0x365b,
    0x0020, 0x365d, // rst 0x20 -> loc_0020, then fall through -> loc_365d
  ]);
  assert.equal(m.pc, 0x365d, "falls through into loc_365d");
  assert.deepEqual(m.calls, [0x0020, 0x365d]);
  assert.equal(m.mem.read8(0x8d6b), 0x18, "looked-up offset stored via ld (de),a (DE = 0x8d6b)");
  assert.equal(m.regs.sp, 0x8780, "rst push/pop balanced + tail delegate unwinds the caller");
});

test("loc_362d MUTATION: rst 0x20 mis-charged 10T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0020 ? 10 : cycles);
  seatCaller(m);
  m.regs.ix = IX;
  m.regs.b = 0x10;
  m.mem.write8(IX + 0x06, 0x13);
  m.mem.write8(0x8d7d, 0x0e);
  m.mem.write8(0x8d6b, 0x00);
  m.mem.write8(0x8907, 0x05);
  m.mem.write8(0x3693, 0x18);

  loc_362d(m);

  assert.equal(m.tstates, 205, "mutation loses 1 T (11 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 206), /206/, "the 206-T golden must fail on the mutant");
});
