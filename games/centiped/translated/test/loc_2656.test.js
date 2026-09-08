// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2656 (ROM 0x2656-0x2675). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2656.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2656 } from "../loc_2656.js";

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

test("loc_2656: fans the 3-byte $2676,X record into $140D-$140F / $1405-$1407; X=0 no cross; 53 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1fff); // RTS -> 0x2000
  m.regs.x = 0x00;
  m.ram[0x2676] = 0x11; // -> PHA/PLA -> A -> $140F/$1405
  m.ram[0x2677] = 0x22; // -> TAY -> Y -> $140D/$1407
  m.ram[0x2678] = 0x33; // -> TAX -> X -> $140E/$1406

  loc_2656(m);

  assert.equal(m.regs.a, 0x11, "A = pulled $2676 byte");
  assert.equal(m.regs.x, 0x33, "X = $2678 byte (TAX)");
  assert.equal(m.regs.y, 0x22, "Y = $2677 byte (TAY)");
  assert.equal(m.ram[0x140e], 0x33, "$140e = X");
  assert.equal(m.ram[0x1406], 0x33, "$1406 = X");
  assert.equal(m.ram[0x140f], 0x11, "$140f = A");
  assert.equal(m.ram[0x1405], 0x11, "$1405 = A");
  assert.equal(m.ram[0x140d], 0x22, "$140d = Y");
  assert.equal(m.ram[0x1407], 0x22, "$1407 = Y");
  assert.equal(m.regs.fN, false, "N clear (last flag-setter PLA, A=0x11)");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.cycles, 53, "53 T (no page-cross at X=0)");
  assert.equal(m.pc, 0x2000, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_2656: X=0x8A crosses the 0x2676 page on all three indexed reads; 56 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1fff);
  m.regs.x = 0x8a; // 0x2676+0x8a = 0x2700 -> page cross, +1 each read
  m.ram[0x2700] = 0x11;
  m.ram[0x2701] = 0x22;
  m.ram[0x2702] = 0x33;

  loc_2656(m);

  assert.equal(m.cycles, 56, "53 + 3 page-cross cycles");
});

test("loc_2656 MUTATION: PLA mischarged 3T not 4T blows the golden T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1fff);
  m.regs.x = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2663 ? 3 : c); // PLA steps to 0x2663
  loc_2656(m);
  assert.notEqual(m.cycles, 53, "a mischarged cycle blows the golden T-state total");
});
