// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_29b9 (Frogger IX sprite dispatcher A, ROM 0x29B9-0x29C8): five sequential CALLs
// to the per-slot handlers in ROM order, then RET. The five arms are a later batch, stubbed here as
// SP-balancers (each pops the return address the CALL pushed).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_29b9 } from "../loc_29b9.js";

const ARMS = [0x2a6a, 0x29c9, 0x29f9, 0x2af3, 0x2b58]; // ROM call order
const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const routines = new Map();
  for (const a of ARMS) routines.set(a, bal);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

test("loc_29b9: runs the five arms in ROM order then rets; 95 T", () => {
  const m = mk();
  loc_29b9(m);
  assert.deepEqual(m.calls, ARMS, "five arms, ROM order 0x2a6a,0x29c9,0x29f9,0x2af3,0x2b58");
  assert.equal(m.cycles, 5 * 17 + 10, "5 call (17) + ret (10); stubs charge 0");
  assert.equal(m.regs.sp, 0x8800, "SP balanced: every CALL's push matched by the arm's ret");
  assert.equal(m.pc, 0xbeef, "final ret returns to the caller sentinel");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_29b9.js
//   find: m.step(0x29f9, 17); m.call(0x29f9);   // the 3rd CALL, to arm 0x29f9
//   repl: m.step(0x2a6a, 17); m.call(0x2a6a);   // wrong arm (0x2a6a repeated)
//   expect: FAIL  (call sequence no longer matches the ROM's five distinct arms)
//   verified-anchor: count == 1  (the sole m.call(0x29f9) in loc_29b9.js)
test("loc_29b9: a wrong arm target breaks the recorded call sequence", () => {
  const m = mk();
  const mutant = (mm) => {
    mm.push16(0x29bc); mm.step(0x2a6a, 17); mm.call(0x2a6a);
    mm.push16(0x29bf); mm.step(0x29c9, 17); mm.call(0x29c9);
    mm.push16(0x29c2); mm.step(0x2a6a, 17); mm.call(0x2a6a); // MUTANT: 0x29f9 -> 0x2a6a
    mm.push16(0x29c5); mm.step(0x2af3, 17); mm.call(0x2af3);
    mm.push16(0x29c8); mm.step(0x2b58, 17); mm.call(0x2b58);
    mm.ret();
  };
  mutant(m);
  assert.throws(() => assert.deepEqual(m.calls, ARMS), "the deepEqual arm-order check has teeth");
});
