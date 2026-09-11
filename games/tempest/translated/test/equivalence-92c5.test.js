// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_92c5 (ROM 0x92c5-0x93df). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// The three callees ($9677/$9683 in the inner search, $93e0 in the tail) are opaque here: the harness
// records each call, balances its return push, and $9677/$93e0 stubs deposit known A/X/Y so the writes
// that consume them are checkable. The outer walk runs its full 0x6f..0x03 (step -4, 28 passes); a fresh
// RAM leaves every table cell ($9604+) and pointer target 0, so each pass's inner search exits at once
// (beq) -- except test 3, which seeds pass 1's pointer to drive the compare + $9677 hit.
// Run: node --test games/tempest/translated/test/equivalence-92c5.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_92c5 } from "../loc_92c5.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    // Simulate the callee's RTS (balance the JSR push) and deposit its live-outs.
    call(a) {
      this.calls.push(a);
      if (this._retPushed) { this._retPushed = false; this.pull16(); }
      if (a === 0x93e0) { regs.a = 0x77; regs.x = 0x88; regs.y = 0x99; }
      if (a === 0x9677) { regs.a = 0x42; }
      return undefined;
    },
  };
}

// Cycle model for the "all pointers zero" fast pass (inner search exits on the first beq):
//   prologue 92c5..92d8 (bcc taken)                      = 21
//   each outer pass body 92da..9326 without the bne      = 71  (incl. 92f6 lda(zp),y=5, 92fb beq cross=4)
//   bne 0x92da taken (page cross)                        = 4   (last pass: not taken = 2)
//   post-loop 9328..934b, $016a path -> 9331 block       = 53
//   9382 tail (3x jsr $93e0 = 6 each), rts               = 135
const PROLOGUE = 21, PASS = 71, BNE_TAKEN = 4, BNE_FALL = 2, TAIL9331 = 53, TAIL9382 = 135;

test("loc_92c5 main path: $9f<0x62, empty table (28 fast passes), $016a&3==1 -> 9331 rescale + tail", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);        // RTS -> 0x1234
  m.ram[0x9f] = 0x00;      // < 0x62 -> BCC taken (skip the $60da reload); also < 0x11 at 0x9344
  m.ram[0x016a] = 0x01;    // &3 == 1 -> BNE $934d not taken -> 9331 block
  // $0160/$011a/$0160/$015b/$016d/$b3 all default 0

  loc_92c5(m);

  // prologue: $2b = ($9f) then INC -> 1
  assert.equal(m.ram[0x2b], 0x01, "$2b = ($9f=0)+1");
  // outer loop ran to the wrap: $37 ends 0xff
  assert.equal(m.ram[0x37], 0xff, "$37 stepped -4 from 0x6f down through 0x03 to 0xff");

  // 9331 block on $0160=0: eor #$ff ->0xff, >>3 ->0x1f, adc $0160(0)+C(1)=0x20
  // (that value is then overwritten in the tail by the $93e0 stub, so check the intermediate via $b3/$011a)
  assert.equal(m.ram[0x011a], 0xff, "DEC $011a from 0 -> 0xff");
  assert.equal(m.ram[0xb3], 0xff, "$9f(0) < 0x11 -> BCS not taken -> DEC $b3 from 0 -> 0xff");

  // tail: three JSR $93e0 (stub A=0x77,X=0x88,Y=0x99); constant seeds
  assert.deepEqual(m.calls, [0x93e0, 0x93e0, 0x93e0], "no inner call (empty table); three tail $93e0");
  assert.equal(m.ram[0x0163], 0x77, "sta $0163 = A from $93e0");
  assert.equal(m.ram[0x0168], 0x99, "sty $0168 = Y from $93e0");
  assert.equal(m.ram[0x0154], 0x88, "stx $0154 = X from $93e0");
  assert.equal(m.ram[0x0160], 0x77, "sta $0160 = A from last $93e0");
  assert.equal(m.ram[0x0162], 0x77, "sta $0162");
  assert.equal(m.ram[0x0164], 0xee, "$0160(0x77) asl -> 0xee");
  assert.equal(m.ram[0x0169], 0x32, "$0165(0x99) rol with C=0 from asl(0x77) -> 0x32");
  assert.equal(m.ram[0x0155], 0x06, "seed $0155 = 6");
  assert.equal(m.ram[0x0161], 0xa0, "seed $0161 = 0xa0");
  assert.equal(m.ram[0x0166], 0xfe, "seed $0166 = 0xfe");
  assert.equal(m.ram[0x014a], 0x01, "seed $014a = 1");
  assert.equal(m.ram[0x0149], 0x01, "seed $0149 = 1");

  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.equal(m.cycles, PROLOGUE + 27 * (PASS + BNE_TAKEN) + (PASS + BNE_FALL) + TAIL9331 + TAIL9382,
    "golden T-state total for the 28-pass empty-table main path");
});

