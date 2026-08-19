// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_4006 (ROM 0x4006-0x403b): the per-object animation sequencer.
// Flat-RAM mock (real Regs for exact flags); the object block is based at IX and its animation
// script lives elsewhere in the same flat RAM. Both exits are `ret`, so the seated caller return
// proves which exit fired and the final PC lands back on CALLER_RET.
//
// Run: node --test games/pooyan/translated/test/loc_4006.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4006 } from "../loc_4006.js";

const CALLER_RET = 0xabcd;
const IX = 0x8900;

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); m.regs.ix = IX; }

// ── Path A: hold countdown non-zero -> decrement and ret ──────────────────────────────────────
test("loc_4006 Path A: (ix+0eh)!=0 -> dec, ret; 63 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0e, 5); // hold countdown

  loc_4006(m);

  assert.equal(m.tstates, 63, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.mem.read8(IX + 0x0e), 4, "hold decremented");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.deepEqual(m.pcSeq, [0x4009, 0x400a, 0x400c, 0x400f, CALLER_RET], "Path A boundaries");
});

test("loc_4006 Path A MUTATION: dec (ix+0eh) mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0e, 5);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x400f ? 19 : c);
  loc_4006(m);
  assert.equal(m.tstates, 59, "mutation loses 4 T (23 -> 19)");
  assert.notEqual(m.tstates, 63, "golden T-state total catches the mutant");
});

// ── Path B: hold expired, next script byte is a normal frame -> copy {tile,attr,hold}, advance ──
test("loc_4006 Path B: hold==0, normal frame -> triple copied, pointer advanced, ret; 231 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0e, 0);       // hold expired
  m.mem.write8(IX + 0x0c, 0x20);    // script pointer -> 0x8920
  m.mem.write8(IX + 0x0d, 0x89);
  m.mem.write8(0x8920, 0x11);       // tile
  m.mem.write8(0x8921, 0x22);       // attr
  m.mem.write8(0x8922, 0x33);       // hold

  loc_4006(m);

  assert.equal(m.tstates, 231, "Path B T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.mem.read8(IX + 0x10), 0x11, "(ix+10h) = tile");
  assert.equal(m.mem.read8(IX + 0x0f), 0x22, "(ix+0fh) = attr");
  assert.equal(m.mem.read8(IX + 0x0e), 0x33, "(ix+0eh) = hold");
  assert.equal(m.mem.read8(IX + 0x0c), 0x23, "(ix+0ch) = advanced pointer lo (0x8923)");
  assert.equal(m.mem.read8(IX + 0x0d), 0x89, "(ix+0dh) = advanced pointer hi");
  assert.deepEqual(m.pcSeq,
    [0x4009, 0x400a, 0x4010, 0x4013, 0x4016, 0x4017, 0x4019, 0x401b, 0x401e, 0x401f, 0x4020,
     0x4023, 0x4024, 0x4025, 0x4028, 0x4029, 0x402c, 0x402f, CALLER_RET],
    "Path B boundaries");
});

// ── Path C: 0xff opcode reloads the pointer and loops back, then a normal frame ────────────────
test("loc_4006 Path C: 0xff -> reload pointer, loop to 0x4010, then normal frame; 371 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0e, 0);       // hold expired
  m.mem.write8(IX + 0x0c, 0x30);    // script pointer -> 0x8930
  m.mem.write8(IX + 0x0d, 0x89);
  m.mem.write8(0x8930, 0xff);       // reload opcode
  m.mem.write8(0x8931, 0x40);       // new pointer lo
  m.mem.write8(0x8932, 0x89);       // new pointer hi -> 0x8940
  m.mem.write8(0x8940, 0x55);       // tile
  m.mem.write8(0x8941, 0x66);       // attr
  m.mem.write8(0x8942, 0x77);       // hold

  loc_4006(m);

  assert.equal(m.pc, CALLER_RET, "returns via ret after the loop");
  assert.equal(m.mem.read8(IX + 0x10), 0x55, "(ix+10h) = tile from reloaded block");
  assert.equal(m.mem.read8(IX + 0x0f), 0x66, "(ix+0fh) = attr");
  assert.equal(m.mem.read8(IX + 0x0e), 0x77, "(ix+0eh) = hold");
  assert.equal(m.mem.read8(IX + 0x0c), 0x43, "(ix+0ch) = advanced pointer lo (0x8943)");
  assert.equal(m.mem.read8(IX + 0x0d), 0x89, "(ix+0dh) = advanced pointer hi");
  assert.equal(m.pcSeq.filter((p) => p === 0x4010).length, 2, "loop head 0x4010 visited twice");
  assert.equal(m.pcSeq.filter((p) => p === 0x4030).length, 1, "reload branch taken once");
  // Path C = entry 35 + reload-iteration 140 + normal-frame-iteration 196.
  assert.equal(m.tstates, 371, "Path C T-state total");
});
