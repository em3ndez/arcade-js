// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0f69 — memory-equivalent to the frozen oracle at ROM 0x0F69.
 * GATE: crafted-entry, stack-masked. Attract runs this score-packer only at cold-start (0x0567), so a
 * post-boot attract clone gets the two score words (0x83EB, 0x83ED) poked to drive both orderings and
 * the equal / high-byte-tie edges, then both sides run through the same real 0x0A84 rank helper. That
 * helper and the oracle push onto the Z80 stack while this rewrite holds the intermediate words in
 * locals, so the two leave different DEAD residue in the top-of-stack scratch — masked off; every
 * live cell (the display field 0x83FB/0x83FC and the rank table 0x83F1-0x83FA the helper edits) is
 * compared. Live-out is memory-only. Teeth: four broken twins.
 * NOTE: links once names.js exports loc_83eb/loc_83ed/loc_83fb, added in the naming pass.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0f69 } from "../loc_0f69.js";
import { loc_0f69 as oracle } from "../../translated/loc_0f69.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const P2_SCORE = 0x83eb;
const HIGH_SCORE = 0x83ed;
const DISPLAY = 0x83fb;
const STACK_SCRATCH = 32; // bytes below the seated SP the pushes may touch
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

function entryWithScores(p2, high) {
  const e = seedMachine().clone();
  e.mem.write8(P2_SCORE, p2 & 0xff); e.mem.write8(P2_SCORE + 1, (p2 >> 8) & 0xff);
  e.mem.write8(HIGH_SCORE, high & 0xff); e.mem.write8(HIGH_SCORE + 1, (high >> 8) & 0xff);
  return e;
}

// null == RAM-equivalent outside the dead stack scratch [SP-32, SP). Memory-only live-out.
function ramDiff(cand, machine) {
  const lo = (machine.regs.sp - STACK_SCRATCH) & 0xffff;
  const hi = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  for (let off = 0; off < db.length; off++) {
    const addr = a.stateOffsetToAddr(off);
    if (addr != null && addr >= lo && addr < hi) db[off] = da[off];
  }
  const d = firstStateDiff(da, db, (off) => a.stateOffsetToAddr(off));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}
function oracled(machine) { const a = machine.clone(); oracle(a); return a.dumpState(); }

// broken twins.
function brokenNoOp() {}
function brokenSwapStore(m) { pack(m, { swapStore: true }); }
function brokenSkipSecond(m) { pack(m, { skipSecond: true }); }
function brokenWrongOrder(m) { pack(m, { wrongOrder: true }); }
function pack(m, { swapStore = false, skipSecond = false, wrongOrder = false } = {}) {
  const { regs, mem16 } = m;
  const high = mem16[HIGH_SCORE], p2 = mem16[P2_SCORE];
  const larger = wrongOrder ? (p2 < high ? p2 : high) : (p2 < high ? high : p2);
  const smaller = wrongOrder ? (p2 < high ? high : p2) : (p2 < high ? p2 : high);
  regs.d = (larger >> 8) & 0xff; regs.e = larger & 0xff;
  m.push16(0x0f80); m.call(0x0a84);
  const firstRank = regs.a;
  if (skipSecond) { mem16[DISPLAY] = firstRank & 0xffff; return; } // BUG: skip the second rank call
  regs.d = (smaller >> 8) & 0xff; regs.e = smaller & 0xff;
  m.push16(0x0f85); m.call(0x0a84);
  const secondRank = regs.a;
  mem16[DISPLAY] = swapStore
    ? ((firstRank << 8) | secondRank) & 0xffff // BUG: byte order swapped
    : ((secondRank << 8) | firstRank) & 0xffff;
}

const CASES = [
  [0x1234, 0x5678], // p2 < high
  [0x9abc, 0x1111], // p2 > high
  [0x4444, 0x4444], // p2 == high
  [0x0000, 0x0000], // both zero
  [0x5010, 0x5020], // same high byte, low byte decides
];

test("EQUAL (crafted): loc_0f69 == oracle on every ordering", { skip }, () => {
  const entries = CASES.map(([p2, high]) => entryWithScores(p2, high));
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(loc_0f69, e), null, "a crafted entry diverged");
  const e = entryWithScores(0x9abc, 0x1111);
  assert.notDeepEqual(oracled(e), e.dumpState(), "vacuous: oracle changed nothing");
  console.log(`  EQUAL: ${entries.length} crafted orderings, loc_0f69 == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entryWithScores(0x9abc, 0x1111);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenSwapStore, e), "the swapped-store twin escaped");
  assert.ok(ramDiff(brokenSkipSecond, e), "the skip-second-call twin escaped");
  assert.ok(ramDiff(brokenWrongOrder, e), "the wrong-order twin escaped");
  console.log("  TEETH: no-op, swapped-store, skip-second-call, wrong-order all caught");
});
