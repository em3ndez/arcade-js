// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_29f9 (Frogger IX sprite-object motion arm, ROM 0x29F9-0x2A69). Leaf, no callees.
// Drives: the (ix+0x06)/(0x842C)/(ix+0x09) activity gates; the past-row-0x60 (ix+0x03) +2/-2 step
// (block_2a3c); the toward/away frog-X drift on (ix+0x00..0x02) (main + block_2a2d); the turn-around
// direction flip (block_2a53).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_29f9 } from "../loc_29f9.js";

const IX = 0x8500;
const IY = 0x8600;

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.ix = IX; m.regs.iy = IY;
  // Active by default: (ix+0x06)!=0, gate open, move timer about to expire.
  m.mem.workRam[IX + 0x06 - 0x8000] = 0x01;
  m.mem.workRam[0x842c - 0x8000] = 0x00;
  m.mem.workRam[IX + 0x09 - 0x8000] = 0x01;
  return m;
}
const w = (m, a) => m.mem.workRam[a - 0x8000];
const setIx = (m, d, v) => { m.mem.workRam[IX + d - 0x8000] = v; };
const setIy = (m, d, v) => { m.mem.workRam[IY + d - 0x8000] = v; };
const setAbs = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

test("loc_29f9: inactive object (ix+0x06)==0 -> ret z", () => {
  const m = mk();
  setIx(m, 0x06, 0x00);
  loc_29f9(m);
  assert.equal(w(m, IX + 0x09), 0x01, "move timer untouched");
  assert.equal(m.cycles, 34, "ld a,(ix+d)19 + or a 4 + ret z taken 11");
});

test("loc_29f9: global gate (0x842C)!=0 -> ret nz", () => {
  const m = mk();
  setAbs(m, 0x842c, 0x01);
  loc_29f9(m);
  assert.equal(w(m, IX + 0x09), 0x01, "gated: timer untouched");
});

test("loc_29f9: move timer not expired -> ret nz", () => {
  const m = mk();
  setIx(m, 0x09, 0x05); // dec -> 4 != 0
  loc_29f9(m);
  assert.equal(w(m, IX + 0x09), 0x04, "decremented, not reloaded");
});

test("loc_29f9: past row 0x60, dir==0 -> (ix+0x03) += -2 (block_2a4a)", () => {
  const m = mk();
  setIy(m, 0x03, 0x60); // >= 0x60 -> jr nc
  setIx(m, 0x05, 0x00); // dir 0 -> ld a,0xfe
  setIx(m, 0x03, 0x10);
  loc_29f9(m);
  assert.equal(w(m, IX + 0x09), 0x08, "timer reloaded");
  assert.equal(w(m, IX + 0x07), 0x01, "on-screen flag set");
  assert.equal(w(m, IX + 0x03), 0x0e, "0x10 + 0xfe = 0x0e");
});

test("loc_29f9: past row 0x60, dir!=0 -> (ix+0x03) += 2 (block_2a3c/2a4c)", () => {
  const m = mk();
  setIy(m, 0x03, 0x60);
  setIx(m, 0x05, 0x80); // dir nonzero -> ld a,0x02
  setIx(m, 0x03, 0x10);
  loc_29f9(m);
  assert.equal(w(m, IX + 0x03), 0x12, "0x10 + 0x02 = 0x12");
});

test("loc_29f9: on-screen, dir!=0 -> drift away via (ix+0x01) (block_2a2d)", () => {
  const m = mk();
  setIy(m, 0x03, 0x50); // < 0x60
  setIx(m, 0x05, 0x80); // dir nonzero -> jp nz block_2a2d
  setAbs(m, 0x8014, 0x40); // frog X
  setIx(m, 0x01, 0x20); // 0x40 - 0x20 = 0x20
  setIy(m, 0x00, 0x10); // 0x20 vs 0x10 -> no carry -> dec (ix+0x02)
  setIx(m, 0x02, 0x05);
  loc_29f9(m);
  assert.equal(w(m, IX + 0x02), 0x04, "dec (ix+0x02) toward");
});

test("loc_29f9: on-screen, dir==0 -> reached -> turn around (block_2a53)", () => {
  const m = mk();
  setIy(m, 0x03, 0x50);
  setIx(m, 0x05, 0x00); // dir 0 -> main path
  setAbs(m, 0x8014, 0x40); // frog X
  setIx(m, 0x00, 0x10); // 0x40 - 0x10 = 0x30, no carry (ret c not taken)
  setIy(m, 0x00, 0x20); // 0x30 vs 0x20 -> no carry -> jr nc -> block_2a53
  setIy(m, 0x04, 0x11);
  setIy(m, 0x01, 0x22);
  loc_29f9(m);
  assert.equal(w(m, IX + 0x05), 0x80, "direction bit flipped 0 ^ 0x80");
  assert.equal(w(m, IY + 0x00), 0x11, "(iy+0x00) = (iy+0x04)");
  assert.equal(w(m, IY + 0x01), 0xa2, "(iy+0x01) = 0x22 ^ 0x80");
});

test("loc_29f9: on-screen, dir==0, not reached -> inc (ix+0x02)", () => {
  const m = mk();
  setIy(m, 0x03, 0x50);
  setIx(m, 0x05, 0x00);
  setAbs(m, 0x8014, 0x40);
  setIx(m, 0x00, 0x20); // 0x40 - 0x20 = 0x20, no carry
  setIy(m, 0x00, 0x30); // 0x20 vs 0x30 -> carry -> jr nc not taken -> inc (ix+0x02)
  setIx(m, 0x02, 0x05);
  loc_29f9(m);
  assert.equal(w(m, IX + 0x02), 0x06, "inc (ix+0x02) away");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_29f9.js
//   find: regs.a = 0xfe;
//   repl: regs.a = 0x02;
//   expect: FAIL  (the dir==0 step becomes +2, so (ix+0x03) is 0x12 not 0x0e — caught by the
//                  "past row 0x60, dir==0" test)
//   verified-anchor: count == 1  (the sole ld a,0xfe in loc_29f9.js)
