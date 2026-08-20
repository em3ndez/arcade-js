// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1a85 (ROM 0x1a85, Pooyan) -- call 0x03c2, then set (0x880a) = 0x0a,
 * bumped to 0x0b when the two-player flag (0x880d) is non-zero. Ends with a plain ret.
 *
 * The mock's `call` POPS (models 0x03c2's ret) so the push16 before `call 0x03c2` must balance, and the
 * final ret then lands on the seated CALLER_RET. Paths: Z ((0x880d)=0 -> C=0x0a) and NZ ((0x880d)!=0 ->
 * inc c -> 0x0b). STACK: after the balanced call, ret pops CALLER_RET -> SP back to baseline; deleting
 * the push16 makes `call 0x03c2` swallow CALLER_RET and the final ret returns to the wrong place.
 * TEETH: mis-charge `call 0x03c2` (17T) as 10T -> the 80-T Path-Z golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_1a85.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1a85 } from "../loc_1a85.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1a85, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_1a85 Path Z: (0x880d)=0 -> (0x880a)=0x0a", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x880d, 0x00); // one-player -> jr z taken -> skip inc c

  loc_1a85(m);

  assert.equal(m.tstates, 80, "Path Z T-state total");
  assert.deepEqual(m.pcSeq, [0x03c2, 0x1a8a, 0x1a8d, 0x1a8e, 0x1a91, 0x1a92, 0x1a95, CALLER_RET], "call target then straight to ret");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, [0x03c2]);
  assert.equal(m.mem.read8(0x880a), 0x0a, "(0x880a) = 0x0a");
  assert.equal(m.regs.sp, 0x8780, "call push balanced; ret popped CALLER_RET -> baseline");
});

test("loc_1a85 Path NZ: (0x880d)!=0 -> inc c -> (0x880a)=0x0b", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x880d, 0x01); // two-player -> jr z NOT taken -> inc c

  loc_1a85(m);

  assert.equal(m.tstates, 79, "Path NZ T-state total");
  assert.deepEqual(m.pcSeq, [0x03c2, 0x1a8a, 0x1a8d, 0x1a8e, 0x1a90, 0x1a91, 0x1a92, 0x1a95, CALLER_RET], "jr z not taken -> inc c -> ret");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x03c2]);
  assert.equal(m.mem.read8(0x880a), 0x0b, "(0x880a) = 0x0b");
  assert.equal(m.regs.sp, 0x8780, "call push balanced; ret popped CALLER_RET -> baseline");
});

test("loc_1a85 MUTATION: `call 0x03c2` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x03c2 ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x880d, 0x00);

  loc_1a85(m);

  assert.equal(m.tstates, 73, "mutation loses 7 T (17 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 80, "Path Z T-state total"), /80/, "the 80-T golden must fail on the mutant");
});
