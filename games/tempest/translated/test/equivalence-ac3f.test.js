// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ac3f (ROM 0xac3f-0xad21) -- the $05 bit-clear + $ddfb/opt-$ca62 calls, then the
// Y-down bubble-sort/count channel loop feeding $0600,x and the $0603 formula, falling into loc_ad22.
// Minimal 6502 harness (Regs + flat RAM + page-1 stack seam), author-derived; JSRs are opaque (harness
// records the call, does not run them). The outer loop is Y-driven (fixed 98 passes), so the all-quiet
// scenario has a fully determined pass count. Run: node --test games/tempest/translated/test/equivalence-ac3f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ac3f } from "../loc_ac3f.js";

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

test("loc_ac3f: quiet table, $3e=0 -> single channel pass, $ca62 skipped, 98 counted passes", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x05] = 0xff;   // -> & 0xbf = 0xbf (bit6 cleared)
  m.ram[0x09] = 0x00;   // (0x00 & 0x43) != 0x40 -> BNE taken -> jsr $ca62 skipped
  m.ram[0x3e] = 0x00;   // -> ldx 0x3e == 0, X stays 0 (single channel pass)
  m.ram[0x3d] = 0x00;   // $0603 = ((0^1)<<2 | 0) + 5 = 4 + 5 = 9

  loc_ac3f(m);

  assert.equal(m.ram[0x05], 0xbf, "$05 &= 0xbf clears bit6");
  assert.equal(m.ram[0x0605], 98, "outer Y loop makes 98 passes (Y=0xfd down, -3 then -2)");
  assert.equal(m.ram[0x0600], 98, "pass count stored at $0600 + ($36=0)");
  assert.equal(m.ram[0x0601], 0, "$0601 stays 0: 0 < count so BCC skips the inc");
  assert.equal(m.ram[0x0603], 9, "$0603 = ((~bit0 $3d)<<2 | $3d) + 5 with $3d=0 -> 9");
  assert.deepEqual(m.calls, [0xddfb, 0xad22], "jsr $ddfb only, then fall into loc_ad22");
  assert.equal(m.pc, 0xad22, "falls through to loc_ad22");
  assert.equal(m.regs.s, 0xfd, "guest stack balanced (every jsr push16 matched)");
  assert.equal(m.cycles, 5247, "golden T-state total for the quiet single-pass scan");
});

test("loc_ac3f: (0x09 & 0x43)==0x40 -> jsr $ca62 runs first", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x05] = 0xff;
  m.ram[0x09] = 0x40;   // (0x40 & 0x43) == 0x40 -> BNE not taken -> jsr $ca62
  m.ram[0x3e] = 0x00;
  m.ram[0x3d] = 0x00;

  loc_ac3f(m);

  assert.deepEqual(m.calls, [0xca62, 0xddfb, 0xad22], "jsr $ca62 then $ddfb then loc_ad22");
  assert.equal(m.ram[0x0600], 98, "same 98 quiet passes");
  assert.equal(m.pc, 0xad22, "falls through to loc_ad22");
  assert.equal(m.cycles, 5252, "5 T more than the skip path (BNE 2 + jsr 6 vs BNE 3)");
});

test("loc_ac3f: matching key at Y=0xfd takes the inner shift loop", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x05] = 0xff;
  m.ram[0x09] = 0x00;
  m.ram[0x3e] = 0x00;
  m.ram[0x3d] = 0x01;   // $0603 = ((1^1)<<2 | 1) + 5 = 1 + 5 = 6
  // sort key in $2c/$2d/$2e comes from $42/$41/$40 (X=0)
  m.ram[0x42] = 0x50; m.ram[0x41] = 0x60; m.ram[0x40] = 0x70;
  // table entry at Y=0xfd: $0620+0xfd=$071d, $061f+0xfd=$071c, $061e+0xfd=$071b
  m.ram[0x071d] = 0x50; // == $2c -> first BNE not taken
  m.ram[0x071c] = 0x60; // == $2d -> second BNE not taken
  m.ram[0x071b] = 0x00; // < $2e (0x70) -> cmp leaves carry clear -> BCS not taken -> inner loop

  loc_ac3f(m);

  assert.equal(m.pc, 0xad22, "still falls through to loc_ad22");
  assert.equal(m.ram[0x0603], 6, "$0603 formula with $3d=1 -> 6");
  assert.equal(m.ram[0x0600], 1, "only one pass counted: the shift consumes Y to 0");
  assert.equal(m.ram[0x071b], 0x70, "$2e (0x70) shifted into $061e+Y by the inner swap");
  assert.equal(m.ram[0x2c], 0x00, "$2c rotated by the swap chain");
  assert.equal(m.ram[0x2e], 0x00, "$2e rotated by the swap chain");
  assert.equal(m.regs.s, 0xfd, "guest stack balanced");
  assert.equal(m.cycles, 6559, "golden T-state total with the full inner shift");
});

test("loc_ac3f MUTATION: a mischarged 'sta 0x0605' (5T not 4T) blows the golden total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x05] = 0xff;
  m.ram[0x09] = 0x00;
  m.ram[0x3e] = 0x00;
  m.ram[0x3d] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0xac7e ? c + 1 : c); // over-charge the sta $0605 (lands PC at 0xac7e)
  loc_ac3f(m);
  assert.notEqual(m.cycles, 5247, "a mischarged store cycle changes the golden T-state total");
});
