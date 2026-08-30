// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_12af (ROM 0x12af-0x12fa): a per-object update tick driven off IX.
// Flat-RAM mock (real Regs). Pattern-A callees (0x4006, 0x0c45, 0x0020/rst 0x20) pop the pushed
// return via m.ret(); the rst-0x20 stub also seats A to a controlled table value so the
// `cp c` / `jp z` / `ret c` fan can be pinned. The tail `jp`s (0x13fe, 0x1399, 0x1383, 0x381e)
// are delegates: no pushed return, the stub only records.
//
// Pinned paths:
//   A: (ix+0x08)!=0 -> jp nz,0x13fe. T = 60.
//   B: phase gate (0x8901)<3 -> jp c,0x1399, exercising the carry path (jr nc not taken ->
//      inc (ix+0x06)). T = 181.
//   C: full path to jp 0x381e -- no carry (jr nc taken), (0x8901)>=3, cp c != 0, (ix+0x06)>=0x14.
//      T = 369.
//   D: ret c -- (ix+0x06) < 0x14 and != table value -> return to caller. T = 336.
//
// TEETH (mutation): mis-charge `ld a,(ix+0x06)` (19 T) as 7 T on the full path.
//
// Run: node --test games/pooyan/translated/test/loc_12af.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_12af } from "../loc_12af.js";

const CALLER_RET = 0xabcd;
const PATTERN_A = new Set([0x4006, 0x0c45, 0x0020]);

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x12af, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Pattern-A callees pop their pushed return via m.ret(). rst 0x20 additionally leaves A = rst20A
// (the fetched table value), which drives `ld c,a` / `cp c`.
function installStubs(m, { rst20A = 0x00 } = {}) {
  m.call = (addr) => {
    m.calls.push(addr);
    if (PATTERN_A.has(addr)) {
      m.ret();
      if (addr === 0x0020) m.regs.a = rst20A & 0xff;
    }
    return undefined; // delegate tails: no pushed return, record only
  };
}

// ── Path A: (ix+0x08) latched -> jp nz,0x13fe ────────────────────────────────────────────────
test("loc_12af path A: (ix+0x08)!=0 delegates to 0x13fe; 60 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installStubs(m);
  m.regs.ix = 0x8a00;
  m.mem.write8(0x8a08, 0x01); // (ix+0x08) set

  loc_12af(m);

  assert.equal(m.tstates, 60, "T = 17+10(call/ret 0x4006)+19+4+10(jp nz taken)");
  assert.equal(m.pc, 0x13fe, "delegates to 0x13fe");
  assert.deepEqual(m.calls, [0x4006, 0x13fe], "housekeeping then delegate");
  assert.deepEqual(m.pcSeq, [0x4006, 0x12b2, 0x12b5, 0x12b6, 0x13fe], "path-A boundaries");
  assert.equal(m.regs.sp, 0x877e, "no leak: caller return still seated, call balanced");
});

// ── Path B: carry into (ix+0x06), then phase gate < 3 -> jp c,0x1399 ──────────────────────────
test("loc_12af path B: carry increments (ix+0x06); (0x8901)<3 delegates to 0x1399; 181 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installStubs(m);
  m.regs.ix = 0x8a00;
  m.mem.write8(0x8a08, 0x00); // (ix+0x08) clear
  m.mem.write8(0x8a05, 0xf0); // (ix+0x05)
  m.mem.write8(0x8a09, 0x20); // (ix+0x09): 0xf0+0x20 = 0x110 -> carry
  m.mem.write8(0x8a06, 0x07); // (ix+0x06) coarse counter
  m.mem.write8(0x8901, 0x02); // phase gate < 3

  loc_12af(m);

  assert.equal(m.tstates, 181, "carry path T total");
  assert.equal(m.pc, 0x1399, "delegates to 0x1399");
  assert.deepEqual(m.calls, [0x4006, 0x1399], "housekeeping then delegate");
  assert.equal(m.mem.read8(0x8a06), 0x08, "(ix+0x06) incremented by the carry");
  assert.equal(m.mem.read8(0x8a05), 0x10, "(ix+0x05) = 0xf0+0x20 = 0x10");
  assert.equal(m.regs.b, 0x10, "B = new (ix+0x05)");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x12b2, 0x12b5, 0x12b6, 0x12b9, 0x12bc, 0x12bf, 0x12c1, 0x12c4,
    0x12c7, 0x12c8, 0x12cb, 0x12cd, 0x1399,
  ], "path-B boundaries (carry -> 0x12c1 inc)");
  assert.equal(m.regs.sp, 0x877e, "no leak");
});

