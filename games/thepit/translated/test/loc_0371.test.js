// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_0371 (ROM 0x0371-0x03bb, The Pit).
//
//   0371  ld sp,0x83ff        ; re-establish the stack (this is a state ENTRY)
//   0374  call 0x4c63
//   0377  ld a,(0x8001)       ; active player number
//   037a  dec a
//   037b  cp 0x02
//   037d  jr nc,0x03ac        ; skip teardown unless (0x8001) is 1 or 2
//   037f..0395  player-1 teardown (4b46, 4bff, arm 0x8002, 4cbf, call nz 4df8)
//   0398  ld a,(0x8001)
//   039b  ld (0x8002),a
//   039e  cp 0x02
//   03a0  jr nz,0x03ac        ; second pass only when (0x8001) == 2
//   03a2..03a9  player-2 pass (4cbf, call nz 4df8)
//   03ac  ld a,0x00
//   03ae  ld (0x8001),a       ; clear player number
//   03b1  inc a               ; A = 1
//   03b2  ld (0x8002),a       ; arm 0x8002 = 1
//   03b5  call 0x4b55         ; decode DSW
//   03b8  call 0x3a6f
//   03bb  jp 0x01f9           ; tail-jump to the reset/entry handler
//
// Runs on a minimal machine built from the REAL thepit address space
// (boards/thepit/memory.js) + Io + the shared Z80 Regs. Callees are stubbed as
// "pop-and-return" routines that balance the stack but add no cycles, so the
// asserted T-state total is loc_0371's OWN instruction cost.
//
// Three paths pin the two forward `jr`s that converge on loc_03ac plus the two
// conditional `call nz`s:
//   A  (0x8001)=5    -> jr nc taken, teardown skipped entirely
//   B  (0x8001)=1, (0x8048)=0    -> player-1 pass, both `call nz` NOT taken,
//                                    jr nz taken (skips the player-2 pass)
//   C  (0x8001)=2, (0x8048)!=0   -> both passes, both `call nz` TAKEN
// T-state totals are hand-derived off the opcode timings (jr 12/7, call cc 17/10,
// call/jp 17/10, ld/cp/or/inc/dec per the Z80 tables), independently of the
// translation, so a cycle error shows up as a mismatch rather than agreeing with
// itself. A deliberate MUTATION (branch polarity flipped) is asserted to be caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_0371 } from "../loc_0371.js";

function buildRom() {
  return new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
}

// -- minimal machine: real mem/io/regs + the step/call/push seam --------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x0371;
    this.calls = [];
    this.regs.sp = 0x8780; // some mapped stack; the routine's first op resets it
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  // Stubbed callee: record it, behave as a bare `ret` (pop the pushed address),
  // no cycle charge -- the callee's own cost is not loc_0371's.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run(fn, { p8001, p8048 = 0x00 }) {
  const m = new TestMachine(buildRom());
  m.mem.write8(0x8001, p8001 & 0xff);
  m.mem.write8(0x8048, p8048 & 0xff);
  fn(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    a: m.regs.a,
    w8001: m.mem.read8(0x8001),
    w8002: m.mem.read8(0x8002),
  };
}

// -- PATH A: (0x8001) not 1/2 -> jr nc taken, teardown skipped ----------------
// 144 T = 10+17+13+4+7 (jr nc taken 12) + loc_03ac[7+13+4+13+17+17 + jp 10 = 81].
function checkPathA(res) {
  assert.equal(res.cycles, 144, "path A T-state total (teardown skipped)");
  assert.deepEqual(
    res.calls,
    [0x4c63, 0x4b55, 0x3a6f, 0x01f9],
    "path A call/tail-jump sequence (no teardown calls)",
  );
  assert.equal(res.w8001, 0, "0x8001 cleared to 0");
  assert.equal(res.w8002, 1, "0x8002 armed to 1");
  assert.equal(res.a, 1, "A = 1 on exit (ld a,0x00; inc a)");
}

test("loc_0371 path A: (0x8001)=5 skips teardown, total 144 T", () => {
  checkPathA(run(loc_0371, { p8001: 0x05 }));
});

