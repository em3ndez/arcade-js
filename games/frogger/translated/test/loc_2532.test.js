// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2532 (Frogger lane scroll-marker setup C, ROM 0x2532-0x25CD). Mirrors (0x8120)->
// (0x8121), then on lane index 1..5 with the lane's object-present flag clear stamps a 2x2 tile marker
// (0xD0/0xD1 over 0xD2/0xD3) at the lane's video-RAM home cell.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2532 } from "../loc_2532.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const rd = (m, a) => m.mem.read8(a);
const voff = (a) => 0x800 + (a & 0x3ff); // state-dump offset of a video-RAM address

function check(m) {
  assert.equal(rd(m, 0x8121), 0x01, "(0x8121) mirror = the prior stage's (0x8120)");
  assert.equal(rd(m, 0xab64), 0xd0, "top-left marker tile");
  assert.equal(rd(m, 0xab65), 0xd1, "top-right marker tile");
  assert.equal(rd(m, 0xab84), 0xd2, "bottom-left marker tile");
  assert.equal(rd(m, 0xab85), 0xd3, "bottom-right marker tile");
}

test("loc_2532: arm 1 direct — stamps the marker; 196 T; only 5 cells move", () => {
  const m = mk();
  m.mem.write8(0x83fd, 0x01); // C = collided-lane count 1 -> dec to 0, take the first flag path
  m.mem.write8(0x8120, 0x01); // lane index 1 (read from 0x8120 here)
  const before = m.dumpState();
  loc_2532(m);
  check(m);
  assert.equal(m.cycles, 196, "T-states for the direct arm-1 path");
  assert.equal(m.regs.sp, 0x8800, "stack balanced by the ret");
  const expected = before.slice();
  expected[0x121] = 0x01;
  for (const [a, v] of [[0xab64, 0xd0], [0xab65, 0xd1], [0xab84, 0xd2], [0xab85, 0xd3]]) {
    expected[voff(a)] = v;
  }
  assert.deepEqual(m.dumpState(), expected, "only the mirror + 4 tiles changed");
});

test("loc_2532: arm 1 via the C!=1 second-flag path — same marker; 213 T", () => {
  const m = mk();
  m.mem.write8(0x83fd, 0x02); // C = 2 -> dec to 1 (nz), jr nz to the second-flag test
  m.mem.write8(0x8120, 0x01);
  loc_2532(m);
  check(m);
  assert.equal(m.cycles, 213, "T-states for the jr-nz second-flag path");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2532.js
//   find: mem.write8(regs.hl, 0xd0);
//   repl: mem.write8(regs.hl, 0xde);
//   expect: FAIL (top-left tile becomes 0xde — caught by check)
//   verified-anchor: count == 1 (the sole 0xd0 store in loc_2532.js)
// Simulated by intercepting the 0xd0 store, which is what the edit produces.
test("loc_2532: the contract catches a wrong marker tile", () => {
  const m = mk();
  m.mem.write8(0x83fd, 0x01);
  m.mem.write8(0x8120, 0x01);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, v === 0xd0 ? 0xde : v, o);
  loc_2532(m);
  assert.throws(() => check(m));
});
