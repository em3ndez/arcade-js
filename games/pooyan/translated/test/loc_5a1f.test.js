// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_5a1f (ROM 0x5a1f-0x5a55): the variant-B score-drip step (ring
// 0x882d, counter 0x8826, coord pair 0x882e/0x882f). Self-contained mock (real Regs for exact
// flags). The mid-body `call 0x0f09` pushes its return; the stub balances that push (SP += 2)
// for returning callees only, leaving the tail delegate (0x5a8c/0x5a8a) record-only.
//
// Run: node --test games/pooyan/translated/test/loc_5a1f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5a1f } from "../loc_5a1f.js";

const CALLER_RET = 0xabcd;
const RETURNING = new Set([0x0f09, 0x0038, 0x0010]);

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

// ── full path: ring==1, first coord has not overtaken the second -> wrap + jr nz to 0x5a8c ──────
function setupFull(m) {
  const sp0 = seatCaller(m);
  m.mem.write8(0x8810, 0x02); // bit1 -> carry after 2 rrca
  m.mem.write8(0x882d, 0x00); // rl -> 0x01 -> ring low-3 == 1
  m.mem.write8(0x8826, 0x00); // counter, inc -> 0x01
  m.mem.write8(0x882e, 0x20); // first coord: +0x10 -> 0x30 = B
  m.mem.write8(0x882f, 0x25); // second coord < B -> sub b borrows -> ret nc not taken
  return sp0;
}

test("loc_5a1f full: ring==1, partial wrap -> counter++, coords rewritten, jr nz 0x5a8c; 254 T", () => {
  const m = makeMachine();
  const sp0 = setupFull(m);

  loc_5a1f(m);

  assert.equal(m.tstates, 254, "loc_5a1f full-path T-state total");
  assert.equal(m.pc, 0x5a8c, "partial wrap tail-delegates to 0x5a8c");
  assert.deepEqual(m.calls, [0x0f09, 0x5a8c], "drip helper then shared tail");
  assert.equal(m.mem.read8(0x8826), 0x01, "(0x8826) counter incremented");
  assert.equal(m.mem.read8(0x882e), 0x00, "(0x882e) first coord: 0x30 then neg-wrapped to 0x00");
  assert.equal(m.mem.read8(0x882f), 0x25, "(0x882f) second coord untouched");
  assert.equal(m.regs.a, 0x05, "A = second coord low nibble (!= 0x0f)");
  assert.equal(m.regs.b, 0x30, "B = advanced first coord");
  assert.equal(m.regs.c, 0x25, "C = saved second coord");
  assert.equal(m.regs.sp, sp0, "0x0f09 push balanced; tail delegate left SP put");
  assert.deepEqual(m.pcSeq,
    [0x5a22, 0x5a25, 0x5a26, 0x5a27, 0x5a29, 0x5a2a, 0x5a2c, 0x5a2e, 0x5a2f, 0x5a30, 0x0f09,
     0x5a36, 0x5a37, 0x5a38, 0x5a39, 0x5a3a, 0x5a3c, 0x5a3d, 0x5a3e, 0x5a3f, 0x5a40, 0x5a41,
     0x5a42, 0x5a43, 0x5a44, 0x5a46, 0x5a48, 0x5a49, 0x5a4b, 0x5a4c, 0x5a4d, 0x5a4e, 0x5a50,
     0x5a52, 0x5a8c],
    "step boundaries");
});

// ── ret nz path: ring != 1 -> straight back to caller ───────────────────────────────────────────
test("loc_5a1f ret nz: ring != 1 -> ret, no drip; 78 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8810, 0x00);
  m.mem.write8(0x882d, 0x00);

  loc_5a1f(m);

  assert.equal(m.tstates, 78, "loc_5a1f ret nz T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.calls, [], "no drip helper reached");
  assert.equal(m.regs.sp, 0x8780, "ret popped the caller slot");
  assert.deepEqual(m.pcSeq,
    [0x5a22, 0x5a25, 0x5a26, 0x5a27, 0x5a29, 0x5a2a, 0x5a2c, 0x5a2e, CALLER_RET],
    "step boundaries");
});

// ── ret nc path: first coord overtakes the second -> return before the wrap ─────────────────────
test("loc_5a1f ret nc: advanced coord >= second -> ret before the wrap; no tail", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8810, 0x02);
  m.mem.write8(0x882d, 0x00);
  m.mem.write8(0x8826, 0x00);
  m.mem.write8(0x882e, 0x20); // -> B = 0x30
  m.mem.write8(0x882f, 0x40); // >= B -> sub b no borrow -> ret nc taken

  loc_5a1f(m);

  assert.equal(m.pc, CALLER_RET, "returns via ret nc");
  assert.deepEqual(m.calls, [0x0f09], "drip fired but no score tail");
  assert.equal(m.mem.read8(0x882e), 0x30, "first coord advanced, not wrapped");
});

// ── MUTATION: a dropped `neg` step (8T -> 0) is caught by the golden total ───────────────────────
test("loc_5a1f MUTATION: neg step dropped (8T -> 0)", () => {
  const m = makeMachine();
  setupFull(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x5a4b ? 0 : c);
  loc_5a1f(m);
  assert.equal(m.tstates, 246, "mutation loses the 8 T of neg");
  assert.notEqual(m.tstates, 254, "golden T-state total catches the dropped step");
});
