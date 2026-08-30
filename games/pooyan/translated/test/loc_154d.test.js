// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_154d (ROM 0x154d, Pooyan) -- per-frame object tick with a frame-timer
// countdown. Ticks loc_4006, `dec (ix+0x11)`; while the timer is still running `ret nz` returns to
// the caller, otherwise it tail-jumps to loc_3553. Flat-RAM mock (real Regs); delegations use the
// stub call that records the target and runs m.ret() (so a `call` contributes its 17 T plus the
// callee's 10 T ret pop). Run: node --test games/pooyan/translated/test/loc_154d.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_154d } from "../loc_154d.js";

const CALLER_RET = 0xabcd;
function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
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
function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); m.regs.ix = 0x8c00; }

test("loc_154d: timer still running (ix+0x11: 2->1) -> ret nz to caller; 61 T", () => {
  const m = makeMachine(); seat(m); m.mem.write8(0x8c11, 0x02);
  loc_154d(m);
  // T = call(17) + callee ret(10) + dec(ix)(23) + ret nz taken(11) = 61
  assert.equal(m.tstates, 61, "17 + 10 + 23 + 11");
  assert.deepEqual(m.pcSeq, [0x4006, 0x1550, 0x1553, CALLER_RET],
    "call target, callee ret to 0x1550, dec, then ret nz to caller");
  assert.deepEqual(m.calls, [0x4006], "only the loc_4006 tick");
  assert.equal(m.mem.read8(0x8c11), 0x01, "frame timer decremented to 1");
  assert.equal(m.pc, CALLER_RET, "ret nz returned to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "SP balanced back to the seat");
});

test("loc_154d: timer elapses (ix+0x11: 1->0) -> tail jp loc_3553; 75 T", () => {
  const m = makeMachine(); seat(m); m.mem.write8(0x8c11, 0x01);
  loc_154d(m);
  // T = call(17) + callee ret(10) + dec(ix)(23) + ret nz not-taken(5) + jp(10) + tail ret(10) = 75
  assert.equal(m.tstates, 75, "17 + 10 + 23 + 5 + 10 + 10");
  assert.deepEqual(m.pcSeq, [0x4006, 0x1550, 0x1553, 0x1554, 0x3553, CALLER_RET],
    "falls past ret nz, jumps to 0x3553 which returns to the caller");
  assert.deepEqual(m.calls, [0x4006, 0x3553], "tick then the loc_3553 tail delegation");
  assert.equal(m.mem.read8(0x8c11), 0x00, "frame timer decremented to 0");
  assert.equal(m.pc, CALLER_RET, "tail 0x3553 rets through to the caller");
});

test("loc_154d MUTATION: dec (ix+0x11) mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine(); seat(m); m.mem.write8(0x8c11, 0x02);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x1553 ? 19 : c);
  loc_154d(m);
  assert.equal(m.tstates, 57, "mutation loses 4 T (23 -> 19)");
});
