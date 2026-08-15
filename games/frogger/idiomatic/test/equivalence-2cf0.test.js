// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanCoinInputAndCredit — memory-equivalent to the frozen oracle at ROM 0x2CF0.
 * GATE: crafted-entry. From a captured post-boot state the latch cell (0x83E2), IN0, the coinage word
 * (0x83D4), the coin-pair toggle, the credit total, the play flag and the game mode are poked to drive:
 * the boot/attract latch of ~IN0 & 0xC4; the still-held reject; a coin-slot-1 credit (bit6 clear); a
 * coin-slot-2 credit (bit6 set, coinage 6 -> +6); the every-other-coin gate (skip on odd, credit on
 * even); the BCD clamp at 0x99; the already-playing return after the add; and the mode-5 player-select
 * path. The oracle reaches the coin sound / prompt / credit-line via m.call; the rewrite dissolves the
 * three lifted callees. RAM compared, dead stack masked. Teeth: no-op, wrong latch, wrong credit;
 * positive control the latch write is observable.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { scanCoinInputAndCredit as cand } from "../scanCoinInputAndCredit.js";
import { loc_2cf0 as oracle } from "../../translated/loc_2cf0.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const LATCH = 0x83e2, COINAGE = 0x83d4, COINAGE_HI = 0x83d5, TOGGLE = 0x83e3;
const CREDIT = 0x83e1, PLAY = 0x83fe, MODE = 0x83d6;
const RELEASE = 0xff, HELD = 0xff & ~0x04;

const latch = () => craft((mem, c) => { mem[LATCH] = 0; c.io.in0 = 0xf3; });
const held = () => craft((mem, c) => { mem[LATCH] = 0x40; c.io.in0 = HELD; });
const slot1 = () => craft((mem, c) => {
  mem[LATCH] = 0x80; c.io.in0 = RELEASE; mem[COINAGE] = 0; mem[COINAGE_HI] = 0;
  mem[PLAY] = 0; mem[MODE] = 0; mem[CREDIT] = 0x03;
});
const slot2 = () => craft((mem, c) => {
  mem[LATCH] = 0x40; c.io.in0 = RELEASE; mem[COINAGE] = 6; mem[COINAGE_HI] = 0;
  mem[PLAY] = 0; mem[MODE] = 0; mem[CREDIT] = 0x03;
});
const gateOdd = () => craft((mem, c) => {
  mem[LATCH] = 0x80; c.io.in0 = RELEASE; mem[COINAGE] = 2; mem[COINAGE_HI] = 0; mem[TOGGLE] = 0;
  mem[PLAY] = 0; mem[MODE] = 0; mem[CREDIT] = 0x03;
});
const gateEven = () => craft((mem, c) => {
  mem[LATCH] = 0x80; c.io.in0 = RELEASE; mem[COINAGE] = 2; mem[COINAGE_HI] = 0; mem[TOGGLE] = 1;
  mem[PLAY] = 0; mem[MODE] = 0; mem[CREDIT] = 0x03;
});
const clamp = () => craft((mem, c) => {
  mem[LATCH] = 0x40; c.io.in0 = RELEASE; mem[COINAGE] = 6; mem[COINAGE_HI] = 0;
  mem[PLAY] = 1; mem[CREDIT] = 0x97; // 0x97 + 6 -> daa carry -> clamp 0x99
});
const playing = () => craft((mem, c) => {
  mem[LATCH] = 0x80; c.io.in0 = RELEASE; mem[COINAGE] = 0; mem[COINAGE_HI] = 0; mem[PLAY] = 1; mem[CREDIT] = 0x10;
});
const mode5 = () => craft((mem, c) => {
  mem[LATCH] = 0x80; c.io.in0 = RELEASE; mem[COINAGE] = 0; mem[COINAGE_HI] = 0;
  mem[PLAY] = 0; mem[MODE] = 5; mem[CREDIT] = 0x01;
});

test("EQUAL (crafted): scanCoinInputAndCredit == oracle across latch/credit/gate/clamp/play/mode5", { skip }, () => {
  for (const [name, mk] of [
    ["latch", latch], ["held", held], ["slot1", slot1], ["slot2", slot2],
    ["gate-odd", gateOdd], ["gate-even", gateEven], ["clamp", clamp], ["playing", playing], ["mode5", mode5],
  ]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const noOp = () => {};
  assert.ok(ramDiff(oracle, noOp, latch()), "vacuous: oracle wrote nothing on the latch path");
  assert.ok(ramDiff(oracle, noOp, slot1()), "vacuous: oracle wrote nothing on the slot-1 credit path");
  console.log("  EQUAL: latch/held/slot1/slot2/gate-odd/gate-even/clamp/playing/mode5");
});

test("POSITIVE CONTROL: the boot latch writes ~IN0 & 0xC4", { skip }, () => {
  const e = latch(); const a = e.clone(); oracle(a);
  const want = (~0xf3) & 0xc4;
  assert.equal(a.mem8[LATCH], want, "boot latch never wrote 0x83E2 — case is vacuous");
  console.log(`  POSITIVE CONTROL: 0x83E2 -> 0x${want.toString(16)} on the boot latch`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongLatch = (m) => { cand(m); m.mem8[LATCH] = (m.mem8[LATCH] + 1) & 0xff; };
  const wrongCredit = (m) => { cand(m); m.mem8[CREDIT] = (m.mem8[CREDIT] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, latch()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongLatch, latch()), "wrong-latch twin escaped");
  assert.ok(ramDiff(oracle, wrongCredit, slot1()), "wrong-credit twin escaped");
  console.log("  TEETH: no-op, wrong-latch, wrong-credit all caught");
});