// ── Path C: full path to jp 0x381e ────────────────────────────────────────────────────────────
test("loc_12af path C: no-carry, gate>=3, cp c!=0, (ix+0x06)>=0x14 -> latch + jp 0x381e; 369 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installStubs(m, { rst20A: 0x05 }); // table value 0x05 -> C=0x05
  m.regs.ix = 0x8a00;
  m.mem.write8(0x8a08, 0x00); // (ix+0x08) clear
  m.mem.write8(0x8a05, 0x10);
  m.mem.write8(0x8a09, 0x20); // 0x10+0x20 = 0x30, no carry
  m.mem.write8(0x8a06, 0x20); // (ix+0x06)=0x20: != 0x05, and >= 0x14
  m.mem.write8(0x8901, 0x03); // gate >= 3
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x8d41, 0x00);

  loc_12af(m);

  assert.equal(m.tstates, 369, "full-path T total");
  assert.equal(m.pc, 0x381e, "jp 0x381e (spawn/next-state)");
  assert.deepEqual(m.calls, [0x4006, 0x0c45, 0x0020, 0x381e], "housekeeping, table walk, rst 0x20, tail");
  assert.equal(m.mem.read8(0x8a05), 0x30, "(ix+0x05) = 0x10+0x20");
  assert.equal(m.mem.read8(0x8a08), 0x01, "(ix+0x08) latched to 1");
  assert.equal(m.regs.de, 0x3838, "DE = 0x3838 for the tail");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x12b2, 0x12b5, 0x12b6, 0x12b9, 0x12bc, 0x12bf, 0x12c4, 0x12c7, 0x12c8,
    0x12cb, 0x12cd, 0x12d0, 0x12d3, 0x12d6, 0x12d8, 0x12da, 0x12dc, 0x0c45, 0x12df,
    0x12e0, 0x12e3, 0x12e5, 0x0020, 0x12e6, 0x12e7, 0x12ea, 0x12eb, 0x12ee, 0x12f0,
    0x12f1, 0x12f5, 0x12f8, 0x381e,
  ], "full-path boundaries");
  assert.equal(m.regs.sp, 0x877e, "no leak: all calls balanced, caller return still seated (jp tail)");
});

// ── Path D: ret c -- (ix+0x06) < 0x14 -> return to caller ─────────────────────────────────────
test("loc_12af path D: (ix+0x06) < 0x14 and != table value -> ret c to caller; 336 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installStubs(m, { rst20A: 0x05 }); // C=0x05
  m.regs.ix = 0x8a00;
  m.mem.write8(0x8a08, 0x00);
  m.mem.write8(0x8a05, 0x10);
  m.mem.write8(0x8a09, 0x20); // no carry
  m.mem.write8(0x8a06, 0x10); // (ix+0x06)=0x10: != 0x05, and < 0x14 -> ret c
  m.mem.write8(0x8901, 0x03);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x8d41, 0x00);

  loc_12af(m);

  assert.equal(m.tstates, 336, "ret-c T total");
  assert.equal(m.pc, CALLER_RET, "returns to caller via ret c");
  assert.deepEqual(m.calls, [0x4006, 0x0c45, 0x0020], "no tail delegate on the ret-c path");
  assert.equal(m.mem.read8(0x8a08), 0x00, "(ix+0x08) NOT latched on the ret-c path");
  assert.equal(m.regs.sp, 0x8780, "stack balanced: ret c popped the caller return");
});

// ── MUTATION: mis-charge `ld a,(ix+0x06)` (19T) as 7T on the full path ────────────────────────
test("loc_12af MUTATION: `ld a,(ix+0x06)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  installStubs(m, { rst20A: 0x05 });
  m.regs.ix = 0x8a00;
  m.mem.write8(0x8a05, 0x10);
  m.mem.write8(0x8a09, 0x20);
  m.mem.write8(0x8a06, 0x20);
  m.mem.write8(0x8901, 0x03);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x12ea ? 7 : c); // 12e7 ld a,(ix+0x06) steps to 0x12ea

  loc_12af(m);

  assert.equal(m.tstates, 357, "mutation loses 12 T (19 -> 7)");
  assert.notEqual(m.tstates, 369, "golden T-state total catches the mutant");
});
