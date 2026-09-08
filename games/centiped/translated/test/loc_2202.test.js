// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2202 (ROM 0x2202-0x227f). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2202.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2202 } from "../loc_2202.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

// Path: $43&0xaf==0 (BEQ 2209) -> INC $41 branch -> DEC $a1 to 0 (fall) -> $100a bit7 set
// (BEQ 2252) -> AND $100a bit5 nonzero (JSR $382d remap of $81) -> $61-$51 subtract ->
// $ef==0 (BEQ 227d) -> SEC/SBC $81 -> falls into loc_2280 (tail m.call).
test("loc_2202: full advance path remaps $81, subtracts, tail-falls to loc_2280; 117 T", () => {
  const m = makeMachine();
  m.ram[0x0043] = 0x50; // & 0xaf == 0 -> BEQ $2209 taken
  m.ram[0x0041] = 0x08; // bit5 clear -> BEQ $2219 taken
  m.ram[0x0000] = 0x00; // & 3 == 0 -> BNE $222f not taken -> INC path
  m.ram[0x00f2] = 0x00; // EOR $f2 neutral
  m.ram[0x00a1] = 0x01; // DEC $a1 -> 0 -> BNE $2268 not taken
  m.ram[0x100a] = 0x20; // bit7 clear (BEQ $2252 taken), bit5 set (AND $100a nonzero -> JSR path)
  m.ram[0x00fd] = 0x00; // (($fd & 0x40)|0x20) & $100a = 0x20
  m.ram[0x0081] = 0x03; // remapped through the JSR (harness no-op leaves it 0x03)
  m.ram[0x0061] = 0x40;
  m.ram[0x0051] = 0x10; // $61 - $51 = 0x30
  m.ram[0x0071] = 0x05;
  m.ram[0x00ef] = 0x00; // Y == 0 -> BEQ $227d taken -> SEC/SBC

  loc_2202(m);

  assert.equal(m.regs.x, 0x0d, "X = #$0d");
  assert.equal(m.regs.y, 0x00, "Y = $ef = 0");
  assert.equal(m.regs.a, 0x02, "A = $71(0x05) - $81(0x03) = 0x02");
  assert.equal(m.ram[0x0041], 0x09, "INC $41: 0x08 -> 0x09");
  assert.equal(m.ram[0x0081], 0x03, "STA $81 after JSR remap (harness no-op)");
  assert.equal(m.ram[0x0061], 0x30, "STA $61 = 0x40 - 0x10");
  assert.equal(m.ram[0x008b], 0x30, "STA $8b mirrors $61");
  assert.equal(m.ram[0x00a1], 0x30, "STA $a1 = #$30 (after the DEC to 0)");
  assert.equal(m.regs.fC, true, "SBC $81: 0x05 >= 0x03 -> C set");
  assert.equal(m.regs.fZ, false, "result 0x02 -> Z clear");
  assert.deepEqual(m.calls, [0x382d, 0x2280], "JSR $382d then the tail-fall into loc_2280");
  assert.equal(m.pc, 0x2280, "pc lands at loc_2280 (the fall-through target)");
  assert.equal(m.cycles, 117, "117 T for this path");
});

test("loc_2202 MUTATION: JSR $382d mischarged 7T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.ram[0x0043] = 0x50;
  m.ram[0x0041] = 0x08;
  m.ram[0x0000] = 0x00;
  m.ram[0x00f2] = 0x00;
  m.ram[0x00a1] = 0x01;
  m.ram[0x100a] = 0x20;
  m.ram[0x00fd] = 0x00;
  m.ram[0x0081] = 0x03;
  m.ram[0x0061] = 0x40;
  m.ram[0x0051] = 0x10;
  m.ram[0x0071] = 0x05;
  m.ram[0x00ef] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2262 ? 7 : c); // the JSR return-addr step
  loc_2202(m);
  assert.notEqual(m.cycles, 117, "a mischarged cycle blows the golden T-state total");
});
