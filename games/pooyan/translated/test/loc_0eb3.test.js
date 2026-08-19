// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0eb3 (ROM 0x0eb3, Pooyan) -- enqueue A into the
 * sound-command ring buffer (slots 0x8a43..0x8a5e), pointer cell at 0x8a40 advancing
 * with wrap 0x5e -> 0x43. push bc/de/hl are restored on exit; every exit is `ret`.
 *
 * Self-contained mock (real Regs, flat 64K RAM, step/call/ret/push16/pop16). A known
 * caller return address is seated so the final PC proves the `ret`.
 *
 * Pins two paths off the disassembly:
 *   ADVANCE. pointer 0x43 -> store A at 0x8a43, pointer becomes 0x44 (153 T). Full pcSeq.
 *   WRAP.    pointer 0x5e -> store A at 0x8a5e, pointer wraps to 0x43 (149 T).
 * TEETH: mis-charge `cp 0x5e` (immediate, 7 T) as a `cp r` (4 T) -- the ADVANCE golden
 * T-state total must catch it.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0eb3 } from "../loc_0eb3.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0eb3, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8800; m.push16(CALLER_RET); }

const PC_SEQ_ADVANCE = [
  0x0eb4, 0x0eb5, 0x0eb6, 0x0eb7, 0x0eba, 0x0ebb, 0x0ebc, 0x0ebe, 0x0ebf, 0x0ec0, 0x0ec2,
  0x0ec4, 0x0ec5, 0x0ec6, 0x0ecb, 0x0ecc, 0x0ecd, 0x0ece, CALLER_RET,
];

function setupAdvance(m) {
  seatCaller(m);
  m.regs.bc = 0x1234; m.regs.de = 0x5678; m.regs.hl = 0x9abc; // distinct -> prove push/pop balance
  m.regs.a = 0x27;                 // byte to enqueue
  m.mem.write8(0x8a40, 0x43);      // pointer not at the last slot
}

test("loc_0eb3 ADVANCE: store at 0x8a43, pointer 0x43 -> 0x44", () => {
  const m = makeMachine();
  setupAdvance(m);
  loc_0eb3(m);
  assert.equal(m.mem.read8(0x8a43), 0x27, "byte stored into the ring slot 0x8a43");
  assert.equal(m.mem.read8(0x8a40), 0x44, "pointer advanced 0x43 -> 0x44");
  assert.equal(m.tstates, 153, "ADVANCE T total");
  assert.equal(m.pc, CALLER_RET, "ends via `ret`");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.regs.bc, 0x1234, "BC restored by pop");
  assert.equal(m.regs.de, 0x5678, "DE restored by pop");
  assert.equal(m.regs.hl, 0x9abc, "HL restored by pop");
  assert.equal(m.regs.sp, 0x8800, "SP balanced back to entry");
  assert.deepEqual(m.pcSeq, PC_SEQ_ADVANCE, "ADVANCE step boundaries match the disassembly");
});

test("loc_0eb3 WRAP: pointer 0x5e -> store at 0x8a5e, wrap to 0x43", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x30;
  m.mem.write8(0x8a40, 0x5e); // last slot -> wrap arm
  loc_0eb3(m);
  assert.equal(m.mem.read8(0x8a5e), 0x30, "byte stored into the last slot 0x8a5e");
  assert.equal(m.mem.read8(0x8a40), 0x43, "pointer wrapped 0x5e -> 0x43");
  assert.equal(m.tstates, 149, "WRAP T total");
  assert.equal(m.pc, CALLER_RET, "ends via `ret`");
  assert.deepEqual(m.pcSeq, [
    0x0eb4, 0x0eb5, 0x0eb6, 0x0eb7, 0x0eba, 0x0ebb, 0x0ebc, 0x0ebe, 0x0ebf, 0x0ec0, 0x0ec2,
    0x0ec8, 0x0eca, 0x0ecb, 0x0ecc, 0x0ecd, 0x0ece, CALLER_RET,
  ], "WRAP step boundaries match the disassembly");
});

test("loc_0eb3 MUTATION: `cp 0x5e` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  setupAdvance(m);
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x0ec2) { first = false; return realStep(nextAddr, 4); }
    return realStep(nextAddr, cycles);
  };
  loc_0eb3(m);
  assert.equal(m.tstates, 150, "mutation loses 3 T (7 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 153, "ADVANCE T total"),
    /ADVANCE T total/, "the golden T-state total must fail on the mutant");
});
