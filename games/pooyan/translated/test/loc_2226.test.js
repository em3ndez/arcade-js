// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_2226 (ROM 0x2226, Pooyan) -- advance a two-axis moving object.
 * When 0x8f0e (phase counter) is 0, reload params via loc_2282. Integrate X velocity (0x8f10) into
 * (iy+5:iy+6) -- direction from iyl bit3 (picks table byte 0x8d19/0x8d1a) bit0: add hl,de else sbc hl,de.
 * Integrate Y velocity (0x8f12) into (iy+3:iy+4); if the Y high byte >= 0xe8 clear the object scratch
 * (0x8f0e/0f/30, 0x8d45/77, 0x8f3f) and tail-jump to the clear helper 0x221e; else store Y and dec 0x8f0e.
 *
 * The mock's `call` POPS the return address the call site pushed. loc_2282 (call z) and the tail helper
 * 0x221e clobber nothing loc_2226 reads without reloading from memory, so the mock only pops. A dropped
 * push16 before `call z,0x2282` desyncs the stack and the final ret pops garbage -- the SP tooth catches it.
 *
 * Path SUB (call skipped, iyl bit3 clear -> sbc, Y<0xe8 -> store+dec+ret). T=359.
 * Path RESET (call skipped, iyl bit3 set -> inc bc, bit0 set -> add, Y>=0xe8 -> clear + tail jr 0x221e). T=393.
 * Path CALL (0x8f0e==0 -> call z,0x2282 taken; add path, Y<0xe8 -> ret). T=369. Exercises the call idiom.
 * MUTATION: mis-charge `sbc hl,de` 11T (not 15T) in Path SUB -> the 359-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_2226.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2226 } from "../loc_2226.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x2226, pcSeq: [],
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
    // Pop the return address the call site pushed. loc_2282 rewrites 0x8f0e/10/12 which loc_2226 reads
    // from memory anyway (pre-seeded here); 0x221e is a never-return tail. Neither needs register modelling.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const IY = 0x8e00;

// ── Path SUB: iyl bit3 clear -> sbc; Y high < 0xe8 -> store + dec + ret ────────────────────────────
test("loc_2226 Path SUB: skip call, sbc branch, keep moving -> store + dec + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.iy = IY;                       // iyl = 0x00 -> bit3 clear
  m.regs.f = 0;                         // carry clear (and a will clear it anyway)
  m.mem.write8(0x8f0e, 0x05);           // nonzero -> call z NOT taken
  m.mem.write16(0x8f10, 0x0100);        // X velocity DE = 0x0100
  m.mem.write16(0x8f12, 0x0010);        // Y velocity DE = 0x0010
  m.mem.write8(0x8d19, 0x00);           // table[0] bit0 clear -> sbc
  m.mem.write8(IY + 0x05, 0x00); m.mem.write8(IY + 0x06, 0x10); // X pos = 0x1000
  m.mem.write8(IY + 0x03, 0x00); m.mem.write8(IY + 0x04, 0x50); // Y pos = 0x5000

  loc_2226(m);

  assert.equal(m.tstates, 359, "Path SUB T-state total");
  assert.deepEqual(m.pcSeq, [
    0x2229, 0x222a, 0x222d, 0x2231, 0x2233, 0x2235, 0x2238, 0x223b, 0x223e,
    0x2241, 0x2242, 0x2244, 0x2249, 0x224b,          // jr z (bit3), ld a,(bc), jr z (bit0), sbc hl,de
    0x224e, 0x2251, 0x2255, 0x2258, 0x225b, 0x225c, 0x225d, 0x225f,
    0x2261, 0x2264, 0x2267, 0x226a, 0x226b, CALLER_RET,
  ], "sbc branch then store + dec + ret");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [], "call z skipped");
  assert.equal(m.mem.read8(IY + 0x05), 0x00, "X lo (sbc 0x1000-0x0100=0x0f00)");
  assert.equal(m.mem.read8(IY + 0x06), 0x0f, "X hi");
  assert.equal(m.mem.read8(IY + 0x03), 0x10, "Y lo (add 0x5000+0x0010=0x5010)");
  assert.equal(m.mem.read8(IY + 0x04), 0x50, "Y hi");
  assert.equal(m.mem.read8(0x8f0e), 0x04, "phase counter decremented 5 -> 4");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

