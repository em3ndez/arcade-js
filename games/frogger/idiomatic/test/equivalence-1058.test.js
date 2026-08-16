// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm1 — memory-equivalent to the frozen oracle at ROM 0x1058.
 * GATE: crafted-entry. Attract never dispatches this frog-animation arm (probe: 0 over ENTRY_FRAMES),
 * so a post-boot attract clone is poked into a coherent arm state: a small sprite triple at 0x8273,
 * the anim index 0x8000 set to 0x0a so the render loop's tail wraps without re-cascading, and the
 * pre-blit trigger 0x8118 driven both off and on. Both sides m.call the frozen pre-blit (0x0f8c) and
 * render loop (0x0ff1) on their own clone, so those callees run identically and their writes are part
 * of the compared live-out. Live-out is memory-only, so RAM is compared, not registers/SP. Teeth: four
 * broken twins. NOTE: links once names.js exports LANE_OBJLIST_8109, SCROLL_GRID_SRC_PHASE16 (added in a later pass).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { renderFrogAnimArm1 } from "../renderFrogAnimArm1.js";
import { loc_1058 as oracle } from "../../translated/loc_1058.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ANIM_INDEX = 0x8000;
const SPRITE_TRIPLE = 0x8273;
const PREBLIT_TRIGGER = 0x8118;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A coherent post-boot arm state. The index is parked at 0x0a so the render loop's tail advances it
// to 0x0b and wraps to 0, terminating rather than re-dispatching the whole anim table.
function entry(preblitTrigger) {
  const e = seedMachine().clone();
  e.mem8[ANIM_INDEX] = 0x0a;
  e.mem8[SPRITE_TRIPLE] = 0x40; // sprite code
  e.mem8[SPRITE_TRIPLE + 1] = 2; // row count
  e.mem8[SPRITE_TRIPLE + 2] = 2; // outer count
  e.mem8[PREBLIT_TRIGGER] = preblitTrigger;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins, each mirroring the marshal-then-render shape but with one defect.
function brokenNoOp() {}
function brokenWrongCode(m) {
  const { regs, mem8, mem16 } = m;
  m.push16(0x105b); m.call(0x0f8c);
  const code = mem8[SPRITE_TRIPLE];
  mem8[0x81b1] = (code ^ 0xff) & 0xff; // BUG: wrong plot byte
  mem16[0x8001] = 0x1423;
  regs.a = code; regs.b = mem8[SPRITE_TRIPLE + 1]; regs.c = mem8[SPRITE_TRIPLE + 2];
  regs.hl = mem16[0x13ef]; regs.de = 0x1423; regs.ix = 0x8109; regs.iy = 0x8109;
  return m.call(0x0ff1);
}
function brokenSkipPreblit(m) {
  const { regs, mem8, mem16 } = m;
  // BUG: never runs the pre-blit
  const code = mem8[SPRITE_TRIPLE];
  mem8[0x81b1] = code; mem16[0x8001] = 0x1423;
  regs.a = code; regs.b = mem8[SPRITE_TRIPLE + 1]; regs.c = mem8[SPRITE_TRIPLE + 2];
  regs.hl = mem16[0x13ef]; regs.de = 0x1423; regs.ix = 0x8109; regs.iy = 0x8109;
  return m.call(0x0ff1);
}
function brokenWrongCount(m) {
  const { regs, mem8, mem16 } = m;
  m.push16(0x105b); m.call(0x0f8c);
  const code = mem8[SPRITE_TRIPLE];
  mem8[0x81b1] = code; mem16[0x8001] = 0x1423;
  regs.a = code; regs.b = (mem8[SPRITE_TRIPLE + 1] + 1) & 0xff; // BUG: wrong row count into the render loop
  regs.c = mem8[SPRITE_TRIPLE + 2];
  regs.hl = mem16[0x13ef]; regs.de = 0x1423; regs.ix = 0x8109; regs.iy = 0x8109;
  return m.call(0x0ff1);
}

test("EQUAL (crafted): renderFrogAnimArm1 == oracle on the pre-blit off/on paths", { skip }, () => {
  const entries = [entry(0x00), entry(0x01)];
  for (const e of entries) assert.equal(ramDiff(renderFrogAnimArm1, e), null, "a crafted entry diverged");
  // non-vacuous: the no-op twin diverging proves the oracle actually writes on the sample entry.
  assert.ok(ramDiff(brokenNoOp, entry(0x01)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted paths, renderFrogAnimArm1 == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entry(0x01); // pre-blit on: exercises both callees
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongCode, e), "the wrong-code twin escaped");
  assert.ok(ramDiff(brokenSkipPreblit, e), "the skip-preblit twin escaped");
  assert.ok(ramDiff(brokenWrongCount, e), "the wrong-count twin escaped");
  console.log("  TEETH: no-op, wrong-code, skip-preblit, wrong-count all caught");
});
