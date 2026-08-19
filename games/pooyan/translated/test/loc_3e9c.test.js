// SPDX-License-Identifier: GPL-3.0-only
// Equivalence tests for loc_3e9c. Flat-RAM mock (real Regs); pattern-A/tail delegations use a stub
// that records the target and runs m.ret(). Run: node --test games/pooyan/translated/test/loc_3e9c.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3e9c } from "../loc_3e9c.js";

const CALLER_RET = 0xabcd;
function makeMachine(dispatch) {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); if (dispatch && dispatch[addr]) return dispatch[addr](this); this.ret(); return undefined; },
  };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); m.regs.ix = 0x8c00; }

test("loc_3e9c free/homing, target reached -> res 0,(ix+8), ret; 255 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c01, 0x00); // (ix+1) bit0 clear -> free mode
  m.mem.write8(0x8c08, 0x01); // (ix+8) bit0 set -> homing
  m.mem.write8(0x8c13, 0x00); // h = 0 -> sub 0x02 borrows -> target reached
  loc_3e9c(m);
  assert.equal(m.tstates, 255);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(0x8c08) & 1, 0, "(ix+8) bit0 cleared on arrival");
  assert.equal(m.pc, CALLER_RET); assert.equal(m.regs.sp, 0x8780);
});
test("loc_3e9c waypoint mode, high byte reaches 0x1e -> jp 0x3ee1 tail, land; 480 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c01, 0x01); // (ix+1) bit0 set -> waypoint
  m.mem.write8(0x8c04, 0x1e); // (ix+4) already at landing row -> ret c not taken -> land
  m.mem.write8(0x8c12, 0x00); m.mem.write8(0x8c13, 0x8e); // script ptr = 0x8e00
  loc_3e9c(m);
  assert.equal(m.tstates, 480);
  assert.deepEqual(m.calls, [0x4006, 0x381e], "waypoint walk then 0x3ee1 tail queues 0x381e");
  assert.equal(m.mem.read8(0x8c02), 0x02, "(ix+2) -> landing state 2");
  assert.equal(m.mem.read8(0x8c11), 0x0a, "(ix+0x11) := 0x0a");
  assert.equal(m.pc, CALLER_RET); assert.equal(m.regs.sp, 0x8780);
});
test("loc_3e9c MUTATION: res 0,(ix+8) mis-charged 19T (not 23T)", () => {
  const m = makeMachine(); seat(m); m.mem.write8(0x8c08, 0x01);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x3efc ? 19 : c);
  loc_3e9c(m); assert.equal(255 - m.tstates, 4);
});

