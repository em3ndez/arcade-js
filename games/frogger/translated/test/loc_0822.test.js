// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0822 (Frogger player-swap + cocktail flip, ROM 0x0822-0x085A). Clears (0x8371);
// 1-player rets. 2-player toggles (0x83FD^=3), loads that player's lives into (0x83B7), resets
// (0x83B6)/(0x825A), and (when (0x83C2)!=0) toggles the flip latch (0x83CB^1 -> flip_x/flip_y).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0822 } from "../loc_0822.js";

function mk(players) {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.workRam[0x371] = 0xff; m.mem.workRam[0x3fe] = players;
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

function checkSwap(m) {
  assert.equal(r(m, 0x8371), 0x00, "(0x8371) cleared");
  assert.equal(r(m, 0x83fd), 0x01, "(0x83fd): 2 ^ 3 = 1 (now player 1)");
  assert.equal(r(m, 0x83b7), 0x07, "(0x83b7) = player-1 lives from (0x83b8)");
  assert.equal(r(m, 0x83b6), 0x00, "(0x83b6) = 0");
  assert.equal(r(m, 0x825a), 0x01, "(0x825a) = 1");
  assert.equal(r(m, 0x83cb), 0x01, "(0x83cb): 0 ^ 1 = 1");
  assert.equal(m.io.flipX, 1, "flip_x latched from D0=1");
  assert.equal(m.io.flipY, 1, "flip_y latched from D0=1");
}

test("loc_0822: 2-player swap toggles lives + flip latch; 247 T", () => {
  const m = mk(0x02);
  m.mem.workRam[0x3fd] = 0x02; m.mem.workRam[0x3b8] = 0x07; m.mem.workRam[0x3c2] = 0x01;
  loc_0822(m);
  checkSwap(m);
  assert.equal(m.cycles, 247, "full 2-player + flip path");
});

test("loc_0822: 1-player clears (0x8371) and rets; 45 T", () => {
  const m = mk(0x01);
  m.mem.workRam[0x3fd] = 0x02;
  loc_0822(m);
  assert.equal(r(m, 0x8371), 0x00, "(0x8371) cleared");
  assert.equal(r(m, 0x83fd), 0x02, "player byte untouched in a 1-player game");
  assert.equal(m.cycles, 45, "xor a 4 + ld(nn),a 13 + ld a,(nn) 13 + dec a 4 + ret z 11");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0822.js
//   find: mem.write8(0x83b7, regs.a);
//   repl: mem.write8(0x83b7, regs.a ^ 0xff);
//   expect: FAIL  (stores the complemented lives — caught by checkSwap)
//   verified-anchor: count == 1  (the sole (0x83b7) store in loc_0822.js)
// Simulated by corrupting exactly the (0x83b7) store, which is what that edit produces.
test("loc_0822: the contract catches a corrupted lives store", () => {
  const m = mk(0x02);
  m.mem.workRam[0x3fd] = 0x02; m.mem.workRam[0x3b8] = 0x07; m.mem.workRam[0x3c2] = 0x01;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x83b7 ? (v ^ 0xff) : v, o);
  loc_0822(m);
  assert.throws(() => checkSwap(m));
});