test("loc_92c5 branch edges: $9f>=0x62 -> $60da reload path; $016a&3==3 -> 934d block (BNE $9382 taken)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.ram[0x9f] = 0x62;      // >= 0x62 -> BCC not taken -> reload from $60da
  m.ram[0x60da] = 0xe3;    // & 0x1f = 0x03, | 0x40 = 0x43
  m.ram[0x016a] = 0x03;    // &3 == 3 -> CMP #1 ne -> BNE $934d taken; CMP #2 ne -> BNE $9382 taken (skip rescale)
  // ($016a&3==2 would instead fall INTO 9351: CMP #2 equal -> Z set -> BNE $9382 NOT taken -> inc $011a)

  loc_92c5(m);

  assert.equal(m.ram[0x2b], 0x44, "$2b = (($60da & 0x1f)|0x40) + 1 = 0x43+1 = 0x44");
  assert.equal(m.ram[0x37], 0xff, "outer loop wrapped");
  // 934d block took BNE $9382 -> the $011a inc / $0160 rescale were skipped
  assert.equal(m.ram[0x011a], 0x00, "$011a untouched (rescale skipped)");
  assert.equal(m.ram[0x016d], 0x00, "$016d untouched (rescale skipped)");
  assert.deepEqual(m.calls, [0x93e0, 0x93e0, 0x93e0], "still just the three tail calls");
  assert.equal(m.ram[0x0155], 0x06, "tail seeds still run");
  assert.equal(m.pc, 0x2001, "RTS -> pushed + 1");
});

test("loc_92c5 inner search: pass 1 pointer drives compare -> $9677 hit -> store via $3b/$3c", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x9f] = 0x00;      // $2b becomes 1 (the compare key)
  m.ram[0x016a] = 0x00;    // tail: &3==0 -> 934d, CMP#2 not equal -> BNE $9382 taken

  // pass 1 uses x = 0x6f: $2c/$2d <- $9673/$9674 ; $3b/$3c <- $9675/$9676
  m.ram[0x9673] = 0x00; m.ram[0x9674] = 0x02; // ($2d<<8|$2c) = 0x0200
  m.ram[0x9675] = 0x10; m.ram[0x9676] = 0x03; // dest ($3c<<8|$3b) = 0x0310
  // entry at 0x0200: [flag!=0, lo, hi] with lo<=key<=hi  (key = $2b = 1)
  m.ram[0x0200] = 0x05;  // flag nonzero -> beq not taken
  m.ram[0x0201] = 0x00;  // lo: key(1) >= 0 -> BCC not taken
  m.ram[0x0202] = 0x01;  // hi: key(1) == 1 -> BNE not taken, CLC, BCS not taken -> JSR $9677 (hit)

  loc_92c5(m);

  assert.equal(m.calls[0], 0x9677, "pass 1 reached the $9677 hit branch");
  assert.deepEqual(m.calls, [0x9677, 0x93e0, 0x93e0, 0x93e0], "one inner hit then three tail calls");
  assert.equal(m.ram[0x0310], 0x42, "sta ($3b),y wrote A (from $9677 stub) to the dest pointer 0x0310");
  assert.equal(m.ram[0x37], 0xff, "outer loop still wrapped");
  assert.equal(m.pc, 0x3001, "RTS -> pushed + 1");
});

test("loc_92c5 MUTATION: mischarging the 92fb BEQ page-cross (3T not 4T) blows the golden total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  m.ram[0x9f] = 0x00;
  m.ram[0x016a] = 0x01;
  const realStep = m.step.bind(m);
  // the empty-table pass exits via the BEQ at 0x92fb -> lands at 0x9319; undercharge it by 1
  m.step = (n, c) => realStep(n, n === 0x9319 ? c - 1 : c);
  loc_92c5(m);
  const golden = PROLOGUE + 27 * (PASS + BNE_TAKEN) + (PASS + BNE_FALL) + TAIL9331 + TAIL9382;
  assert.notEqual(m.cycles, golden, "a mischarged BEQ page-cross diverges from the golden T-state total");
});