// ── Path RESET: iyl bit3 set -> inc bc, bit0 set -> add; Y high >= 0xe8 -> clear + tail jr 0x221e ──
test("loc_2226 Path RESET: add branch, Y spent -> clear scratch + tail jr 0x221e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.iy = IY + 0x08;                // iyl = 0x08 -> bit3 set
  m.regs.f = 0;
  m.mem.write8(0x8f0e, 0x05);           // nonzero -> call z NOT taken
  m.mem.write16(0x8f10, 0x0100);
  m.mem.write16(0x8f12, 0x0100);
  m.mem.write8(0x8d1a, 0x01);           // table[1] bit0 set -> add
  m.mem.write8(IY + 0x08 + 0x05, 0x00); m.mem.write8(IY + 0x08 + 0x06, 0x20); // X pos 0x2000
  m.mem.write8(IY + 0x08 + 0x03, 0x00); m.mem.write8(IY + 0x08 + 0x04, 0xe8); // Y pos 0xe800
  // pre-seed the scratch bytes to non-zero to prove they get cleared
  for (const a of [0x8f0f, 0x8f30, 0x8d45, 0x8d77, 0x8f3f]) m.mem.write8(a, 0xaa);

  loc_2226(m);

  assert.equal(m.tstates, 393, "Path RESET T-state total");
  assert.deepEqual(m.pcSeq, [
    0x2229, 0x222a, 0x222d, 0x2231, 0x2233, 0x2235, 0x2238, 0x223b, 0x223e,
    0x2240, 0x2241, 0x2242, 0x2244, 0x2246, 0x2247, 0x224b,   // jr z NT, inc bc, jr z NT, add hl,de, jr
    0x224e, 0x2251, 0x2255, 0x2258, 0x225b, 0x225c, 0x225d, 0x225f,
    0x226c, 0x226d, 0x2270, 0x2273, 0x2276, 0x2279, 0x227c, 0x227f,
    0x221e,                                                   // tail jr 0x221e (target visited)
  ], "add branch then clear + tail jr 0x221e");
  assert.equal(m.pc, 0x221e, "tail jr lands on 0x221e");
  assert.deepEqual(m.calls, [0x221e], "tail-called the clear helper");
  assert.equal(m.mem.read8(0x8f0e), 0x00, "0x8f0e cleared");
  for (const a of [0x8f0f, 0x8f30, 0x8d45, 0x8d77, 0x8f3f]) {
    assert.equal(m.mem.read8(a), 0x00, `scratch ${a.toString(16)} cleared`);
  }
  // STACK TOOTH: tail jr reuses the caller's frame; 0x221e's ret (modelled by the mock pop) consumes
  // the seated CALLER_RET, so SP returns to the pre-seat baseline.
  assert.equal(m.regs.sp, 0x8780, "tail unwinds to the pre-seat baseline");
});

// ── Path CALL: 0x8f0e==0 -> call z,0x2282 taken; add branch, Y<0xe8 -> ret ─────────────────────────
test("loc_2226 Path CALL: 0x8f0e==0 -> call z,0x2282 taken, then keep moving -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.iy = IY;                       // iyl bit3 clear
  m.regs.f = 0;
  m.mem.write8(0x8f0e, 0x00);           // zero -> call z,0x2282 TAKEN
  m.mem.write16(0x8f10, 0x0100);
  m.mem.write16(0x8f12, 0x0010);
  m.mem.write8(0x8d19, 0x01);           // bit0 set -> add (carry-independent, mock leaves flags alone)
  m.mem.write8(IY + 0x05, 0x00); m.mem.write8(IY + 0x06, 0x20); // X pos 0x2000
  m.mem.write8(IY + 0x03, 0x00); m.mem.write8(IY + 0x04, 0x50); // Y pos 0x5000

  loc_2226(m);

  assert.equal(m.tstates, 369, "Path CALL T-state total");
  assert.deepEqual(m.pcSeq, [
    0x2229, 0x222a, 0x2282, 0x2231, 0x2233, 0x2235, 0x2238, 0x223b, 0x223e,
    0x2241, 0x2242, 0x2244, 0x2246, 0x2247, 0x224b,   // jr z (bit3), ld a,(bc), jr z NT, add hl,de, jr
    0x224e, 0x2251, 0x2255, 0x2258, 0x225b, 0x225c, 0x225d, 0x225f,
    0x2261, 0x2264, 0x2267, 0x226a, 0x226b, CALLER_RET,
  ], "call z target visited, add branch, store + dec + ret");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x2282], "call z,0x2282 taken");
  assert.equal(m.mem.read8(IY + 0x05), 0x00, "X lo (add 0x2000+0x0100=0x2100)");
  assert.equal(m.mem.read8(IY + 0x06), 0x21, "X hi");
  assert.equal(m.mem.read8(0x8f0e), 0xff, "phase counter dec 0x00 -> 0xff");
  assert.equal(m.regs.sp, 0x8780, "push16(0x222d) matched by loc_2282 ret; stack unwinds via final ret");
});

test("loc_2226 MUTATION: `sbc hl,de` mis-charged 11T (not 15T) in Path SUB is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x224b ? 11 : cycles);
  seatCaller(m);
  m.regs.iy = IY;
  m.regs.f = 0;
  m.mem.write8(0x8f0e, 0x05);
  m.mem.write16(0x8f10, 0x0100);
  m.mem.write16(0x8f12, 0x0010);
  m.mem.write8(0x8d19, 0x00);
  m.mem.write8(IY + 0x05, 0x00); m.mem.write8(IY + 0x06, 0x10);
  m.mem.write8(IY + 0x03, 0x00); m.mem.write8(IY + 0x04, 0x50);

  loc_2226(m);

  assert.equal(m.tstates, 355, "mutation loses 4 T (15 -> 11)");
  assert.throws(() => assert.equal(m.tstates, 359, "golden"), /359/, "the 359-T golden must fail");
});
