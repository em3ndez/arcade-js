// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueSoundCommand — crafted-entry equivalence vs the frozen sound-enqueue primitive.
 * Covers: dropped while not playing (PLAY_FLAG clear); enqueued while playing (head count bumped and
 * the command stored at the new slot); and the head-wrap edge. RAM compared, stack masked. Teeth: a
 * no-op, an unbumped-count twin, a wrong-slot twin; positive control the new slot really changes.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, PLAY_FLAG } from "./_frogHop.js";
import { enqueueSoundCommand as cand } from "../enqueueSoundCommand.js";
import { loc_0018 as oracle } from "../../translated/loc_0018.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const QUEUE_COUNT = 0x8300;
const CMD = 0x42;

const notPlaying = () => craft((mem, mm) => { mem[PLAY_FLAG] = 0; mm.regs.a = CMD; });
const playing = () => craft((mem, mm) => { mem[PLAY_FLAG] = 1; mem[QUEUE_COUNT] = 0x05; mem[QUEUE_COUNT + 6] = 0; mm.regs.a = CMD; });
const wrap = () => craft((mem, mm) => { mem[PLAY_FLAG] = 1; mem[QUEUE_COUNT] = 0xff; mm.regs.a = CMD; });

test("EQUAL (crafted): enqueueSoundCommand == oracle on drop/enqueue/wrap", { skip }, () => {
  for (const [name, mk] of [["drop", notPlaying], ["enqueue", playing], ["wrap", wrap]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = playing(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[QUEUE_COUNT + 6], CMD, "enqueue not exercised: the new slot was never written");
  assert.equal(a.mem8[QUEUE_COUNT], 0x06, "enqueue not exercised: the head count was never bumped");
  console.log(`  EQUAL: drop/enqueue/wrap; enqueue wrote the new slot 0->${CMD} and bumped head 5->6`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const unbumped = (m) => { // stores the command but never bumps the head count
    if (m.mem8[PLAY_FLAG] === 0) return;
    m.mem8[(QUEUE_COUNT & 0xff00) | ((m.mem8[QUEUE_COUNT] + 1) & 0xff)] = m.regs.a;
  };
  const wrongSlot = (m) => { // bumps the count but stores one slot too high
    if (m.mem8[PLAY_FLAG] === 0) return;
    const h = (m.mem8[QUEUE_COUNT] + 1) & 0xff;
    m.mem8[QUEUE_COUNT] = h;
    m.mem8[(QUEUE_COUNT & 0xff00) | ((h + 1) & 0xff)] = m.regs.a;
  };
  assert.ok(ramDiff(oracle, noOp, playing()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, unbumped, playing()), "unbumped-count twin escaped");
  assert.ok(ramDiff(oracle, wrongSlot, playing()), "wrong-slot twin escaped");
  console.log("  TEETH: no-op, unbumped-count, wrong-slot all caught");
});
