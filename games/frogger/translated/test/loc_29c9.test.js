// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_29c9 (Frogger IX sprite-object animation arm, ROM 0x29C9-0x29F8). Leaf, no
// callees. Drives: the (ix+0x08) frame-timer countdown + early ret; the (ix+0x06) phase step with the
// 1->4 wrap; the 0x2CD5[phase] tile fetch OR'd with the (ix+0x05) flip bits; the four IY sprite writes.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_29c9 } from "../loc_29c9.js";

const IX = 0x8500;
const IY = 0x8600;

function mk() {
  const rom = new Uint8Array(0x4000);
  rom[0x2cd7] = 0x12; // table[phase 2]
  rom[0x2cd9] = 0x34; // table[phase 4]
  const m = new Machine(rom, new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.ix = IX; m.regs.iy = IY;
  return m;
}
const w = (m, a) => m.mem.workRam[a - 0x8000];
const setIx = (m, d, v) => { m.mem.workRam[IX + d - 0x8000] = v; };

test("loc_29c9: timer not expired -> ret early, no writes, 34 T", () => {
  const m = mk();
  setIx(m, 0x08, 0x05);
  loc_29c9(m);
  assert.equal(w(m, IX + 0x08), 0x04, "timer decremented, not reloaded");
  assert.equal(w(m, IY + 0x01), 0x00, "no sprite write");
  assert.equal(m.cycles, 34, "dec (ix+d) 23 + ret nz taken 11");
});

test("loc_29c9: phase 3->2 stages tile 0x12|flip and its +1 sibling", () => {
  const m = mk();
  setIx(m, 0x08, 0x01); // timer expires
  setIx(m, 0x06, 0x03); // phase 3 -> dec -> 2
  setIx(m, 0x05, 0x80); // flip bits
  loc_29c9(m);
  assert.equal(w(m, IX + 0x08), 0x0c, "frame timer reloaded");
  assert.equal(w(m, IX + 0x06), 0x02, "phase advanced 3 -> 2");
  assert.equal(w(m, IY + 0x01), 0x92, "sprite tile = table[2] 0x12 | 0x80");
  assert.equal(w(m, IY + 0x05), 0x93, "sibling tile = tile + 1");
  assert.equal(w(m, IY + 0x02), 0x04, "attr byte");
  assert.equal(w(m, IY + 0x06), 0x04, "attr byte");
});

test("loc_29c9: phase 1 wraps to 4 (reads table[4]=0x34)", () => {
  const m = mk();
  setIx(m, 0x08, 0x01);
  setIx(m, 0x06, 0x01); // phase 1 -> dec -> 0 -> wrap to 4
  setIx(m, 0x05, 0x00);
  loc_29c9(m);
  assert.equal(w(m, IX + 0x06), 0x04, "phase 1 wrapped to 4");
  assert.equal(w(m, IY + 0x01), 0x34, "tile from table[4]");
  assert.equal(w(m, IY + 0x05), 0x35, "sibling +1");
});

test("loc_29c9: phase 0 is inactive -> ret z after the reload", () => {
  const m = mk();
  setIx(m, 0x08, 0x01);
  setIx(m, 0x06, 0x00); // or a -> Z -> ret z
  loc_29c9(m);
  assert.equal(w(m, IX + 0x08), 0x0c, "timer reloaded before the ret z");
  assert.equal(w(m, IY + 0x01), 0x00, "no sprite write");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_29c9.js
//   find: regs.a = regs.inc8(regs.a);
//   repl: regs.a = regs.dec8(regs.a);
//   expect: FAIL  ((iy+0x05) becomes tile-1, not tile+1 — caught by the phase 3->2 test)
//   verified-anchor: count == 1  (the sole inc8 in loc_29c9.js)
