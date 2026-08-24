// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_7f5d (ROM 0x7f5d-0x7fa7): write-anim dispatcher table entry 2.
// Self-contained mock (real Regs for exact flags, flat 64K RAM). A returning callee's stub
// balances the pushed slot (SP += 2); the sole delegate here (0x7fa8) is a tail jr with no
// preceding push, so it stays record-only. Covers: gate ret-nz, the jr-z tail delegation,
// and the full writeback body + ret; plus a T-state mutation.
//
// Run: node --test games/pooyan/translated/test/loc_7f5d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7f5d } from "../loc_7f5d.js";

const CALLER_RET = 0xabcd;
const RETURNING = new Set([0x0038, 0x0010]); // returning callees would balance their push

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
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); if (RETURNING.has(addr)) regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); return m.regs.sp; }

// ── gate ret nz: (0x8e29)&7 != 1 -> straight back to the caller ──────────────────────────────────
test("loc_7f5d gate ret nz: ring != 1 -> ret, no writes past the ring; 96 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8e21, 0x9000); // HL <- 0x9000
  m.mem.write8(0x9000, 0x00);    // A=0 -> bit4=0 -> carry 0
  m.mem.write8(0x8e29, 0x00);    // rl -> 0, &7 -> 0, cp 1 -> nz

  loc_7f5d(m);

  assert.equal(m.tstates, 96, "gate ret-nz T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.calls, [], "no delegation");
  assert.equal(m.mem.read8(0x8e29), 0x00, "ring rolled to 0");
  assert.equal(m.regs.sp, 0x8780, "ret popped the caller slot");
  assert.deepEqual(m.pcSeq,
    [0x7f60, 0x7f61, 0x7f64, 0x7f65, 0x7f66, 0x7f67, 0x7f68, 0x7f6a, 0x7f6b, 0x7f6d, 0x7f6f, CALLER_RET],
    "step boundaries");
});

// ── gate passes, jr z taken: (0x8e25) drains to 0 -> tail-delegate to 0x7fa8 ─────────────────────
test("loc_7f5d jr z taken: countdown hits 0 -> tail 0x7fa8; 231 T", () => {
  const m = makeMachine();
  const sp0 = seatCaller(m);
  m.mem.write16(0x8e21, 0x9000);
  m.mem.write8(0x9000, 0x10);    // bit4 set -> carry 1
  m.mem.write8(0x8e29, 0x00);    // rl -> 0x01 -> &7==1 -> gate passes
  m.mem.write8(0x8e23, 0x42);
  m.mem.write16(0x8e1f, 0x9100); // writeback pointer
  m.mem.write8(0x8e25, 0x01);    // dec -> 0 -> jr z taken

  loc_7f5d(m);

  assert.equal(m.tstates, 231, "jr-z-taken T-state total");
  assert.equal(m.pc, 0x7fa8, "tail-delegates to 0x7fa8");
  assert.deepEqual(m.calls, [0x7fa8], "sole tail delegation");
  assert.equal(m.mem.read8(0x8e29), 0x01, "ring got the carry bit");
  assert.equal(m.mem.read16(0x8e2b), 0x03a0, "(0x8e2b) seeded 0x03a0");
  assert.equal(m.mem.read8(0x9100), 0x42, "(0x8e23) copied to *(0x8e1f)");
  assert.equal(m.mem.read16(0x8e1f), 0x9101, "(0x8e1f) advanced");
  assert.equal(m.mem.read8(0x8e25), 0x00, "countdown stored back as 0");
  assert.equal(m.regs.sp, sp0, "tail delegate left SP put (no push)");
  assert.deepEqual(m.pcSeq,
    [0x7f60, 0x7f61, 0x7f64, 0x7f65, 0x7f66, 0x7f67, 0x7f68, 0x7f6a, 0x7f6b, 0x7f6d, 0x7f6f,
     0x7f70, 0x7f73, 0x7f76, 0x7f79, 0x7f7c, 0x7f7d, 0x7f7e, 0x7f81, 0x7f84, 0x7f85, 0x7f86, 0x7f87,
     0x7f8a, 0x7fa8],
    "step boundaries");
});

// ── gate passes, jr z NOT taken: full writeback body then ret ────────────────────────────────────
test("loc_7f5d jr z not taken: countdown nonzero -> full body + ret; 363 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8e21, 0x9000);
  m.mem.write8(0x9000, 0x10);
  m.mem.write8(0x8e29, 0x00);
  m.mem.write8(0x8e23, 0x42);
  m.mem.write16(0x8e1f, 0x9100);
  m.mem.write8(0x8e25, 0x05);    // dec -> 0x04 -> jr z not taken
  m.mem.write16(0x8e27, 0x9200); // second writeback pointer

  loc_7f5d(m);

  assert.equal(m.tstates, 363, "jr-z-not-taken T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "no delegation on this arm");
  assert.equal(m.mem.read8(0x8e25), 0x04, "countdown decremented, nonzero");
  assert.equal(m.mem.read8(0x9100), 0x42, "first writeback (via 0x8e1f)");
  assert.equal(m.mem.read16(0x8e1f), 0x9101, "(0x8e1f) advanced");
  assert.equal(m.mem.read8(0x9200), 0x42, "(0x8e23) written to *(0x8e27)");
  assert.equal(m.mem.read16(0x8e27), 0x91e0, "(0x8e27) backed up 0x20 (added 0xffe0)");
  assert.equal(m.mem.read8(0x91e0), 0x11, "0x11 tile stamped at the new (0x8e27)");
  assert.equal(m.mem.read8(0x8e26), 0x01, "(0x8e26) flag set");
  assert.equal(m.mem.read8(0x8e23), 0x11, "(0x8e23) re-primed to 0x11");
  assert.equal(m.mem.read16(0x8e2b), 0x03a0, "(0x8e2b) seeded 0x03a0");
  assert.deepEqual(m.pcSeq,
    [0x7f60, 0x7f61, 0x7f64, 0x7f65, 0x7f66, 0x7f67, 0x7f68, 0x7f6a, 0x7f6b, 0x7f6d, 0x7f6f,
     0x7f70, 0x7f73, 0x7f76, 0x7f79, 0x7f7c, 0x7f7d, 0x7f7e, 0x7f81, 0x7f84, 0x7f85, 0x7f86, 0x7f87,
     0x7f8a, 0x7f8c, 0x7f8f, 0x7f92, 0x7f93, 0x7f96, 0x7f97, 0x7f9a, 0x7f9c, 0x7f9d, 0x7f9f, 0x7fa2,
     0x7fa4, 0x7fa7, CALLER_RET],
    "step boundaries");
});

// ── MUTATION: `rl (hl)` mis-charged 10T (not 15T) is caught by the golden total ──────────────────
test("loc_7f5d MUTATION: rl (hl) mis-charged 10T (not 15T)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write16(0x8e21, 0x9000);
  m.mem.write8(0x9000, 0x00);
  m.mem.write8(0x8e29, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7f6a ? 10 : c);
  loc_7f5d(m);
  assert.equal(m.tstates, 91, "mutation loses 5 T (15 -> 10)");
  assert.notEqual(m.tstates, 96, "golden T-state total catches the mutant");
});
