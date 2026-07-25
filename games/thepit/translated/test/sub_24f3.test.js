// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated sub_24f3 (ROM 0x24f3, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. Asserts T-state totals, the
 * memory/register/flag effects, and the control flow (call order, final PC)
 * against the disassembly, plus a deliberate mutation the T-state assertion catches.
 *
 * Run: node --test games/thepit/translated/test/sub_24f3.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { sub_24f3 } from "../sub_24f3.js";

// Minimal machine matching the surface sub_24f3 uses: regs, mem, step, call, ret,
// push16/pop16. `calls` records every m.call target in order; `tstates` accumulates
// the charged cycles; `pc` tracks the last step target. Callees are stubbed (this is
// an isolated draft harness), so a `call`/tail-jump is observed only in `calls`.
function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs,
    mem,
    ram,
    calls: [],
    tstates: 0,
    pc: 0x24f3,
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
    },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) {
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callees stubbed in this isolated draft harness
    },
  };
}

// Simulate the caller's CALL: seat a return address on the stack.
const CALLER_RET = 0xabcd;
function seatCaller(m) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
}

// -- Path A: dispatch -> phase-1 handler (loc_2534) timer-expiry re-seed -----------
// 0x8077=0 & 0x80c1=0 reach loc_2507; 0x80a1 bit3 clear, 0x80bd!=2, 0x80a4!=0x18,
// 0x80a2=1 -> loc_2534. There 0x80a4=1 decrements to 0 (expiry, `jr nz` NOT taken),
// so ix=(0x806e) is re-seeded, (ix+0)/(ix+1) written from 0x80a7/0x80a8, facing
// 0x8069=0xb2, call 0x28ab, 0x80a2 cleared, then loc_2677 builds the sprite record
// and tail-jumps to 0x29ad.
function assertPathAGolden(m) {
  assert.equal(m.tstates, 565, "Path A T-state total");
  assert.deepEqual(m.calls, [0x28ab, 0x29ad], "calls: setup 0x28ab then tail-jump 0x29ad");
  assert.equal(m.pc, 0x29ad, "PC ends at the tail-jump target 0x29ad");

  // phase-1 expiry side effects
  assert.equal(m.mem.read8(0x8095), 0x09, "sprite code forced to 0x09 on expiry");
  assert.equal(m.mem.read8(0x80a4), 0x00, "step timer 0x80a4 decremented 1 -> 0");
  assert.equal(m.mem.read8(0x8069), 0xb2, "facing/blank code 0x8069 = 0xb2");
  assert.equal(m.mem.read8(0x80a2), 0x00, "phase byte 0x80a2 cleared");
  assert.equal(m.mem.read8(0x8100), 0x55, "(ix+0x00) written from 0x80a7 (ix=0x8100)");
  assert.equal(m.mem.read8(0x8101), 0x66, "(ix+0x01) written from 0x80a8");

  // loc_2677 sprite record at 0x8224: (0x8094-0x8051), 0x8095, 0x8096, (0x8097+0x8051)
  assert.equal(m.mem.read8(0x8224), 0x2c, "record[0] = 0x8094 - 0x8051 = 0x30 - 0x04");
  assert.equal(m.mem.read8(0x8225), 0x09, "record[1] = 0x8095 = 0x09");
  assert.equal(m.mem.read8(0x8226), 0x03, "record[2] = 0x8096 = 0x03");
  assert.equal(m.mem.read8(0x8227), 0x04, "record[3] = 0x8097 + 0x8051 = 0x00 + 0x04");

  assert.equal(m.regs.ix, 0x8100, "ix = (0x806e)");
  assert.equal(m.regs.b, 0x04, "b holds 0x8051 across loc_2677");
  assert.equal(m.regs.a, 0x04, "a = last `add a,b` result");
}

