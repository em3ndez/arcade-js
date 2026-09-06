// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_018c — equivalent to the frozen oracle. Sub-state 0 setup: appends two command words to the command
 * queue (work RAM), enables the starfield latch (io.starsEnable, NOT in the state dump), advances the
 * sub-state index, clears four work-RAM cells, and seeds the dwell cascade. EQUAL asserts ramDiff==null
 * (all the RAM writes incl. the queue) AND io.starsEnable equality. Teeth: a no-op and a queue scribble
 * (ramDiff), plus a stars-off twin (io). The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { initSequenceEnableStarfield as cand } from "../initSequenceEnableStarfield.js";
import { loc_018c as oracle } from "../../translated/loc_018c.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const HEAD = 0x40a0;   // command-queue write-head
const SLOT0 = 0x40c0;  // queue floor slot (poked free)
const SLOT2 = 0x40c2;  // next slot (poked free)
const STATE = 0x400a;  // sub-state index (incremented)
const FLAG = 0x4007;
const SUBTIMER = 0x4008;
const TIER = 0x4009;

// Seed: return addr + a queue with two free slots at the floor so both enqueues land observably.
const entry = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[HEAD] = 0xc0;   // head at the floor
  mem[SLOT0] = 0x80;  // free (bit 7 set)
  mem[SLOT2] = 0x80;  // free
  mem[FLAG] = 0; mem[STATE] = 0; mem[SUBTIMER] = 0; mem[TIER] = 0;
  m.mem.io.setStarsEnable(0); // start disabled so enabling is observable
});

const starsAfter = (fn, e) => { const m = e.clone(); m.routines = STUBS; fn(m); return m.mem.io.starsEnable; };

test("EQUAL (crafted): loc_018c == oracle sets up sub-state 0", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_018c diverged in RAM");
  assert.equal(starsAfter(cand, entry()), starsAfter(oracle, entry()), "starfield latch diverged");
  // positive controls: the oracle really did the setup.
  const a = entry(); oracle(a);
  assert.equal(a.mem8[FLAG], 1, "positive control: flag cell set");
  assert.equal(a.mem8[STATE], 1, "positive control: sub-state index bumped");
  assert.equal(a.mem8[SUBTIMER], 0x60, "positive control: dwell sub-timer seeded");
  assert.equal(a.mem8[TIER], 0x10, "positive control: dwell tier seeded");
  assert.equal(a.mem8[SLOT0], 0x07, "positive control: first command word hi byte queued");
  assert.equal(a.mem8[HEAD], 0xc4, "positive control: write-head advanced past both words");
  assert.equal(starsAfter(oracle, entry()), 1, "positive control: starfield enabled");
  console.log("  EQUAL: loc_018c == oracle (RAM + io.starsEnable), queue + dwell seed");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribble = (m) => { cand(m); m.mem8[SLOT0] ^= 0xff; };
  const noStars = (m) => { cand(m); m.mem.io.setStarsEnable(0); };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, scribble, entry()), "the queue-scribble twin escaped");
  assert.notEqual(starsAfter(noStars, entry()), starsAfter(oracle, entry()), "the stars-off twin escaped (io)");
  console.log("  TEETH: no-op, queue scribble (RAM), stars-off (io) all caught");
});
