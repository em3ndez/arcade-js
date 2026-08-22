// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6931 (ROM 0x6931-0x69ac): per-record spawn/init, a CONDITIONAL caller-skip.
// An inactive record ((ix+0)|(ix+1) bit0 clear) takes `ret c` -- a NORMAL return that continues the
// caller's sweep. An active record is initialized and the routine ends `pop af; ret` -- dropping the
// caller's continuation so it returns to the caller's caller (aborting the sweep after one spawn).
//   - first spawn of a wave ((0x892d)==0): also enqueues 2 display commands + paints the BCD count.
//   - later spawns: skips the paint.
//
// Run: node --test games/pooyan/translated/test/loc_6931.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6931 } from "../loc_6931.js";

const CALLER_RET = 0x6929;       // the caller's loop continuation (dropped by the skip)
const OUTER_RET = 0xabcd;        // the caller's caller (where the skip lands)

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0,
    step(n, c) { this.pc = n; this.tstates += c; },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
// seat both returns: OUTER_RET below, CALLER_RET on top (the skip drops CALLER_RET, rets to OUTER_RET)
function seat(m) { m.regs.sp = 0x8780; m.push16(OUTER_RET); m.push16(CALLER_RET); }

test("already-active record -> ret c (normal return to caller, no writes)", () => {
  const m = makeMachine();
  seat(m);
  m.regs.ix = 0x8ae0; m.regs.iy = 0x8ba0;
  m.mem.write8(0x8ae0, 0x01); m.mem.write8(0x8ae1, 0x00); // bit0 of (ix0|ix1) SET -> rrca sets carry
  loc_6931(m);
  assert.equal(m.pc, CALLER_RET, "ret c returns to the caller's continuation (loop continues)");
  assert.equal(m.tstates, 19 + 19 + 4 + 11, "ld a,(ix0)/or(ix1)/rrca/ret c(taken)");
  assert.deepEqual(m.calls, [], "no calls when the record is already active");
});

test("empty record, later spawn ((0x892d)!=0) -> init + skip, no paint", () => {
  const m = makeMachine();
  seat(m);
  m.regs.ix = 0x8ae0; m.regs.iy = 0x8ba0;
  m.mem.write8(0x8ae0, 0x00); m.mem.write8(0x8ae1, 0x00); // empty (bit0 clear) -> spawn
  m.mem.write8(0x892d, 0x03);        // not the first spawn -> jr nz taken (skip paint)
  loc_6931(m);
  // record activation + field seeds
  assert.equal(m.mem.read8(0x8ae0), 0x01, "ix+0 activated");
  assert.equal(m.mem.read8(0x8ba0), 0x01, "iy+0 activated");
  assert.equal(m.mem.read8(0x8ae0 + 0x04), 0x15, "ix+4");
  assert.equal(m.mem.read8(0x8ba0 + 0x03), 0x80, "iy+3");
  assert.equal(m.mem.read8(0x8ba0 + 0x10), 0x40, "iy+0x10");
  assert.equal(m.mem.read8(0x8929), 0x10, "respawn delay armed");
  assert.equal(m.mem.read8(0x892d), 0x04, "(0x892d) bumped 3->4");
  assert.equal(m.pc, OUTER_RET, "active path skips to the caller's caller");
  assert.deepEqual(m.calls, [0x381e], "only loc_381e; paint skipped");
  const opening = 19 + 19 + 4 + 5; // through ret c (not taken)
  const seedBlock = 4 + 19 + 19 + 4 + 19 + 19 + 19 + 19 + 19 + 19 + 19 + 19 + 19 + 19 + 19 + 19; // xor..ld(iy+9)
  const armGate = 10 + 17 + 7 + 13 + 13 + 4; // de,call381e,a=10,(8929),a=(892d),and a
  const tail = 12 + 10 + 11 + 10 + 10;       // jr nz taken, ld hl 892d, inc(hl), pop af, ret
  const callRets = 10;                        // mock charges the called routine's ret (loc_381e)
  assert.equal(m.tstates, opening + seedBlock + armGate + tail + callRets, "later-spawn T-states");
});

test("empty record, first spawn ((0x892d)==0) -> init + paint + skip", () => {
  const m = makeMachine();
  seat(m);
  m.regs.ix = 0x8ae0; m.regs.iy = 0x8ba0;
  m.mem.write8(0x8ae0, 0x00); m.mem.write8(0x8ae1, 0x00); // empty -> spawn
  m.mem.write8(0x892d, 0x00);        // first spawn -> jr nz not taken (do the paint)
  m.mem.write8(0x8903, 0x01);        // wave count -> B=1 daa loop
  loc_6931(m);
  assert.equal(m.mem.read8(0x8929), 0x10, "respawn delay armed");
  assert.equal(m.mem.read8(0x892d), 0x01, "(0x892d) bumped 0->1");
  // BCD of 0x8903==1 -> low digit 1 at 0x861b, high digit 0 at 0x863b
  assert.equal(m.mem.read8(0x863b), 0x00, "high BCD digit");
  assert.equal(m.mem.read8(0x861b), 0x01, "low BCD digit (0x863b - 0x20)");
  assert.equal(m.pc, OUTER_RET, "first-spawn path also skips to the caller's caller");
  assert.deepEqual(m.calls, [0x381e, 0x0038, 0x0038, 0x0f97], "loc_381e, two rst-38 enqueues, loc_0f97");
  const opening = 19 + 19 + 4 + 5;
  const seedBlock = 4 + 19 + 19 + 4 + 19 + 19 + 19 + 19 + 19 + 19 + 19 + 19 + 19 + 19 + 19 + 19;
  const armGate = 10 + 17 + 7 + 13 + 13 + 4; // through and a
  const paintHead = 7 + 10 + 11 + 7 + 11 + 10 + 13 + 4 + 4; // jr nz not-taken,de,rst38,e,rst38,hl,a=(8903),ld b,xor a
  const daaLoop = 7 + 4 + 8;                  // B=1: add,daa,djnz(not taken)
  const paintTail = 4 + 7 + 4 + 4 + 4 + 4 + 7 + 10 + 11 + 4 + 7 + 7 + 17; // ld e,a..call 0f97
  const tail = 10 + 11 + 10 + 10;             // ld hl 892d, inc(hl), pop af, ret
  const callRets = 4 * 10;                    // mock charges 4 called routines' rets (381e, 0038, 0038, 0f97)
  assert.equal(m.tstates, opening + seedBlock + armGate + paintHead + daaLoop + paintTail + tail + callRets, "first-spawn T-states");
});
