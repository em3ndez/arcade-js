// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for translated loc_6bb2 (ROM 0x6bb2-0x6bed, Pooyan) -- the frame-gated bird-column
// commit. Flat-RAM mock (real Regs). loc_0038 is a plain-ret enqueue routine, so each rst-0x38 site
// is pattern-A: the stub runs m.ret() to pop the pushed return (matching loc_072d's convention, which
// charges the callee ret's 10 T). The tail `jr 0x6bae` is a delegate (no pushed return): record only.
//
// Pinned paths:
//   ret nz taken  -- (0x8d5e)=3 -> dec => 2 (NZ): bail before any scan. T = 10+11+11 = 32.
//   full path, all 11 records inactive ((iy+1)==0): jr z always taken, no store. Then (0x880a)=4 and
//     four in-routine rst-0x38 enqueues (0x06ab..0x06ae) + the tail jr to 0x6bae (which carries
//     0x06af). T = 955 (setup 57 + loop 732 + tail 166, incl 4 pattern-A callee rets).
//   full path, record 0 active -- extra store body runs once: (hl)=value at active<<8|ptr + 6.
//     T = 1017 (loop iter 0 costs 129 vs an empty iter's 67).
//
// TEETH: mis-charge `dec (hl)` (11 T) as 6 T -- the golden T-state total must catch it.
//
// Run: node --test games/pooyan/translated/test/loc_6bb2.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6bb2 } from "../loc_6bb2.js";

const CALLER_RET = 0xabcd;
const PATTERN_A = new Set([0x0038]); // loc_0038 rets -> pop the pushed return

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6bb2, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
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
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Pattern-A callees (loc_0038) pop their pushed return; the tail 0x6bae is a delegate: record only.
    call(addr) {
      this.calls.push(addr);
      if (PATTERN_A.has(addr)) this.ret();
      return undefined;
    },
  };
  return m;
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Expected pcSeq for a full run. `activeRecord0` = true means record 0 executes the store body.
function fullSeq({ activeRecord0 = false } = {}) {
  const seq = [0x6bb5, 0x6bb6, 0x6bb7, 0x6bbb, 0x6bbe, 0x6bc0];
  for (let i = 0; i < 11; i++) {
    if (i === 0 && activeRecord0) {
      seq.push(0x6bc1, 0x6bc4, 0x6bc5, 0x6bc7, 0x6bca, 0x6bcd, 0x6bce, 0x6bcf, 0x6bd0, 0x6bd2);
    } else {
      seq.push(0x6bc1, 0x6bc4, 0x6bc5, 0x6bd0, 0x6bd2);
    }
    seq.push(i < 10 ? 0x6bc0 : 0x6bd4); // djnz taken (10x) then not taken
  }
  seq.push(
    0x6bd6, 0x6bd9,
    0x6bdc, 0x0038, 0x6bdd,
    0x6be0, 0x0038, 0x6be1,
    0x6be4, 0x0038, 0x6be5,
    0x6be8, 0x0038, 0x6be9,
    0x6bec, 0x6bae,
  );
  return seq;
}

test("loc_6bb2 ret nz: (0x8d5e)=3 -> dec => 2 (NZ) -> early bail, no scan; 32 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d5e, 0x03);
  m.mem.write8(0x880a, 0x99); // sentinel: must stay untouched

  loc_6bb2(m);

  assert.equal(m.tstates, 32, "T = 10 (ld hl) + 11 (dec (hl)) + 11 (ret nz taken)");
  assert.equal(m.pc, CALLER_RET, "returns to caller via ret nz");
  assert.deepEqual(m.pcSeq, [0x6bb5, 0x6bb6, CALLER_RET], "ret-nz boundaries");
  assert.deepEqual(m.calls, [], "no scan, no enqueues");
  assert.equal(m.mem.read8(0x8d5e), 0x02, "countdown decremented to 2");
  assert.equal(m.mem.read8(0x880a), 0x99, "setup skipped -> (0x880a) untouched");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_6bb2 full path, all records inactive: scan stores nothing, then enqueues; 955 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d5e, 0x01); // dec => 0 (Z) -> fall through to the scan
  // all 11 records default to (iy+1)==0 -> inactive

  loc_6bb2(m);

  assert.equal(m.tstates, 955, "setup 57 + loop 732 + tail 166 (incl 4 callee rets)");
  assert.equal(m.mem.read8(0x8d5e), 0x00, "countdown reached 0 this tick");
  assert.equal(m.mem.read8(0x880a), 0x04, "(0x880a) set to 4 after the scan");
  assert.deepEqual(m.calls, [0x0038, 0x0038, 0x0038, 0x0038, 0x6bae],
    "four in-routine rst-0x38 enqueues then the tail jr to 0x6bae");
  assert.equal(m.regs.de, 0x06af, "DE = 0x06af (fifth cmd), carried into the tail 0x6bae");
  assert.equal(m.regs.iy, 0x8d80 + 3 * 11, "iy advanced past all 11 records (stride 3)");
  assert.equal(m.regs.b, 0x00, "loop counter exhausted");
  assert.equal(m.pc, 0x6bae, "tail-jumps to 0x6bae");
  // Net-zero SP: 4 rst pushes balanced by 4 pattern-A callee rets; the tail jr consumes no return,
  // so the seated caller return stays on the stack (sp back to its entry value 0x877e, not 0x8780).
  assert.equal(m.regs.sp, 0x877e, "SP-neutral: back to entry sp (caller return still seated)");
  assert.deepEqual(m.pcSeq, fullSeq({ activeRecord0: false }), "full inactive-scan boundaries");
});

test("loc_6bb2 full path, record 0 active: stores value into active<<8|ptr + 6; 1017 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d5e, 0x01);      // dec => 0 -> scan
  m.mem.write8(0x8d80, 0x50);      // record 0 ptr_lo
  m.mem.write8(0x8d81, 0x8a);      // record 0 active (nonzero) -> body runs, hl hi byte = 0x8a
  m.mem.write8(0x8d82, 0x2a);      // record 0 value
  // records 1..10 remain inactive (default 0)

  loc_6bb2(m);

  assert.equal(m.tstates, 1017, "one active iter (129 T) replaces an empty one (67 T): +62 over 955");
  // hl = 0x8a50, then += de + de (de=3) => 0x8a56; (hl) = value
  assert.equal(m.mem.read8(0x8a56), 0x2a, "value stored at active<<8|ptr + 6");
  assert.equal(m.mem.read8(0x880a), 0x04, "(0x880a) still set to 4");
  assert.deepEqual(m.calls, [0x0038, 0x0038, 0x0038, 0x0038, 0x6bae], "same enqueue tail");
  assert.equal(m.regs.sp, 0x877e, "SP-neutral: back to entry sp (caller return still seated)");
  assert.deepEqual(m.pcSeq, fullSeq({ activeRecord0: true }), "active-record-0 boundaries");
});

test("loc_6bb2 MUTATION: dec (hl) mis-charged 6T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d5e, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x6bb6 ? 6 : c); // dec (hl) target mischarged

  loc_6bb2(m);

  assert.equal(m.tstates, 950, "mutation loses 5 T (11 -> 6)");
  assert.notEqual(m.tstates, 955, "golden T-state total catches the mutant");
});
