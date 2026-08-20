// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_03e9 (ROM 0x03e9-0x0428, Pooyan) -- attract dispatch index 2, the HUD/score painter.
 * Self-contained mock machine (real Regs, flat 64K RAM). loc_03e9 calls 0x05b2 (translated) and
 * 0x0429/0x0439/0x0460 (this batch). The mock records every call and rebalances SP for the callee's
 * ret; for 0x0429 it also models the callee's contract exactly (store low nibble, HL += DE, high
 * nibble -> A, Z per high nibble) since loc_03e9's score loop consumes those results. 0x05b2/0x0439/
 * 0x0460 are recorded only -- their outputs never feed back into loc_03e9's asserted state (A/BC are
 * saved across 0x05b2; the tail calls precede the ret). Path A (full pcSeq): 11 field renders then
 * 10 score rows with every source byte 0x12 (3rd nibble non-zero, jr z never taken). Golden 2675 T
 * from the Z80 timings. TEETH: mis-charge `add hl,de` at 0x0408 (11 T) as 7 T; the golden catches it.
 * Run: node --test games/pooyan/translated/test/loc_03e9.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_03e9 } from "../loc_03e9.js";

const CALLER_RET = 0xabcd;

// Faithful stand-in for loc_0429: split (ix) into nibbles, store low, advance HL, high -> A, set Z.
function emulate0429(regs, mem) {
  const raw = mem.read8(regs.ix & 0xffff);
  mem.write8(regs.hl, raw & 0x0f);
  regs.hl = (regs.hl + regs.de) & 0xffff;
  regs.a = (raw >> 4) & 0x0f;
  regs.and(0x0f); // sets Z when the high nibble is 0
}

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x03e9, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) {
      this.calls.push(addr);
      regs.sp = (regs.sp + 2) & 0xffff; // callee's ret pops the pushed return
      if (addr === 0x0429) emulate0429(regs, mem);
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const attractIter = (last) => [0x03ee, 0x03ef, 0x05b2, 0x03f3, 0x03f4, 0x03f5, last ? 0x03f7 : 0x03ed];
const digitIter = (last) => [
  0x0429, 0x0407, 0x0408, 0x040a,
  0x0429, 0x040e, 0x040f, 0x0411,
  0x0429, 0x0416, 0x0417,
  0x041a, 0x041b, 0x041e, 0x0420,
  last ? 0x0422 : 0x0403,
];

function buildPcSeq() {
  const pc = [0x03eb, 0x03ed];
  for (let i = 0; i < 11; i++) pc.push(...attractIter(i === 10));
  pc.push(0x03fa, 0x03fd, 0x03ff, 0x0403);
  for (let i = 0; i < 10; i++) pc.push(...digitIter(i === 9));
  pc.push(0x0439, 0x0460, CALLER_RET);
  return pc;
}

const CALLS = [
  ...Array(11).fill(0x05b2),
  ...Array(30).fill(0x0429),
  0x0439, 0x0460,
];

test("loc_03e9 Path A: 11 field renders + 10 score rows -> tail 0x0439/0x0460 -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x8a00; a <= 0x8a1d; a++) m.mem.write8(a, 0x12); // 10 rows x 3 bytes, low 2 / high 1

  loc_03e9(m);

  assert.equal(m.pc, CALLER_RET, "ends via ret");
  assert.equal(m.tstates, 2675, "Path A T-state total");
  assert.deepEqual(m.calls, CALLS, "11x 0x05b2, 30x 0x0429, then 0x0439/0x0460");
  assert.deepEqual(m.pcSeq, buildPcSeq(), "step boundaries match the disassembly");

  for (let r = 0; r < 10; r++) {
    const start = 0x85c7 + 2 * r;
    assert.equal(m.mem.read8((start + 0x00) & 0xffff), 0x02, `row ${r} nibble0 low`);
    assert.equal(m.mem.read8((start + 0x20) & 0xffff), 0x01, `row ${r} nibble0 high`);
    assert.equal(m.mem.read8((start + 0x40) & 0xffff), 0x02, `row ${r} nibble1 low`);
    assert.equal(m.mem.read8((start + 0x60) & 0xffff), 0x01, `row ${r} nibble1 high`);
    assert.equal(m.mem.read8((start + 0x80) & 0xffff), 0x02, `row ${r} nibble2 low`);
    assert.equal(m.mem.read8((start + 0xa0) & 0xffff), 0x01, `row ${r} nibble2 high (not suppressed)`);
  }
  assert.equal(m.regs.b, 0x00, "B exhausted by the score-row djnz");
  assert.equal(m.regs.a, 0x01, "A = last high nibble");
  assert.equal(m.regs.hl, 0x85db, "HL = 0x85c7 + 2*10");
  assert.equal(m.regs.ix, 0x8a1e, "IX = 0x8a00 + 3*10");
  assert.equal(m.regs.de, 0x0020, "DE = 0x0020 (reloaded at the row tail)");
});

test("loc_03e9 selector sweep: A runs 0x1a..0x24 across the 11 field renders (saved across 0x05b2)", () => {
  // 0x05b2 is recorded only; A is pushed/popped around it, so `inc a` drives the selector each pass.
  // 11 passes: 0x1a + 11 = 0x25 leaves A at 0x25 entering the score loop, whose first 0x0429 resets A.
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x8a00; a <= 0x8a1d; a++) m.mem.write8(a, 0x00); // all-zero score -> exercises jr z
  loc_03e9(m);
  assert.equal(m.pc, CALLER_RET, "still returns cleanly");
  // Every high nibble is 0 -> every 3rd-nibble store suppressed; the two mandatory stores are 0.
  assert.equal(m.mem.read8(0x85c7), 0x00, "row 0 nibble0 low = 0");
  assert.equal(m.mem.read8(0x8667), 0x00, "row 0 nibble2 high suppressed (jr z taken) -- stays 0");
});

test("loc_03e9 Path B: a non-zero 3rd high nibble is stored (jr z NOT taken)", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x8a00; a <= 0x8a1d; a++) m.mem.write8(a, 0x00);
  m.mem.write8(0x8a02, 0x70); // row 0's 3rd byte: high nibble 7 -> store fires

  loc_03e9(m);

  assert.equal(m.mem.read8(0x8667), 0x07, "row 0 nibble2 high stored (0x85c7+0xa0)");
});

test("loc_03e9 MUTATION: `add hl,de` at 0x0408 mis-charged 7 T (not 11) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x8a00; a <= 0x8a1d; a++) m.mem.write8(a, 0x12);
  const real = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first && n === 0x0408) { first = false; return real(n, 7); } return real(n, c); };

  loc_03e9(m);

  assert.equal(m.tstates, 2671, "mutant lost exactly 4 T");
  assert.throws(() => assert.equal(m.tstates, 2675, "Path A T-state total"), /Path A T-state total/);
});
