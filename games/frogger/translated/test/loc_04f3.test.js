// SPDX-License-Identifier: GPL-3.0-only
// Drafter + mutation test for loc_04f3 (Frogger player-2 continue setup, ROM 0x04F3-0x0533).
// Two arms: (0x83C9)==0 runs the continue-setup body + two RAM copies then tail jp 0x0368; else it
// branches to the cold-start mid-entry 0x0557. Callees (rst 38, 0x0822, 0x0557, 0x0368) are stubbed so
// m.cycles measures loc_04f3's own instructions.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_04f3 } from "../loc_04f3.js";

const balCall = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // undo a CALL/RST push16
const noop = () => {}; // a tail-jp target: nothing to balance

function mk(routines) {
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef); m.cycles = 0;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const wr = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_04f3: (0x83c9)==0 continue-setup path — flags, clears, two RAM copies, tail 0x0368; 5050 T", () => {
  const m = mk(new Map([[0x0038, balCall], [0x0822, balCall], [0x0368, noop]]));
  m.mem.workRam[0x6c0] = 0x11; m.mem.workRam[0x6c1] = 0x22; m.mem.workRam[0x6ea] = 0x33; // src A ends
  m.mem.workRam[0x500] = 0xa5; m.mem.workRam[0x5b6] = 0x5a; // src B ends
  loc_04f3(m);
  assert.equal(wr(m, 0x83ca), 0x01, "(0x83ca) = 1");
  assert.equal(wr(m, 0x83fe), 0x01, "(0x83fe) = 1");
  assert.equal(wr(m, 0x825d), 0x01, "(0x825d) = 1");
  assert.equal(wr(m, 0x8263), 0x00, "(0x8263) cleared");
  assert.equal(wr(m, 0x8267), 0x00, "(0x8267) cleared (LDIR count 4)");
  assert.equal(wr(m, 0x800c), 0x11, "copy A[0] from 0x86c0");
  assert.equal(wr(m, 0x800d), 0x22, "copy A[1]");
  assert.equal(wr(m, 0x8036), 0x33, "copy A[last] (0x86ea -> 0x8036, count 0x2b)");
  assert.equal(wr(m, 0x803f), 0x01, "(0x803f) = 1");
  assert.equal(wr(m, 0x80ff), 0xa5, "copy B[0] from 0x8500");
  assert.equal(wr(m, 0x81b5), 0x5a, "copy B[last] (0x85b6 -> 0x81b5, count 0xb7)");
  assert.equal(m.cycles, 5050, "own T-states");
  assert.deepEqual(m.calls, [0x0038, 0x0822, 0x0368], "screen-clear, 0x0822, tail 0x0368");
  assert.equal(m.regs.sp, 0x87fe, "SP back at the sentinel (balanced CALL/RST, tail jp)");
});

test("loc_04f3: (0x83c9)!=0 -> jp nz to the cold-start mid-entry 0x0557; 47 T", () => {
  const m = mk(new Map([[0x0557, noop]]));
  m.mem.workRam[0x3c9] = 0x05; // (0x83c9) != 0
  loc_04f3(m);
  assert.equal(wr(m, 0x83ca), 0x01, "(0x83ca) set before the branch");
  assert.equal(m.cycles, 47, "own T-states to the branch");
  assert.deepEqual(m.calls, [0x0557], "delegated to 0x0557");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_04f3.js
//   find: mem.write8(0x83fe, regs.a);
//   repl: mem.write8(0x83fd, regs.a);
//   expect: FAIL (single-player flag written to the wrong cell -> (0x83fe) stays 0)
//   verified-anchor: the sole (0x83fe) write in loc_04f3.js. Simulated by redirecting the write.
test("loc_04f3: the (0x83fe) single-player-flag write address is pinned", () => {
  const m = mk(new Map([[0x0038, balCall], [0x0822, balCall], [0x0368, noop]]));
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, bo) => ow(a === 0x83fe ? 0x83fd : a, v, bo);
  loc_04f3(m);
  assert.notEqual(wr(m, 0x83fe), 0x01, "wrong address -> (0x83fe) not set");
});
