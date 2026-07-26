// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_2d06 (ROM 0x2d06-0x2d4b), The Pit.
//
// loc_2d06 advances the target Y (0x80ac += 1), computes a video-RAM tile cell from the
// target X/Y at 0x80a9/0x80ac, reloads it into ix, and probes the tile at (ix-0x1e):
//   - tile == 0x2a -> jr z  tail-jump to loc_2d4e
//   - tile == 0x2b -> jr z  tail-jump to loc_2d4e
//   - tile == 0x41 -> jp nz NOT taken, fall through -> loc_2d4e
//   - otherwise     -> jp nz tail-jump to loc_2bd3
//
// Every exit is a TAIL-JUMP (loc_2d06 keeps no frame): each pushed nothing, so its stub
// pops the SENTINEL and the T-state total is loc_2d06's OWN cost, and pc lands on the
// caller's return address.
//
// Fixture X=0x40, Y=0x20 makes the arithmetic land on a concrete, checkable address:
//   X>>3 = 8; 0x1f-8 = 0x17 -> h; Y+1 = 0x21 stored at 0x80ac; Y+2 = 0x22 -> e,
//   (Y+2)>>3 = 4 -> bc; the srl/rra chain gives l=0xE0, h=0x02 -> hl=0x02E0;
//   +bc(4) = 0x02E4; +0x9000 = 0x92E4 = ix; (ix-0x1e) = 0x92C6 is the probed tile.
// Pre-writing 0x92C6 selects the branch.
//
// Four path specs (0x2a / 0x2b / 0x41 / other) + a full arithmetic/register spec, plus a
// deliberate mutation (the final `jp nz,0x2bd3` sense flipped) that the "other-tile" spec
// must catch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_2d06 } from "../loc_2d06.js";

const TAIL_LAND = 0x2d4e; // "landed tile" handler tail-jump target
const TAIL_CONT = 0x2bd3; // "keep going" record/continue tail-jump target
const SENTINEL = 0xbeef; // caller return address the tail-callee's ret lands on
const SP0 = 0x8780; // SP inside work RAM so pushes/pops are mapped

const PROBE_ADDR = 0x92c6; // (ix-0x1e) for the X=0x40,Y=0x20 fixture
const CELL_ADDR = 0x92e4; // the stored/reloaded tile cell

function buildRom() {
  return new Uint8Array(0x5000); // AddressSpace requires a 20480-byte ROM; contents unused
}

// Minimal machine: real mem/io/regs + the step/call/push16 seam. The call stub records the
// target and models a bare `ret` (pop -> pc); loc_2d06 has no register-returning calls.
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x2d06;
    this.calls = [];
    this.regs.sp = SP0;
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
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16(); // bare ret: pop the caller return address a tail-callee would use
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

// Base fixture: X=0x40 at 0x80a9, Y=0x20 at 0x80ac. `tile` is written at the probe address.
function run(tile) {
  const m = new TestMachine(buildRom());
  m.mem.write8(0x80a9, 0x40);
  m.mem.write8(0x80ac, 0x20);
  m.mem.write8(PROBE_ADDR, tile);
  m.push16(SENTINEL); // the caller's return address
  loc_2d06(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    regs: m.regs,
    y: m.mem.read8(0x80ac),
    cellLo: m.mem.read8(0x80af),
    cellHi: m.mem.read8(0x80b0),
    probe: m.mem.read8(PROBE_ADDR),
  };
}

// ============================================================================
// SPEC: the address arithmetic and the always-run Y side effect (checked on the
// "other tile" path, which runs the full body straight through to the jp nz).
//   Straight-line through cp 0x41 = 270 T of body; +7(cp2b)... see below. Total 308.
// ============================================================================
test("loc_2d06: computes cell 0x92E4, advances Y, tail-jumps to loc_2bd3 on a plain tile", () => {
  const r = run(0x00);
  assert.equal(r.y, 0x21, "0x80ac advanced from 0x20 to 0x21");
  assert.equal(r.cellLo, 0xe4, "0x80af = low byte of the computed cell 0x92E4");
  assert.equal(r.cellHi, 0x92, "0x80b0 = high byte of the computed cell 0x92E4");
  assert.equal(r.regs.ix, CELL_ADDR, "ix reloaded from (0x80af) = 0x92E4");
  assert.equal(r.regs.h, 0x92, "h = high byte of the final hl = 0x92E4");
  assert.equal(r.regs.l, 0xe4, "l = low byte of the final hl = 0x92E4");
  assert.equal(r.regs.e, 0x22, "e = Y+2 = 0x22 (preserved to the end)");
  assert.equal(r.regs.b, 0x90, "bc = 0x9000 from the base load: b = 0x90");
  assert.equal(r.regs.c, 0x00, "bc = 0x9000 from the base load: c = 0x00");
  assert.equal(r.regs.a, 0x00, "a holds the probed tile (cp leaves a unchanged)");
  assert.deepEqual(r.calls, [TAIL_CONT], "plain tile -> tail-jump to loc_2bd3");
  assert.equal(r.pc, SENTINEL, "loc_2bd3's ret returns to loc_2d06's caller");
  assert.equal(r.sp, SP0, "stack balanced");
  assert.equal(r.cycles, 308, "other-tile path (both cp miss, jp nz taken) is 308 T");
});

// ============================================================================
// SPEC: tile 0x2a -> the FIRST `jr z` (0x2d43) fires.
//   270 (body through cp 0x2a) + 12 (jr z taken) = 282 T.
// ============================================================================
test("loc_2d06: tile 0x2a -> jr z tail-jump to loc_2d4e, 282 T", () => {
  const r = run(0x2a);
  assert.deepEqual(r.calls, [TAIL_LAND], "tile 0x2a -> loc_2d4e");
  assert.equal(r.cycles, 282, "first jr z (taken) path is 282 T");
  assert.equal(r.pc, SENTINEL, "returns to caller");
  assert.equal(r.y, 0x21, "Y still advanced on this path");
});

