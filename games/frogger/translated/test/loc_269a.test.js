// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_269a (Frogger timer-block clear, ROM 0x269A-0x26A5): zero the 4 bytes
// 0x805C-0x805F.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_269a } from "../loc_269a.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const rr = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_269a: clears 0x805C-0x805F, leaving the neighbours; 70 T", () => {
  const m = mk();
  m.mem.workRam[0x05b] = 0x11; // guard byte below
  m.mem.workRam[0x05c] = 0xaa;
  m.mem.workRam[0x05d] = 0xbb;
  m.mem.workRam[0x05e] = 0xcc;
  m.mem.workRam[0x05f] = 0xdd;
  m.mem.workRam[0x060] = 0xee; // guard byte above
  loc_269a(m);
  assert.equal(rr(m, 0x805c), 0x00);
  assert.equal(rr(m, 0x805d), 0x00);
  assert.equal(rr(m, 0x805e), 0x00);
  assert.equal(rr(m, 0x805f), 0x00);
  assert.equal(rr(m, 0x805b), 0x11, "byte below untouched");
  assert.equal(rr(m, 0x8060), 0xee, "byte above untouched");
  assert.equal(m.cycles, 70, "ld hl 10 + xor a 4 + 4*(ld(hl),a 7) + 3*(inc hl 6) + ret 10");
  assert.equal(m.pc, 0xbeef);
  assert.equal(m.regs.sp, 0x8800, "ret balanced the stack");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_269a.js
//   find: regs.hl = 0x805c;
//   repl: regs.hl = 0x805d;   // clears the wrong 4-byte window
//   expect: FAIL (0x805C stays set and 0x8060 gets clobbered — caught by both guards)
//   verified-anchor: count == 1 (the sole ld hl,0x805c in loc_269a.js)
// Simulated by shifting the cleared window up by one address.
test("loc_269a: the contract catches a shifted clear window", () => {
  const m = mk();
  m.mem.workRam[0x05c] = 0xaa;
  m.mem.workRam[0x060] = 0xee;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a + 1, v, o); // window slid up by one
  loc_269a(m);
  assert.throws(() => {
    assert.equal(rr(m, 0x805c), 0x00);
    assert.equal(rr(m, 0x8060), 0xee);
  });
});
