// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6e86 (ROM 0x6e86-0x6eda): the scripted single-object launcher. Pins the
// hold path and the script-terminator path (no slots scanned).
//
// Run: node --test games/pooyan/translated/test/loc_6e86.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6e86 } from "../loc_6e86.js";

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
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_6e86 hold: (0x8f48)!=0 -> dec, ret; 49 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f48, 0x05);

  loc_6e86(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 7 + 11 + 10, "49 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8f48), 0x04, "delay ticked");
  assert.deepEqual(m.calls, [], "no work on the hold path");
  assert.deepEqual(m.pcSeq, [0x6e89, 0x6e8a, 0x6e8b, 0x6e8d, 0x6e8e, CALLER_RET], "boundaries");
});

test("loc_6e86 expiry, script terminator: reload delay, (0x8f4a) points at 0xff -> ret z; 121 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f48, 0x00);  // elapsed
  m.mem.write8(0x8f49, 0x00);  // bit1 clear -> reload 0x20
  m.mem.write16(0x8f4a, 0x8c00);
  m.mem.write8(0x8c00, 0xff);  // script terminator

  loc_6e86(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 12 + 13 + 8 + 7 + 12 + 7 + 16 + 7 + 7 + 11, "121 T");
  assert.equal(m.pc, CALLER_RET, "ret z on the terminator");
  assert.equal(m.mem.read8(0x8f48), 0x20, "delay reloaded to 0x20 (bit1 clear)");
  assert.deepEqual(m.calls, [], "terminator returns before any slot work");
  assert.deepEqual(m.pcSeq,
    [0x6e89, 0x6e8a, 0x6e8b, 0x6e8f, 0x6e92, 0x6e94, 0x6e96, 0x6e9a, 0x6e9b, 0x6e9e, 0x6e9f, 0x6ea1, CALLER_RET],
    "boundaries");
});

test("loc_6e86 MUTATION: ld hl,(0x8f4a) at 0x6e9b mischarged 10T (not 16T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f48, 0x00);
  m.mem.write16(0x8f4a, 0x8c00);
  m.mem.write8(0x8c00, 0xff);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x6e9e ? 10 : c);
  loc_6e86(m);
  assert.notEqual(m.tstates, 121, "golden 121 T catches the mischarge");
});