// -- PATH B: (0x8001)=1, (0x8048)=0 -> player-1 pass, both call nz NOT taken,
//    jr nz taken (player-2 pass skipped) ------------------------------------
// 58 (entry, jr nc not taken 7) + 112 (first pass, call nz not taken 10)
//   + 45 (13+13+7 + jr nz taken 12) + 81 (loc_03ac) = 296 T.
function checkPathB(res) {
  assert.equal(res.cycles, 296, "path B T-state total (player-1 pass, no call nz)");
  assert.deepEqual(
    res.calls,
    [0x4c63, 0x4b46, 0x4bff, 0x4cbf, 0x4b55, 0x3a6f, 0x01f9],
    "path B call sequence -- 0x4df8 NOT fired ((0x8048)==0)",
  );
  assert.equal(res.w8001, 0, "0x8001 cleared to 0");
  assert.equal(res.w8002, 1, "0x8002 armed to 1");
  assert.equal(res.a, 1, "A = 1 on exit");
}

test("loc_0371 path B: (0x8001)=1 runs player-1 pass, no call nz, total 296 T", () => {
  checkPathB(run(loc_0371, { p8001: 0x01, p8048: 0x00 }));
});

// -- PATH C: (0x8001)=2, (0x8048)!=0 -> both passes, both call nz TAKEN --------
// 58 (entry) + 119 (first pass, call nz taken 17) + 40 (13+13+7 + jr nz not taken 7)
//   + 51 (17+13+4 + call nz taken 17) + 81 (loc_03ac) = 349 T.
test("loc_0371 path C: (0x8001)=2 with (0x8048)!=0 runs both passes, total 349 T", () => {
  const res = run(loc_0371, { p8001: 0x02, p8048: 0x09 });
  assert.equal(res.cycles, 349, "path C T-state total (both call nz taken)");
  assert.deepEqual(
    res.calls,
    [0x4c63, 0x4b46, 0x4bff, 0x4cbf, 0x4df8, 0x4cbf, 0x4df8, 0x4b55, 0x3a6f, 0x01f9],
    "path C call sequence -- 0x4cbf and 0x4df8 each fire twice",
  );
  assert.equal(res.w8001, 0, "0x8001 cleared to 0");
  assert.equal(res.w8002, 1, "0x8002 armed to 1");
  assert.equal(res.a, 1, "A = 1 on exit");
});

// -- MUTATION: the `jr nc` at 0x037d flipped to `jr c`. On the PATH-B gate
// ((0x8001)==1) C is SET after `dec a; cp 0x02`, so the mutant WRONGLY takes the
// branch to loc_03ac and skips the entire player-1 teardown -- 144 T with calls
// [0x4c63,0x4b55,0x3a6f,0x01f9] instead of path B's 296 T and teardown calls.
// The path-B spec MUST reject it. This straight-line trace is exactly the mutant's
// executed path on the path-B input.
function loc_0371_pathB_MUTANT(m) {
  const { regs, mem } = m;
  regs.sp = 0x83ff; m.step(0x0374, 10);
  m.push16(0x0377); m.step(0x4c63, 17); m.call(0x4c63);
  regs.a = mem.read8(0x8001); m.step(0x037a, 13);
  regs.a = regs.dec8(regs.a); m.step(0x037b, 4);
  regs.cp(0x02); m.step(0x037d, 7);
  m.step(0x03ac, 12); // BUG: `jr c` taken here; the real `jr nc` is NOT taken on this input
  regs.a = 0x00; m.step(0x03ae, 7);
  mem.write8(0x8001, regs.a); m.step(0x03b1, 13);
  regs.a = regs.inc8(regs.a); m.step(0x03b2, 4);
  mem.write8(0x8002, regs.a); m.step(0x03b5, 13);
  m.push16(0x03b8); m.step(0x4b55, 17); m.call(0x4b55);
  m.push16(0x03bb); m.step(0x3a6f, 17); m.call(0x3a6f);
  m.step(0x01f9, 10);
  return m.call(0x01f9);
}

test("mutation (jr nc polarity flipped) is caught by the path-B spec", () => {
  // Sanity: the real routine passes its own path-B spec.
  checkPathB(run(loc_0371, { p8001: 0x01, p8048: 0x00 }));

  const bad = run(loc_0371_pathB_MUTANT, { p8001: 0x01, p8048: 0x00 });
  // The mutant really does diverge: it took the wrong branch and skipped teardown.
  assert.deepEqual(bad.calls, [0x4c63, 0x4b55, 0x3a6f, 0x01f9], "mutant skipped the teardown");
  assert.equal(bad.cycles, 144, "mutant charged the skipped path, not path B");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkPathB(bad));
});
