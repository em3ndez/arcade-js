// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_adea (ROM 0xadea-0xae1b). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam with a call recorder), author-derived; the whole-machine boot-first state diff vs
// MAME is the integration check. Run: node --test games/tempest/translated/test/equivalence-adea.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_adea } from "../loc_adea.js";

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

test("loc_adea: draws frame (7 jsr), dec $016e, A = $0602 - $0604, tail-jumps to loc_ae4e, 77 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x016e] = 0x05;
  m.ram[0x0602] = 0x30;
  m.ram[0x0604] = 0x10;

  loc_adea(m);

  assert.equal(m.ram[0x016e], 0x04, "$016e decremented");
  assert.equal(m.regs.a, 0x20, "A = 0x30 - 0x10 (sec/sbc) = 0x20");
  assert.equal(m.regs.fC, true, "no borrow -> C set");
  assert.equal(m.regs.x, 0x2c, "X = last ldx #0x2c");
  assert.deepEqual(
    m.calls,
    [0xa8b4, 0xab17, 0xaa97, 0xab14, 0xab17, 0xab17, 0xab14, 0xae4e],
    "the 7 frame jsr's in order, then the tail-jump to loc_ae4e",
  );
  assert.equal(m.pc, 0xae4e, "tail-call sets PC to 0xae4e");
  assert.equal(m.regs.s, 0xfd, "stack balanced (every jsr's return consumed by the callee seam)");
  assert.equal(m.cycles, 77, "frame-draw + subtract + jmp cycle total");
});

test("loc_adea: subtract borrows -> A wraps, C clear", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.ram[0x016e] = 0x01;
  m.ram[0x0602] = 0x05;
  m.ram[0x0604] = 0x08;

  loc_adea(m);

  assert.equal(m.regs.a, 0xfd, "0x05 - 0x08 = 0xfd (borrow)");
  assert.equal(m.regs.fC, false, "borrow -> C clear");
  assert.equal(m.ram[0x016e], 0x00, "$016e: 0x01 -> 0x00");
  assert.equal(m.pc, 0xae4e, "tail-call target");
});
