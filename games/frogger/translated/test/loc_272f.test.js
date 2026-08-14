// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_272f (Frogger fly/insect X-movement driver, ROM 0x272F-0x279E): runs the tongue
// timer at (0x833e) toggling the sprite code at (0x8041); at zero it walks the X-offset table (base 0x279f,
// indexed by the folded add-hl helper at 0x279A) into (0x8040). Leaf routine, no external callees;
// block_2769 exercises the folded helper + a real ROM table read (0x279F-0x27B2, from the UNREACHED dump).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_272f } from "../loc_272f.js";

const TABLE = [0x00, 0xee, 0xec, 0xea, 0xe8, 0xe6, 0xe4, 0xe2, 0xe0, 0x01,
               0xde, 0xdc, 0xda, 0xd8, 0xd6, 0xd4, 0xd2, 0xd0, 0x00, 0xd0];

function mk(seed) {
  const rom = new Uint8Array(0x4000);
  if (seed) rom.set(TABLE, 0x279f);
  const m = new Machine(rom, new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const r = (m, a) => m.mem.read8(a);

test("loc_272f: timer at the midpoint, positive direction -> sprite code 0x21; 116 T", () => {
  const m = mk();
  m.mem.workRam[0x833e - 0x8000] = 0x1f; // timer: dec -> 0x1e == 0x3c>>1 midpoint
  m.mem.workRam[0x833d - 0x8000] = 0x00; // direction byte positive -> ret p
  loc_272f(m);
  assert.equal(r(m, 0x8041), 0x21, "unflipped sprite code");
  assert.equal(r(m, 0x833e), 0x1e, "timer decremented");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.equal(m.cycles, 116, "midpoint branch to ret p");
});

test("loc_272f: timer zero -> walk the table via the folded helper into (0x8040); 199 T", () => {
  const m = mk(true);
  m.mem.workRam[0x833e - 0x8000] = 0x00; // timer zero -> block_2761/2769
  m.mem.workRam[0x833d - 0x8000] = 0x05; // step counter; inc -> 6 indexes table[6]=0xe4
  m.mem.workRam[0x811c - 0x8000] = 0x10; // lane base
  loc_272f(m);
  assert.equal(r(m, 0x833d), 0x06, "step counter advanced");
  assert.equal(r(m, 0x8040), 0xf4, "table[6]=0xe4 + lane base 0x10");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.equal(m.cycles, 199, "helper + table read path");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_272f.js
//   find: regs.a = 0x21;
//   repl: regs.a = 0x22;
//   expect: FAIL  (writes sprite code 0x22 instead of 0x21 -- caught by the first test's check)
//   verified-anchor: count == 1  (the sole `ld a,0x21` in loc_272f.js)
// Simulated by intercepting the 0x21 store to (0x8041) and forcing 0x22, which is what the edit produces.
test("loc_272f: the contract catches a wrong unflipped sprite code", () => {
  const m = mk();
  m.mem.workRam[0x833e - 0x8000] = 0x1f;
  m.mem.workRam[0x833d - 0x8000] = 0x00;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x8041 && v === 0x21 ? 0x22 : v, o);
  loc_272f(m);
  assert.throws(() => assert.equal(r(m, 0x8041), 0x21));
});
