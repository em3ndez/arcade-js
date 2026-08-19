// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7881 (ROM 0x7881-0x78fe): the periodic self-integrity routine.
// Flat-RAM mock (ROM bytes default 0; expected-sum table + videoRAM crafted as literals). rst 0x10
// (loc_0010) and call 0x77c8 are balanced stubs. Run: node --test games/pooyan/translated/test/loc_7881.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7881 } from "../loc_7881.js";

const CALLER_RET = 0xabcd;
const IX = 0x8a00;

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

// rst 0x10 and mid-body `call` balance their pushed return (SP += 2); rst 0x10 also runs its memset
// side effect on HL/B (advance HL by B, zero B) as loc_0010 does.
function installBalancingCalls(m) {
  m.call = (addr) => {
    m.calls.push(addr);
    m.regs.sp = (m.regs.sp + 2) & 0xffff;
    if (addr === 0x0010) { m.regs.hl = (m.regs.hl + m.regs.b) & 0xffff; m.regs.b = 0; }
    return undefined;
  };
}

test("loc_7881: (IX+0x11) countdown not expired -> ret nz; 34 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x05); // dec -> 4 (non-zero)

  loc_7881(m);

  assert.equal(m.tstates, 34, "dec(ix+0x11)=23 + ret nz taken=11");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.calls, [], "no work on early ret");
  assert.equal(m.mem.read8(IX + 0x11), 0x04, "countdown decremented");
  assert.deepEqual(m.pcSeq, [0x7884, CALLER_RET], "exits at ret nz");
});

test("loc_7881: first-block checksum mismatch -> shared ret at 0x780e; 1586 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01); // dec -> 0 -> proceed
  // ROM 0x0779.. all 0 => running sum stays 0 => E=0. Mismatch on block 0's low byte:
  m.mem.write8(0x7900, 0x01);

  loc_7881(m);

  assert.equal(m.tstates, 1586, "one full 32-byte block + mismatch exit");
  assert.equal(m.pc, CALLER_RET, "jp nz 0x780e -> shared ret -> caller");
  assert.deepEqual(m.calls, [], "aborts before any rst/call");
  const adds = m.pcSeq.filter((p) => p === 0x7894).length;
  assert.equal(adds, 32, "inner add ran the full 32-byte block once");
});

test("loc_7881 MUTATION: a dropped inner `ld a,(hl)` step (0T not 7T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(0x7900, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7894 ? 0 : c); // 32 occurrences
  loc_7881(m);
  assert.equal(m.tstates, 1586 - 32 * 7, "loses 32*7 = 224 T");
  assert.notEqual(m.tstates, 1586, "golden T-state total catches the mutant");
});

test("loc_7881: full PASS -> sets (0x8e51)=2, two rst 0x10 fills, call 0x77c8, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(IX + 0x11, 0x01);   // dec -> 0 -> proceed
  // ROM 0x0779.. all 0 and table 0x7900.. all 0 => every block matches (sum stays 0).
  // Second (videoRAM) checksum: one cell 0x5a so L=0x5a,H=0 -> (L+H+0xa6) wraps to 0 -> no tamper jp.
  m.mem.write8(0x8548, 0x5a);

  loc_7881(m);

  assert.equal(m.pc, CALLER_RET, "returns via ret after re-init");
  assert.deepEqual(m.calls, [0x0010, 0x0010, 0x77c8], "two fills then loc_77c8");
  assert.equal(m.mem.read8(0x8e51), 0x02, "state selector set to 2");
  const block1Adds = m.pcSeq.filter((p) => p === 0x7894).length;
  const block2Adds = m.pcSeq.filter((p) => p === 0x78ca).length;
  assert.equal(block1Adds, 9 * 32, "9 blocks x 32 bytes summed");
  assert.equal(block2Adds, 2 * 12, "two 12-cell columns summed");
});

test("loc_7881: videoRAM sum tamper -> tail-delegates to 0x0320", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(IX + 0x11, 0x01);
  // First checksum passes (all zero). Second: leave all cells 0 -> L=H=0 -> (0+0+0xa6)!=0 -> jp nz.
  loc_7881(m);
  assert.deepEqual(m.calls, [0x0320], "tamper delegate to 0x0320");
  assert.equal(m.pc, 0x0320, "tail-jump lands at 0x0320");
});
