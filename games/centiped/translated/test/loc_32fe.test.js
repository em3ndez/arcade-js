// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_32fe (ROM 0x32fe-0x335a). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_32fe.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_32fe } from "../loc_32fe.js";

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
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

// Path: $89=3 -> DEY = 2 != 0 -> BEQ $333d NOT taken, so the middle ($ad/$ab/$a9) block runs too;
// $f5=$f7=0 makes the EOR masks identity. Nine JSR/JMP $384f calls; tail JMP lands PC at 0x384f.
test("loc_32fe: $89>1 runs both coordinate blocks, seeds $91=0x9f/$92=0x05, tail-jumps 0x384f; 145 T", () => {
  const m = makeMachine();
  m.ram[0x00f5] = 0x00;
  m.ram[0x00f7] = 0x00;
  m.ram[0x0089] = 0x03;   // DEY -> 0x02, BEQ not taken
  m.ram[0x0002] = 0x2a;   // last LDA $02 -> final A
  m.ram[0x00ac] = 0x11; m.ram[0x00aa] = 0x22; m.ram[0x00a8] = 0x33;
  m.ram[0x00ad] = 0x44; m.ram[0x00ab] = 0x55; m.ram[0x00a9] = 0x66;
  m.ram[0x0004] = 0x77; m.ram[0x0003] = 0x88;

  loc_32fe(m);

  assert.equal(m.ram[0x0091], 0x9f, "final STA $91 <- 0x9f^$f5");
  assert.equal(m.ram[0x0092], 0x05, "final STA $92 <- 0x05^$f7");
  assert.equal(m.regs.a, 0x2a, "A = $02 (last load before the tail JMP)");
  assert.deepEqual(m.calls, [0x384f, 0x384f, 0x384f, 0x384f, 0x384f, 0x384f, 0x384f, 0x384f, 0x384f],
    "9 x $384f (3 first block + 3 middle + 2 last + tail JMP)");
  assert.equal(m.pc, 0x384f, "tail JMP lands at 0x384f");
  assert.equal(m.cycles, 145, "golden T-state total for the $89>1 path");
});

test("loc_32fe: $89=1 skips the middle block (BEQ $333d taken)", () => {
  const m = makeMachine();
  m.ram[0x0089] = 0x01;   // DEY -> 0x00, BEQ taken
  m.ram[0x0002] = 0x2a;
  loc_32fe(m);
  // 6 calls: 3 first block + 2 last + tail JMP (middle block skipped)
  assert.deepEqual(m.calls, [0x384f, 0x384f, 0x384f, 0x384f, 0x384f, 0x384f], "middle block skipped");
  assert.equal(m.pc, 0x384f, "still tail-jumps 0x384f");
});

test("loc_32fe MUTATION: the tail JMP $384f mischarged 4T not 3T blows the total", () => {
  const m = makeMachine();
  m.ram[0x0089] = 0x03;
  m.ram[0x0002] = 0x2a;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x384f ? 4 : c); // JMP abs is 3T
  loc_32fe(m);
  assert.notEqual(m.cycles, 145, "a mischarged JMP cycle blows the golden T-state total");
});
