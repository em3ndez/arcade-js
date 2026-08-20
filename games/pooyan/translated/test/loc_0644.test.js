// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_0644 (ROM 0x0644-0x066c, Pooyan) -- idx8: the high-score-table checksum guard.
 * Self-contained mock machine (real Regs for exact flags, flat 64K RAM, step/ret/push16/pop16).
 * The mock seats a caller return so the terminal `ret` / `ret z` proves which exit fired.
 * Path PASS: header 0x778a==0xc8 and A-D==0x59 -> `ret z`, no write (168 T). Path BADHDR:
 * header != 0xc8 -> early jr nz, (0x8df8)=1 (89 T). Path FAIL: header 0xc8 but checksum != 0x59
 * -> falls through, (0x8df8)=1 (193 T). Golden T-states computed independently from Z80 timings.
 * TEETH: mis-charge `ld a,(ix+0x00)` (19 T) as 7 T on PASS; the 168-T golden catches it.
 * Run: node --test games/pooyan/translated/test/loc_0644.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0644 } from "../loc_0644.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0644, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Header 0xc8, then bytes chosen so A-D == 0x59: 0xc8 +0x92 (carry, A=0x5a, D=1) +0 +0 -> 0x5a-1 = 0x59.
function setupPass(m) {
  seatCaller(m);
  m.mem.write8(0x778a, 0xc8);
  m.mem.write8(0x778b, 0x92);
  m.mem.write8(0x778c, 0x00);
  m.mem.write8(0x778d, 0x00);
}

const PC_PASS = [
  0x0648, 0x064a, 0x064d, 0x064f, 0x0651, 0x0654, 0x0656, 0x0657,
  0x065a, 0x065d, 0x0660, 0x0663, 0x0664, 0x0666, CALLER_RET,
];

test("loc_0644 Path PASS: header 0xc8, checksum == 0x59 -> ret z, no write", () => {
  const m = makeMachine();
  setupPass(m);

  loc_0644(m);

  assert.equal(m.pc, CALLER_RET, "ends via 0x0666 ret z");
  assert.equal(m.tstates, 168, "PASS T-state total");
  assert.equal(m.mem.read8(0x8df8), 0x00, "corrupt flag NOT set");
  assert.equal(m.regs.a, 0x59, "A = checksum result matching 0x59");
  assert.equal(m.regs.d, 0x01, "one carry counted");
  assert.equal(m.regs.ix, 0x778a, "IX = table base");
  assert.deepEqual(m.pcSeq, PC_PASS, "PASS step boundaries match the ROM bytes");
});

const PC_BADHDR = [0x0648, 0x064a, 0x064d, 0x064f, 0x0667, 0x0669, 0x066c, CALLER_RET];

test("loc_0644 Path BADHDR: header != 0xc8 -> early jr nz -> (0x8df8)=1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x778a, 0x00); // header wrong

  loc_0644(m);

  assert.equal(m.pc, CALLER_RET, "ends via 0x066c ret");
  assert.equal(m.tstates, 89, "BADHDR T-state total");
  assert.equal(m.mem.read8(0x8df8), 0x01, "corrupt flag set");
  assert.equal(m.regs.a, 0x01, "A = 1 (the flag value)");
  assert.deepEqual(m.pcSeq, PC_BADHDR, "BADHDR step boundaries match the ROM bytes");
});

const PC_FAIL = [
  0x0648, 0x064a, 0x064d, 0x064f, 0x0651, 0x0654, 0x0657, 0x065a,
  0x065d, 0x0660, 0x0663, 0x0664, 0x0666, 0x0667, 0x0669, 0x066c, CALLER_RET,
];

test("loc_0644 Path FAIL: header 0xc8 but checksum != 0x59 -> ret z not taken -> (0x8df8)=1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x778a, 0xc8);
  m.mem.write8(0x778b, 0x00);
  m.mem.write8(0x778c, 0x00);
  m.mem.write8(0x778d, 0x00); // A stays 0xc8, D=0, 0xc8 != 0x59

  loc_0644(m);

  assert.equal(m.pc, CALLER_RET, "ends via 0x066c ret");
  assert.equal(m.tstates, 193, "FAIL T-state total");
  assert.equal(m.mem.read8(0x8df8), 0x01, "corrupt flag set");
  assert.equal(m.regs.a, 0x01, "A = flag value after the corrupt path");
  assert.deepEqual(m.pcSeq, PC_FAIL, "FAIL step boundaries match the ROM bytes");
});

test("loc_0644 MUTATION: `ld a,(ix+0x00)` mis-charged 7 T (not 19) is caught", () => {
  const m = makeMachine();
  const real = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first && n === 0x064d) { first = false; return real(n, 7); } return real(n, c); };
  setupPass(m);

  loc_0644(m);

  assert.equal(m.tstates, 156, "mutant loses exactly 12 T (19 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 168, "PASS T-state total"), /PASS T-state total/,
    "the 168-T golden must fail on the mutant");
});