// ============================================================================
// SPEC: tile 0x2b -> the SECOND `jr z` (0x2d47) fires.
//   270 +7(jr z nt)+7(cp 0x2b)+12(jr z taken) = 296 T.
// ============================================================================
test("loc_2d06: tile 0x2b -> second jr z tail-jump to loc_2d4e, 296 T", () => {
  const r = run(0x2b);
  assert.deepEqual(r.calls, [TAIL_LAND], "tile 0x2b -> loc_2d4e");
  assert.equal(r.cycles, 296, "second jr z (taken) path is 296 T");
});

// ============================================================================
// SPEC: tile 0x41 -> the `jp nz` (0x2d4b) is NOT taken; fall through into loc_2d4e.
//   270 +7+7(two jr z nt)+7(cp 0x41)+10(jp nz NOT taken) = 308 T; same cost as the
//   plain-tile path but the delegation target is loc_2d4e, not loc_2bd3.
// ============================================================================
test("loc_2d06: tile 0x41 -> jp nz not taken, falls through to loc_2d4e, 308 T", () => {
  const r = run(0x41);
  assert.deepEqual(r.calls, [TAIL_LAND], "tile 0x41 falls through to loc_2d4e");
  assert.equal(r.cycles, 308, "fall-through path is 308 T (jp nz not taken costs 10 T)");
  assert.equal(r.pc, SENTINEL, "loc_2d4e's ret returns to loc_2d06's caller");
});

// ============================================================================
// MUTATION: flip the final `jp nz,0x2bd3` (0x2d4b) sense (fNZ -> fZ). On the plain-tile
// (0x00) fixture the tile is not 0x41, so Z is CLEAR: the real routine tail-jumps to
// loc_2bd3, but the mutant (branch on Z) falls through to loc_2d4e instead. The
// "other tile" spec (calls == [loc_2bd3]) rejects it.
// ============================================================================
function loc_2d06_mutant(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x80a9); m.step(0x2d09, 13);
  regs.a = regs.srl(regs.a); m.step(0x2d0b, 8);
  regs.a = regs.srl(regs.a); m.step(0x2d0d, 8);
  regs.a = regs.srl(regs.a); m.step(0x2d0f, 8);
  regs.neg(); m.step(0x2d11, 8);
  regs.add(0x1f); m.step(0x2d13, 7);
  regs.h = regs.a; m.step(0x2d14, 4);
  regs.a = mem.read8(0x80ac); m.step(0x2d17, 13);
  regs.add(0x01); m.step(0x2d19, 7);
  mem.write8(0x80ac, regs.a); m.step(0x2d1c, 13);
  regs.a = regs.inc8(regs.a); m.step(0x2d1d, 4);
  regs.e = regs.a; m.step(0x2d1e, 4);
  regs.a = regs.srl(regs.a); m.step(0x2d20, 8);
  regs.a = regs.srl(regs.a); m.step(0x2d22, 8);
  regs.a = regs.srl(regs.a); m.step(0x2d24, 8);
  regs.c = regs.a; m.step(0x2d25, 4);
  regs.a = 0x00; m.step(0x2d27, 7);
  regs.b = regs.a; m.step(0x2d28, 4);
  regs.h = regs.srl(regs.h); m.step(0x2d2a, 8);
  regs.rra(); m.step(0x2d2b, 4);
  regs.h = regs.srl(regs.h); m.step(0x2d2d, 8);
  regs.rra(); m.step(0x2d2e, 4);
  regs.h = regs.srl(regs.h); m.step(0x2d30, 8);
  regs.rra(); m.step(0x2d31, 4);
  regs.l = regs.a; m.step(0x2d32, 4);
  regs.addHl(regs.bc); m.step(0x2d33, 11);
  regs.bc = 0x9000; m.step(0x2d36, 10);
  regs.addHl(regs.bc); m.step(0x2d37, 11);
  mem.write16(0x80af, regs.hl); m.step(0x2d3a, 16);
  regs.ix = mem.read16(0x80af); m.step(0x2d3e, 20);
  regs.a = mem.read8((regs.ix - 0x1e) & 0xffff); m.step(0x2d41, 19);
  regs.cp(0x2a); m.step(0x2d43, 7);
  if (regs.fZ) { m.step(0x2d4e, 12); return m.call(0x2d4e); }
  m.step(0x2d45, 7);
  regs.cp(0x2b); m.step(0x2d47, 7);
  if (regs.fZ) { m.step(0x2d4e, 12); return m.call(0x2d4e); }
  m.step(0x2d49, 7);
  regs.cp(0x41); m.step(0x2d4b, 7);
  if (regs.fZ) { m.step(0x2bd3, 10); return m.call(0x2bd3); } // BUG: real is `jp nz` (branch on Z clear)
  m.step(0x2d4e, 10);
  return m.call(0x2d4e);
}

test("mutation (jp nz -> jp z at 0x2d4b) is caught by the plain-tile spec", () => {
  const m = new TestMachine(buildRom());
  m.mem.write8(0x80a9, 0x40);
  m.mem.write8(0x80ac, 0x20);
  m.mem.write8(PROBE_ADDR, 0x00);
  m.push16(SENTINEL);
  loc_2d06_mutant(m);
  assert.deepEqual(m.calls, [TAIL_LAND], "mutant wrongly falls through to loc_2d4e");
  assert.throws(
    () => assert.deepEqual(m.calls, [TAIL_CONT]),
    "the plain-tile spec's calls==[loc_2bd3] assertion rejects the flipped-branch mutant",
  );
});