function runPathA(m) {
  seatCaller(m);
  m.mem.write8(0x8077, 0x00); // entry: `and a` -> Z, `jr nz` NOT taken
  m.mem.write8(0x80c1, 0x00); // `and a` -> Z, `jr z,0x2507` taken
  m.mem.write8(0x80a1, 0x00); // `and 0x08` -> 0 -> `jp nz,0x272d` NOT taken
  m.mem.write8(0x80bd, 0x00); // cp 0x02 -> NZ -> `jp z,0x2696` NOT taken
  m.mem.write8(0x80a4, 0x01); // cp 0x18 -> NZ (no call z); later dec 1 -> 0 (expiry)
  m.mem.write8(0x80a2, 0x01); // dec -> 0 -> `jr z,0x2534` (phase 1)
  m.mem.write16(0x806e, 0x8100); // linked entity pointer -> ix
  m.mem.write8(0x80a7, 0x55); // non-zero -> write (ix+0x00)
  m.mem.write8(0x80a8, 0x66); // non-zero -> write (ix+0x01)
  m.mem.write8(0x8051, 0x04); // scroll/base subtracted in loc_2677
  m.mem.write8(0x8094, 0x30); // x position (untouched on the expiry branch)
  m.mem.write8(0x8096, 0x03); // frame index (untouched on the expiry branch)
  m.mem.write8(0x8097, 0x00); // y position (untouched on the expiry branch)
  sub_24f3(m);
}

test("sub_24f3 Path A: phase-1 timer expiry re-seeds, builds record, tail-jumps 0x29ad", () => {
  const m = makeMachine();
  runPathA(m);
  assertPathAGolden(m);
});

// -- Path B: 0x8077 != 0 -> loc_24ff forces sprite 0x09, straight to loc_2677 ------
test("sub_24f3 Path B: (0x8077) != 0 -> loc_24ff -> loc_2677 -> tail-jump 0x29ad", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8077, 0x01); // `and a` -> NZ -> `jr nz,0x24ff` taken
  m.mem.write8(0x8051, 0x00); // b = 0
  m.mem.write8(0x8094, 0x40);
  m.mem.write8(0x8096, 0x00);
  m.mem.write8(0x8097, 0x55);
  sub_24f3(m);

  assert.equal(m.tstates, 202, "13+4+12 (entry) + 7+13+10 (loc_24ff) + 143 (loc_2677)");
  assert.deepEqual(m.calls, [0x29ad], "no CALL ran -- only the tail-jump");
  assert.equal(m.pc, 0x29ad, "ends at the tail-jump target");
  assert.equal(m.mem.read8(0x8095), 0x09, "loc_24ff forced sprite code 0x09");
  assert.equal(m.mem.read8(0x8224), 0x40, "record[0] = 0x8094 - 0x8051 = 0x40 - 0x00");
  assert.equal(m.mem.read8(0x8225), 0x09, "record[1] = the forced 0x09");
  assert.equal(m.mem.read8(0x8227), 0x55, "record[3] = 0x8097 + 0x8051 = 0x55 + 0x00");
});

// -- Path C: 0x80c1 != 0 with 0x8077 == 0 also falls into loc_24ff -----------------
// Both entry `jr` outcomes that skip loc_2507 land at loc_24ff; here `jr z,0x2507`
// is NOT taken (7 T) and control fall-through-jumps to loc_24ff.
test("sub_24f3 Path C: 0x8077==0 & 0x80c1!=0 -> `jr z` not taken -> loc_24ff", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8077, 0x00); // `jr nz` NOT taken
  m.mem.write8(0x80c1, 0x80); // `and a` -> NZ -> `jr z,0x2507` NOT taken -> loc_24ff
  sub_24f3(m);

  // entry: 13+4+7 (jr nz nt) + 13+4+7 (jr z nt) = 48 ; loc_24ff 7+13+10 = 30 ; loc_2677 143
  assert.equal(m.tstates, 48 + 30 + 143, "not-taken entry path into loc_24ff");
  assert.deepEqual(m.calls, [0x29ad], "only the tail-jump");
  assert.equal(m.mem.read8(0x8095), 0x09, "loc_24ff forced sprite code 0x09");
});

// -- MUTATION: the T-state total must have teeth ----------------------------------
// Mistranslate `ld ix,(0x806e)` (DD 2A, 20 T) as the `ld hl,(nn)` timing (16 T) -- a
// plausible copy error, same logic, wrong cycle budget. Run Path A with that one
// instruction mis-charged and confirm the golden T-state assertion catches it. (The
// `ld ix,(0x806e)` in loc_2534 is the only instruction that steps to 0x254b.)
test("sub_24f3 MUTATION: `ld ix,(nn)` mis-charged 16T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) =>
    realStep(nextAddr, nextAddr === 0x254b ? 16 : cycles);

  runPathA(m);

  assert.equal(m.tstates, 561, "mutation loses exactly 4 T (20 -> 16)");
  assert.throws(
    () => assertPathAGolden(m),
    /Path A T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
