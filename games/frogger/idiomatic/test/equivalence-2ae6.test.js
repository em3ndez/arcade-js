// SPDX-License-Identifier: GPL-3.0-only
/**
 * raiseSpriteArmOneShotAndQueueSound — crafted-entry equivalence vs the frozen sprite-arm tail. Covers
 * already-fired (untouched return), fresh+playing (one-shot latches AND spawn sound enqueued), and
 * fresh+not-playing (latches but the ring drops the sound). RAM masked. Teeth + positive controls.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, PLAY_FLAG } from "./_frogHop.js";
import { raiseSpriteArmOneShotAndQueueSound as cand } from "../raiseSpriteArmOneShotAndQueueSound.js";
import { loc_2ae6 as oracle } from "../../translated/loc_2a6a.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const ONE_SHOT = 0x8371;
const QUEUE_COUNT = 0x8300;   // SOUND_QUEUE_COUNT (ring head)
const CMD = 0x90;

// Already fired this turn: the one-shot is set -> both sides must leave everything untouched.
const alreadyFired = () => craft((mem) => { mem[ONE_SHOT] = 0x07; mem[PLAY_FLAG] = 1; mem[QUEUE_COUNT] = 0x05; });
// Fresh + playing: latch the one-shot AND enqueue the sound.
const freshPlaying = () => craft((mem) => { mem[ONE_SHOT] = 0x00; mem[PLAY_FLAG] = 1; mem[QUEUE_COUNT] = 0x05; mem[QUEUE_COUNT + 6] = 0; });
// Fresh + not playing: the one-shot still latches, but the ring drops the sound.
const freshNotPlaying = () => craft((mem) => { mem[ONE_SHOT] = 0x00; mem[PLAY_FLAG] = 0; mem[QUEUE_COUNT] = 0x05; });

test("EQUAL (crafted): raiseSpriteArmOneShotAndQueueSound == oracle on all three paths", { skip }, () => {
  for (const [name, mk] of [["already-fired", alreadyFired], ["fresh+playing", freshPlaying], ["fresh+not-playing", freshNotPlaying]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }

  // Positive control 1: fresh+playing really latches the one-shot AND writes the sound slot + bumps head.
  const p = freshPlaying(); const a = p.clone(); oracle(a);
  assert.equal(a.mem8[ONE_SHOT], 0x01, "vacuous: the one-shot never latched 0->1");
  assert.equal(a.mem8[QUEUE_COUNT], 0x06, "vacuous: the ring head was never bumped 5->6");
  assert.equal(a.mem8[QUEUE_COUNT + 6], CMD, `vacuous: the sound command ${CMD} was never stored at the new slot`);

  // Positive control 2: the already-fired path really is a no-op (the one-shot keeps its prior value).
  const f = alreadyFired(); const b = f.clone(); oracle(b);
  assert.equal(b.mem8[ONE_SHOT], 0x07, "already-fired path unexpectedly wrote the one-shot");
  assert.equal(b.mem8[QUEUE_COUNT], 0x05, "already-fired path unexpectedly queued a sound");

  console.log(`  EQUAL: already-fired/fresh+playing/fresh+not-playing; one-shot 0->1, head 5->6, slot 0->${CMD}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const latchButNoSound = (m) => { // latches the one-shot but forgets to queue the sound
    if (m.mem8[ONE_SHOT] !== 0) return;
    m.mem8[ONE_SHOT] = 1;
  };
  const guardSkipped = (m) => { // always latches + queues, ignoring the already-fired guard
    m.mem8[ONE_SHOT] = 1;
    if (m.mem8[PLAY_FLAG] === 0) return;
    const h = (m.mem8[QUEUE_COUNT] + 1) & 0xff;
    m.mem8[QUEUE_COUNT] = h;
    m.mem8[(QUEUE_COUNT & 0xff00) | h] = CMD;
  };
  assert.ok(ramDiff(oracle, noOp, freshPlaying()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, latchButNoSound, freshPlaying()), "latch-but-no-sound twin escaped");
  assert.ok(ramDiff(oracle, guardSkipped, alreadyFired()), "guard-skipping twin escaped");
  console.log("  TEETH: no-op, latch-but-no-sound, guard-skipping all caught");
});
