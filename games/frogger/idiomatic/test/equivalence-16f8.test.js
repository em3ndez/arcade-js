// SPDX-License-Identifier: GPL-3.0-only
/**
 * equivalence-16f8 — crafted-entry gate: driveFrogDeathAnimation vs the frozen oracle. The hold-flag gate
 * cell is poked non-zero so the death driver runs (an idle frog hits the early ret); the counter is primed
 * to 0x0F so a tick lands on 0x10 and the death-phase dispatch fires. Covers latch mirrors, the pre-target
 * counter tick, both banks' sprite/sound/clear phases, and the board-advance arm. Teeth: no-op, wrong
 * sprite, skipped counter write; positive control the phase sprite is stamped. Stack masked.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { driveFrogDeathAnimation as cand } from "../driveFrogDeathAnimation.js";
import { loc_16f8 as oracle } from "../../translated/loc_16f8.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const GATE = 0x8004, COUNTER = 0x8247, STEP_GATE = 0x8150, LATCH_A = 0x8118;
const SLOT_MIRROR = 0x8120, SLOT_SEL = 0x8121, PHASE = 0x81b2, BANK = 0x829c;
const SPRITE = 0x8045, GAME_MODE = 0x83d6, PLAY = 0x83fe;

const closed = () => craft((mem) => { mem[GATE] = 0; });
const tick = () => craft((mem) => { mem[GATE] = 1; mem[COUNTER] = 0x05; mem[STEP_GATE] = 0; mem[SLOT_MIRROR] = 0; });
const latches = () => craft((mem) => { mem[GATE] = 1; mem[COUNTER] = 0x00; mem[STEP_GATE] = 0x01; mem[LATCH_A] = 0; mem[SLOT_MIRROR] = 0x03; mem[SLOT_SEL] = 0; });
const ph = (bank, phase) => craft((mem) => { mem[GATE] = 1; mem[COUNTER] = 0x0f; mem[BANK] = bank; mem[PHASE] = phase; mem[STEP_GATE] = 0; mem[SLOT_MIRROR] = 0; });
const advance = (bank, phase) => craft((mem) => { mem[GATE] = 1; mem[COUNTER] = 0x0f; mem[BANK] = bank; mem[PHASE] = phase; mem[STEP_GATE] = 0; mem[SLOT_MIRROR] = 0; mem[GAME_MODE] = 1; mem[PLAY] = 0; });

test("EQUAL (crafted): driveFrogDeathAnimation == oracle across branches", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, closed()), null, "gate-closed ret diverged");
  assert.equal(ramDiff(oracle, cand, tick()), null, "counter tick diverged");
  assert.equal(ramDiff(oracle, cand, latches()), null, "latch mirrors diverged");
  assert.equal(ramDiff(oracle, cand, ph(0, 0)), null, "first-bank phase1 diverged");
  assert.equal(ramDiff(oracle, cand, ph(0, 2)), null, "first-bank phase3 diverged");
  assert.equal(ramDiff(oracle, cand, ph(0, 4)), null, "first-bank phase5 diverged");
  assert.equal(ramDiff(oracle, cand, ph(1, 0)), null, "second-bank phase1 diverged");
  assert.equal(ramDiff(oracle, cand, ph(1, 3)), null, "second-bank phase4 diverged");
  assert.equal(ramDiff(oracle, cand, advance(0, 5)), null, "first-bank board-advance diverged");
  assert.equal(ramDiff(oracle, cand, advance(1, 4)), null, "second-bank board-advance diverged");

  const e = ph(0, 0); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[SPRITE], 0x39, "vacuous: phase-1 sprite never stamped");
  console.log(`  EQUAL: 10 branches; phase-1 sprite ${e.mem8[SPRITE]}->${a.mem8[SPRITE]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongSprite = (m) => { cand(m); m.mem8[SPRITE] = (m.mem8[SPRITE] + 1) & 0xff; };
  const skipCounter = (m) => { const c = m.mem8[COUNTER]; cand(m); m.mem8[COUNTER] = c; };
  assert.ok(ramDiff(oracle, noOp, ph(0, 0)), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongSprite, ph(0, 0)), "wrong-sprite twin escaped");
  assert.ok(ramDiff(oracle, skipCounter, tick()), "skip-counter twin escaped");
  console.log("  TEETH: no-op, wrong-sprite, skip-counter all caught");
});
