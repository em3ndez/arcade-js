// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnSpriteObjectArmA (0x2a6a) == frozen oracle. GATE: crafted-entry. The dispatcher-A spawn arm is
 * gated (slot count >= 3, spawn timer just expired, object idle), then rolls the spawn PRNG and walks
 * the placement bands. From a captured post-boot state, regs.ix is aimed at a real record and the gate
 * cells + PRNG ring are poked to drive: the three early gates, the on-screen placement (block_2abe),
 * and the park path (block_2aaa). Live-out memory-only; RAM compared, dead stack scratch masked.
 * Teeth: no-op, wrong sprite, a twin that skips the tail (leaves the object inactive); positive control
 * the tail one-shot really fires.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { spawnSpriteObjectArmA as cand } from "../spawnSpriteObjectArmA.js";
import { loc_2a6a as oracle } from "../../translated/loc_2a6a.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const REC = 0x8440, SLOT_COUNT = 0x83b7, POS = 0x8014, TAIL_FLAG = 0x8371;
const fillRing = (mem, v) => { for (let i = 0; i < 0x20; i++) mem[(0x8400 + i) & 0xffff] = v; };
const at = (mem, mm) => { mm.regs.ix = REC; };

const notArmed = () => craft((mem, mm) => { at(mem, mm); mem[SLOT_COUNT] = 0x02; });
const timerLive = () => craft((mem, mm) => { at(mem, mm); mem[SLOT_COUNT] = 0x03; mem[(REC + 0x0a) & 0xffff] = 0x05; });
const already = () => craft((mem, mm) => { at(mem, mm); mem[SLOT_COUNT] = 0x03; mem[(REC + 0x0a) & 0xffff] = 0x01; mem[(REC + 0x06) & 0xffff] = 0x01; });
const place = () => craft((mem, mm) => {
  at(mem, mm); mem[SLOT_COUNT] = 0x03; mem[(REC + 0x0a) & 0xffff] = 0x01; mem[(REC + 0x06) & 0xffff] = 0x00;
  fillRing(mem, 0x00); mem[0x8400] = 0x03; mem[0x8401] = 0x07; // steer the PRNG into the band walk
  mem[0x8276] = 0x04; mem[0x8278] = 0x02; mem[POS] = 0x80; mem[TAIL_FLAG] = 0x00;
});
const park = () => craft((mem, mm) => {
  at(mem, mm); mem[SLOT_COUNT] = 0x03; mem[(REC + 0x0a) & 0xffff] = 0x01; mem[(REC + 0x06) & 0xffff] = 0x00;
  fillRing(mem, 0x00); mem[0x8400] = 0x05; mem[TAIL_FLAG] = 0x00; // all-zero ring -> park path
});

test("EQUAL (crafted): spawnSpriteObjectArmA == oracle on gates/place/park", { skip }, () => {
  for (const [name, mk] of [["not-armed", notArmed], ["timer-live", timerLive], ["already-active", already], ["place", place], ["park", park]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = place(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[(REC + 0x04) & 0xffff], 0x4e, "place path not exercised: sprite code 0x4e never stamped");
  assert.equal(a.mem8[TAIL_FLAG], 1, "positive control: the tail one-shot (0x8371) must fire 0->1");
  const p = park(); const b = p.clone(); oracle(b);
  assert.equal(b.mem8[(REC + 0x04) & 0xffff], 0x7e, "park path not exercised: sprite code 0x7e never stamped");
  console.log("  EQUAL: not-armed/timer-live/already/place/park; place stamped 0x4e, park stamped 0x7e, tail fired");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongSprite = (m) => { cand(m); m.mem8[(REC + 0x04) & 0xffff] ^= 0xff; };
  const skipTail = (m) => { cand(m); m.mem8[(REC + 0x06) & 0xffff] = 0; };
  assert.ok(ramDiff(oracle, noOp, place()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongSprite, place()), "wrong-sprite twin escaped");
  assert.ok(ramDiff(oracle, skipTail, place()), "skip-tail twin escaped");
  console.log("  TEETH: no-op, wrong-sprite, skip-tail all caught");
});
