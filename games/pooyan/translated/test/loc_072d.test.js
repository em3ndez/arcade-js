// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_072d (ROM 0x072d-0x075c): the final-fill setup routine.
// Flat-RAM mock (real Regs). loc_02ce / loc_075d / loc_0038 are plain-ret routines, so each of
// those call sites is pattern-A -- the stub runs m.ret() to pop the pushed return. The tail
// `jp nz,0x020f` is a delegate (no pushed return), so that stub only records.
// The stub also models loc_02ce's Z result (its final `dec (0x8809)`), which the `ret nz` branches on.
//
// Run: node --test games/pooyan/translated/test/loc_072d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_Z } from "../../../../core/cpu/z80.js";
import { loc_072d } from "../loc_072d.js";

const CALLER_RET = 0xabcd;
const PATTERN_A = new Set([0x02ce, 0x075d, 0x0038]);

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Pattern-A callees pop their pushed return via m.ret(); loc_02ce additionally leaves Z per its
// final `dec (0x8809)` -- zAfter02ce models whether that counter hit zero (Z -> ret nz not taken).
function installStubs(m, { zAfter02ce = true } = {}) {
  m.call = (addr) => {
    m.calls.push(addr);
    if (PATTERN_A.has(addr)) {
      m.ret();
      if (addr === 0x02ce) m.regs.f = zAfter02ce ? F_Z : 0x00;
    }
    return undefined; // 0x020f delegate: no pushed return, record only
  };
}

// ── Full success: loc_02ce final fill (Z), self-test tally == 0x10 -> complete setup ────────────
test("loc_072d full path: Z from loc_02ce + (0x8fff)==0x10 -> full setup; 276 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installStubs(m, { zAfter02ce: true });
  m.mem.write8(0x8fff, 0x10);

  loc_072d(m);

  assert.equal(m.tstates, 276, "full-path T-state total");
  assert.equal(m.pc, CALLER_RET, "returns to caller after setup");
  assert.equal(m.mem.read8(0x8806), 0x00, "(0x8806) cleared");
  assert.equal(m.mem.read8(0x8805), 0x01, "(0x8805) set to 1");
  assert.equal(m.mem.read8(0x880a), 0x00, "(0x880a) cleared");
  assert.equal(m.mem.read8(0x8e51), 0x00, "(0x8e51) attract selector cleared");
  assert.deepEqual(m.calls, [0x02ce, 0x075d, 0x0038, 0x0038, 0x0038], "loc_02ce, loc_075d, three rst-0x38 enqueues");
  assert.equal(m.regs.de, 0x0502, "DE=0x0502 for the 3rd enqueue (ld e,0x02 keeps D=0x05)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [
    0x072f, 0x02ce, 0x0732, 0x0733, 0x0736, 0x0738, 0x073b, 0x073e, 0x0740, 0x0741,
    0x0743, 0x0744, 0x0747, 0x074a, 0x075d, 0x074d, 0x0750, 0x0038, 0x0751, 0x0754,
    0x0038, 0x0755, 0x0757, 0x0038, 0x0758, 0x0759, 0x075c, CALLER_RET,
  ], "full-path boundaries");
});

// ── ret nz taken: loc_02ce leaves NZ -> bail to caller immediately ──────────────────────────────
test("loc_072d ret nz: NZ from loc_02ce -> early return, no setup; 45 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installStubs(m, { zAfter02ce: false });
  m.mem.write8(0x8806, 0x99); // sentinel: must stay untouched

  loc_072d(m);

  assert.equal(m.tstates, 45, "ret-nz T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.calls, [0x02ce], "only loc_02ce ran");
  assert.equal(m.mem.read8(0x8806), 0x99, "setup skipped -> (0x8806) untouched");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x072f, 0x02ce, 0x0732, CALLER_RET], "ret-nz boundaries");
});

// ── jp nz: self-test tally != 0x10 -> delegate to the main loop 0x020f ──────────────────────────
test("loc_072d jp nz: (0x8fff)!=0x10 -> delegate 0x020f; 69 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installStubs(m, { zAfter02ce: true });
  m.mem.write8(0x8fff, 0x05);
  m.mem.write8(0x8806, 0x99); // sentinel

  loc_072d(m);

  assert.equal(m.tstates, 69, "jp-nz T-state total");
  assert.equal(m.pc, 0x020f, "delegates to the main loop");
  assert.deepEqual(m.calls, [0x02ce, 0x020f], "loc_02ce then a tail delegate to 0x020f");
  assert.equal(m.mem.read8(0x8806), 0x99, "setup skipped -> (0x8806) untouched");
  assert.deepEqual(m.pcSeq, [0x072f, 0x02ce, 0x0732, 0x0733, 0x0736, 0x0738, 0x020f], "jp-nz boundaries");
});

test("loc_072d MUTATION: dec hl (16-bit) mis-charged 10T (not 6T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  installStubs(m, { zAfter02ce: true });
  m.mem.write8(0x8fff, 0x10);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0741 ? 10 : c);

  loc_072d(m);

  assert.equal(m.tstates, 280, "mutation adds 4 T (6 -> 10)");
  assert.notEqual(m.tstates, 276, "golden T-state total catches the mutant");
});
