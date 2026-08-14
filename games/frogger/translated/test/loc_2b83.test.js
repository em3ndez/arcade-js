// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2b83 (Frogger IX sprite dispatcher B, ROM 0x2B83-0x2B92): five unconditional
// calls to the sprite-object arms in fixed order, then ret. Arms are stubbed as SP-balancers.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2b83 } from "../loc_2b83.js";

const ARMS = [0x2c13, 0x2bab, 0x2b93, 0x2ca8, 0x2bfb];
const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const routines = new Map();
  for (const a of ARMS) routines.set(a, bal); // arm bodies are other batch units
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

test("loc_2b83: dispatches the five arms in order; 95 T; SP balanced", () => {
  const m = mk();
  loc_2b83(m);
  assert.deepEqual(m.calls, ARMS, "five arms, fixed order");
  assert.equal(m.cycles, 95, "5*call(17) + ret(10)");
  assert.equal(m.regs.sp, 0x8800, "each call balanced by its stub, ret pops 0xbeef");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2b83.js
//   find: m.step(0x2ca8, 17);
//   repl: m.step(0x2bfb, 17);   // 4th arm retargeted 0x2ca8 -> 0x2bfb (copy-paste dup)
//   expect: FAIL  (call sequence becomes [..,0x2bfb,0x2bfb], drops 0x2ca8 -> deepEqual differs)
//   verified-anchor: count == 1  (the sole m.call(0x2ca8) in loc_2b83.js)
test("loc_2b83: a retargeted arm changes the call sequence the contract pins", () => {
  const mutant = (m) => {
    m.push16(0x2b86); m.step(0x2c13, 17); m.call(0x2c13);
    m.push16(0x2b89); m.step(0x2bab, 17); m.call(0x2bab);
    m.push16(0x2b8c); m.step(0x2b93, 17); m.call(0x2b93);
    m.push16(0x2b8f); m.step(0x2bfb, 17); m.call(0x2bfb); // MUTANT: 0x2ca8 -> 0x2bfb
    m.push16(0x2b92); m.step(0x2bfb, 17); m.call(0x2bfb);
    m.ret();
  };
  const m = mk();
  mutant(m);
  assert.throws(() => assert.deepEqual(m.calls, ARMS));
});
