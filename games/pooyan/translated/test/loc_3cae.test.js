// SPDX-License-Identifier: GPL-3.0-only
// Equivalence tests for loc_3cae (ROM 0x3cae-0x3d0e) -- the per-record CALLER-SKIP spawn helper
// driven by loc_3c92. Flat-RAM mock (real Regs). The leaf launch calls (0x381e queue-animation,
// 0x403c link) are modelled by a stub that records the target and runs m.ret() so the call/return
// stack discipline is exercised. The stack is seated with loc_3c92's in-loop return on top of the
// real caller return, so the launch path's `pop af; ret` (drop the in-loop return, land on the
// caller -- the caller-skip) is exercised end-to-end. Goldens derived from ROM via z80_decode.py.
// Run: node --test games/pooyan/translated/test/loc_3cae.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3cae } from "../loc_3cae.js";

const CALLER_RET = 0xabcd;   // loc_3c92's own caller (where the caller-skip lands)
const IN_LOOP_RET = 0x3ca5;  // loc_3c92's in-loop return (dropped by `pop af` on launch)
function makeMachine() {
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
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seat(m) {
  m.regs.sp = 0x8780; m.push16(CALLER_RET); m.push16(IN_LOOP_RET); // IN_LOOP_RET on top
  m.regs.ix = 0x8c00; m.regs.iy = 0x8c30;
}

test("loc_3cae slot occupied -> ret nz, returns true (scan continues); 53 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c30, 0x01); // (iy+0) != 0 -> occupied
  const r = loc_3cae(m);
  assert.equal(r, true, "occupied -> true so loc_3c92 keeps scanning");
  assert.equal(m.tstates, 53, "ld a(19)+or(19)+rrca(4)+ret nz taken(11)");
  assert.deepEqual(m.calls, [], "no launch -> no leaf calls");
  assert.deepEqual(m.pcSeq, [0x3cb1, 0x3cb4, 0x3cb5, IN_LOOP_RET]);
  assert.equal(m.pc, IN_LOOP_RET, "ret nz returns to the in-loop point");
  assert.equal(m.regs.sp, 0x877e, "one word popped (in-loop return), caller return still seated");
});

test("loc_3cae free slot -> full launch + CALLER-SKIP; 564 T", () => {
  const m = makeMachine(); seat(m);
  // 0x8c30 record left zero -> free slot. Parent fields set to distinct values to check the copy/offset.
  m.mem.write8(0x8c03, 0x22); // (ix+3)
  m.mem.write8(0x8c04, 0x50); // (ix+4)
  m.mem.write8(0x8c05, 0x33); // (ix+5)
  m.mem.write8(0x8c06, 0x10); // (ix+6)
  const r = loc_3cae(m);
  assert.equal(r, false, "launched -> false so loc_3c92 aborts the scan");
  assert.equal(m.tstates, 564, "full launch body incl. two stubbed leaf calls (17+10 each)");
  assert.deepEqual(m.calls, [0x381e, 0x403c], "queue-animation then link");
  assert.deepEqual(m.pcSeq, [
    0x3cb1, 0x3cb4, 0x3cb5, 0x3cb6, 0x3cba, 0x3cbb, 0x3cbf, 0x3cc2, 0x3cc5, 0x3cc8,
    0x3ccb, 0x3ccf, 0x3cd3, 0x3cd7, 0x3cda, 0x381e, 0x3cdd, 0x3ce0, 0x3ce2, 0x3ce5,
    0x3ce8, 0x3ceb, 0x3cee, 0x3cf0, 0x3cf3, 0x3cf6, 0x3cf9, 0x3cfd, 0x3d01, 0x403c,
    0x3d04, 0x3d06, 0x3d07, 0x3d0a, 0x3d0d, 0x3d0e, CALLER_RET,
  ], "ROM landing sequence incl. both stub returns and the caller-skip");
  // child seated
  assert.equal(m.mem.read8(0x8c31), 0x01, "(iy+1) active");
  assert.equal(m.mem.read8(0x8c32), 0x10, "(iy+2) := 0x10");
  assert.equal(m.mem.read8(0x8c3c), 0x0f, "(iy+0xc) = lo(0x3d0f)");
  assert.equal(m.mem.read8(0x8c3d), 0x3d, "(iy+0xd) = hi(0x3d0f)");
  assert.equal(m.mem.read8(0x8c3e), 0x00, "(iy+0xe) = a (0 after xor a)");
  assert.equal(m.mem.read8(0x8c34), 0x4f, "(iy+4) = (ix+4)-1");
  assert.equal(m.mem.read8(0x8c33), 0x22, "(iy+3) = (ix+3)");
  assert.equal(m.mem.read8(0x8c36), 0x11, "(iy+6) = (ix+6)+1");
  assert.equal(m.mem.read8(0x8c35), 0x33, "(iy+5) = (ix+5)");
  assert.equal(m.mem.read8(0x8c38), 0x01, "(iy+8) := 0x01");
  assert.equal(m.mem.read8(0x8c3a), 0xe8, "(iy+0xa) := 0xe8");
  // parent flipped + back-linked to the child (iy = 0x8c30)
  assert.equal(m.mem.read8(0x8c02), 0x06, "(ix+2) := state 6");
  assert.equal(m.mem.read8(0x8c08), 0x01, "(ix+8) := 0x01");
  assert.equal(m.mem.read8(0x8c0a), 0xe8, "(ix+0xa) := 0xe8");
  assert.equal(m.mem.read8(0x8c14), 0x30, "(ix+0x14) = lo(child = 0x8c30)");
  assert.equal(m.mem.read8(0x8c15), 0x8c, "(ix+0x15) = hi(child = 0x8c30)");
  assert.equal(m.pc, CALLER_RET, "caller-skip lands on loc_3c92's caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (pop af drops the in-loop return)");
});

test("loc_3cae MUTATION: push iy mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine(); seat(m); // free slot (record left zero) -> launch path
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3d06 ? 11 : c); // 0x3d06 = landing after push iy
  loc_3cae(m);
  assert.notEqual(m.tstates, 564, "golden total catches the IX/IY-prefix 4T undercharge");
  assert.equal(m.tstates, 560);
});
