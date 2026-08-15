// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitPlayerSelectPrompt — memory-equivalent to the frozen oracle at ROM 0x0DB9.
 * GATE: crafted-entry. Attract never dispatches this board-init header-tile queue (probe: 0
 * dispatches over ENTRY_FRAMES), so a post-boot attract machine is cloned and its credit-count cell
 * (0x83E1) poked to drive the one-credit "1UP" arm and the multi-credit arm. Each arm blits tile
 * columns through m.call(0x0028) (copyRunUpTileColumn), which advances the shared HL/DE pointers the
 * routine reads back; running on a fresh clone per side executes the real callee identically on both
 * sides, so its writes and the final cursor-cap write are part of the compared live-out. Memory-only
 * live-out; the dissolved calls mask the oracle's dead [SP-8,SP) stack scratch. Teeth: three RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { blitPlayerSelectPrompt } from "../blitPlayerSelectPrompt.js";
import { loc_0db9 as oracle } from "../../translated/loc_0db9.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const CREDIT = 0x83e1;
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

// A post-boot machine with a specific credit count; a valid entry, blitPlayerSelectPrompt reads it from RAM.
function entryWithCredit(credit) {
  const e = seedMachine().clone();
  e.mem8[CREDIT] = credit;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP. Neutralize the
// dead [SP-8,SP) stack scratch the oracle's push/call/ret leaves and the register-free rewrite does not.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  for (let k = 1; k <= 8; k++) { const w = (sp - k) & 0xffff; a.mem8[w] = 0; b.mem8[w] = 0; }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const CREDITS = [1, 2, 0, 5]; // one-credit arm, then the multi-credit arm at several counts

const RST28 = 0x0028;
// broken twins, each leaving wrong RAM the diff must catch (multi-credit arm).
function brokenNoOp() {}
function brokenWrongState(m) {
  const { regs, mem8 } = m;
  regs.de = 0x2f88;
  mem8[0x8023] = 4; // BUG: wrong header-state marker
  regs.hl = 0xab11; regs.b = 4; m.push16(0x0dcd); m.call(RST28);
  regs.b = 13; m.push16(0x0dd0); m.call(RST28);
  mem8[regs.hl] = 35;
}
function brokenSkipSecondBlit(m) {
  const { regs, mem8 } = m;
  regs.de = 0x2f88;
  mem8[0x8023] = 3;
  regs.hl = 0xab11; regs.b = 4; m.push16(0x0dcd); m.call(RST28);
  mem8[regs.hl] = 35; // BUG: omits the 13-tile column, so the cursor cap also lands wrong
}

test("EQUAL (crafted): blitPlayerSelectPrompt == oracle on both credit arms", { skip }, () => {
  const entries = CREDITS.map(entryWithCredit);
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(blitPlayerSelectPrompt, e), null, "a crafted credit arm diverged");
  // non-vacuous: the no-op twin diverging proves the oracle writes on the sample entry.
  assert.ok(ramDiff(brokenNoOp, entryWithCredit(2)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted credit arms, blitPlayerSelectPrompt == oracle`);
});

test("TEETH: broken twins are caught on the multi-credit arm", { skip }, () => {
  const e = entryWithCredit(2);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongState, e), "the wrong-state twin escaped");
  assert.ok(ramDiff(brokenSkipSecondBlit, e), "the skip-second-blit twin escaped");
  console.log("  TEETH: no-op, wrong-state, skip-second-blit all caught");
});
