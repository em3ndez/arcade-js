// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_08e0 (Frogger score BCD add, ROM 0x08E0-0x0941): add BCD delta DE to the
// active player's score word, compare against the extra-life target word, track the high score.
// Target word is ROM 0x2E08 little-endian; from games/frogger/out/dk.asm 0x2E08=0x00 0x2E09=0x20,
// so (0x2E08)=0x2000. The seeded ROM returns that true value at `ld hl,(0x2e08)`.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_08e0 } from "../loc_08e0.js";
import { loc_0018 } from "../loc_0018.js";

const TARGET = 0x2000; // (0x2E08) in the real ROM

function mk() {
  const rom = new Uint8Array(0x4000);
  rom[0x2e08] = TARGET & 0xff;
  rom[0x2e09] = (TARGET >> 8) & 0xff;
  const m = new Machine(rom, new Map([[0x0018, loc_0018]])); // register rst 0x18 for the award path
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const rd = (m, a) => m.mem.read8(a);
const wr = (m, a, v) => m.mem.write8(a, v);

// P1 score 0x1255 + delta 0x0055 = 0x1310 (low 0x55+0x55->0x10 C=1, high 0x12+carry->0x13).
// 0x1310 < 0x2000 target: no award; high score (seeded 0) becomes 0x1310.
function seedNoCross(m) {
  wr(m, 0x83fe, 0x01); wr(m, 0x83fd, 0x01);
  wr(m, 0x83ed, 0x55); wr(m, 0x83ee, 0x12);
  wr(m, 0x83e7, 0x00);
  wr(m, 0x83ef, 0x00); wr(m, 0x83f0, 0x00);
  m.regs.d = 0x00; m.regs.e = 0x55;
}
function checkNoCross(m) {
  assert.equal(rd(m, 0x83ed), 0x10, "score low, BCD 0x55+0x55 -> 0x10");
  assert.equal(rd(m, 0x83ee), 0x13, "score high, 0x12+carry -> 0x13");
  assert.equal(rd(m, 0x83e7), 0x00, "no extra life below the target");
  assert.equal(rd(m, 0x83ef), 0x10, "high score low updated");
  assert.equal(rd(m, 0x83f0), 0x13, "high score high updated");
}

test("loc_08e0: below the target adds BCD, awards nothing, updates the high score; 303 T", () => {
  const m = mk();
  seedNoCross(m);
  loc_08e0(m);
  checkNoCross(m);
  assert.equal(m.cycles, 303, "straight-line no-award path (includes the final ret's 10)");
});

// P1 score 0x1990 + delta 0x0020 = 0x2010 (low 0x90+0x20->0x10 C=1, high 0x19+carry->0x20).
// 0x2010 >= 0x2000 with the P1 flag clear: award — flag set, lives bumped, high score updated.
function seedCross(m) {
  wr(m, 0x83fe, 0x01); wr(m, 0x83fd, 0x01);
  wr(m, 0x83ed, 0x90); wr(m, 0x83ee, 0x19);
  wr(m, 0x83e7, 0x00);
  wr(m, 0x83e5, 0x00); wr(m, 0x83e6, 0x00);
  wr(m, 0x83ef, 0x00); wr(m, 0x83f0, 0x00);
  m.regs.d = 0x00; m.regs.e = 0x20;
}
function checkCross(m) {
  assert.equal(rd(m, 0x83ed), 0x10, "score low, BCD 0x90+0x20 -> 0x10 carry");
  assert.equal(rd(m, 0x83ee), 0x20, "score high -> 0x20 (score 0x2010 >= target)");
  assert.equal(rd(m, 0x83e7), 0x01, "P1 extra-life flag set");
  assert.equal(rd(m, 0x83e5), 0x01, "lives counter bumped by one");
  assert.equal(rd(m, 0x83cf), 0x00, "(0x83cf) holds the pre-award flag value (0)");
  assert.equal(rd(m, 0x83ef), 0x10, "high score low updated");
  assert.equal(rd(m, 0x83f0), 0x20, "high score high updated");
}

test("loc_08e0: reaching the target awards a life, bumps lives, sets the flag", () => {
  const m = mk();
  seedCross(m);
  loc_08e0(m);
  checkCross(m);
});

test("loc_08e0: an already-awarded flag suppresses a second life at/over the target", () => {
  const m = mk();
  seedCross(m);
  wr(m, 0x83e7, 0x01); // flag already set -> jr nz,0x0936 skips the award
  loc_08e0(m);
  assert.equal(rd(m, 0x83e7), 0x01, "flag unchanged, no re-award");
  assert.equal(rd(m, 0x83e5), 0x00, "lives NOT bumped a second time");
  assert.equal(rd(m, 0x83ef), 0x10, "high score still tracked");
  assert.equal(rd(m, 0x83f0), 0x20, "high score still tracked");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_08e0.js
//   find: mem.write8(regs.hl, regs.a);   // m.step(0x08f7, 7); ld (hl),a -- store score low
//   repl: mem.write8(regs.hl, regs.a ^ 0xff);
//   expect: FAIL  (0x83ed corrupted — caught by checkNoCross)
//   verified-anchor: the ONLY write to 0x83ed is the 0x08f6 low-byte store (0x08fc stores 0x83ee),
//     so corrupting writes to 0x83ed patches exactly that store.
test("loc_08e0: the contract catches a corrupted low-byte score store", () => {
  const m = mk();
  seedNoCross(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x83ed ? (v ^ 0xff) : v, o);
  loc_08e0(m);
  assert.throws(() => checkNoCross(m));
});
