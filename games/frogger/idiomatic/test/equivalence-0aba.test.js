// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0aba — memory-equivalent to the frozen oracle at ROM 0x0ABA.
 * GATE: crafted-entry. Attract never dispatches this one-time display-field setup (probe: 0
 * dispatches over ENTRY_FRAMES; its callers are the board-layout handlers attract does not reach),
 * so a post-boot attract machine is cloned and the layout-done guard (0x842D) is poked to drive both
 * paths — cleared to 0 for the full body (guard set, mode cells written, the 4-tile blit, the 15-row
 * fill, the two scroll seeds), and left non-zero for the early-return guard. The dissolved caller calls
 * the idiomatic blit directly while the oracle runs the frozen one, so their writes match. The routine
 * reads its input from memory and its live-out is memory-only, so RAM is compared and registers/SP are
 * not; the compared RAM excludes the dead [SP-8, SP) stack scratch the direct call leaves unpushed.
 * Teeth: three twins — no-op, a wrong-value twin (wrong fill tile), and a skip-a-call twin (omits
 * the blit).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0aba } from "../loc_0aba.js";
import { loc_0aba as oracle } from "../../translated/loc_0aba.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const GUARD = 0x842d;
const BLIT_DEST = 0xa8bf;
const BLIT_SRC = 0x2f6e;
const FILL_BASE = 0xa8df;
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

// A post-boot machine with the layout-done guard forced; a valid entry, the routine reads from RAM.
function craft(guard) {
  const e = seedMachine().clone();
  e.mem8[GUARD] = guard;
  return e;
}

// null == RAM-equivalent, excluding the dead [SP-8, SP) stack scratch. The dissolved caller makes a
// direct JS call instead of pushing a Z80 return bracket, so that window below the entry stack pointer
// carries oracle-only residue and never live-out. Memory-only: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  for (let k = 1; k <= 8; k++) {
    const addr = (sp - k) & 0xffff;
    if (addr >= 0x8000 && addr <= 0x87ff) { const o = addr - 0x8000; da[o] = 0; db[o] = 0; }
  }
  const d = firstStateDiff(da, db, (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins on the full-body (guard 0) path.
function brokenNoOp() {}
function brokenWrongTile(m) {
  const { regs, mem8, mem16 } = m;
  if (mem8[GUARD] !== 0) return;
  mem8[GUARD] = 1; mem8[0x803f] = 3; mem8[0x83e0] = 0;
  regs.hl = BLIT_DEST; regs.de = BLIT_SRC; regs.b = 4;
  m.push16(0x0ad5); m.call(0x0028);
  let cell = FILL_BASE;
  for (let row = 0; row < 15; row++) { mem8[cell] = 13; cell = (cell + 32) & 0xffff; } // BUG: tile 13 not 12
  mem16[0x83dc] = 0x3c20; mem8[0x83de] = 96;
}
function brokenSkipBlit(m) {
  const { mem8, mem16 } = m;
  if (mem8[GUARD] !== 0) return;
  mem8[GUARD] = 1; mem8[0x803f] = 3; mem8[0x83e0] = 0;
  // BUG: omit the 4-tile blit
  let cell = FILL_BASE;
  for (let row = 0; row < 15; row++) { mem8[cell] = 12; cell = (cell + 32) & 0xffff; }
  mem16[0x83dc] = 0x3c20; mem8[0x83de] = 96;
}

test("EQUAL (crafted): loc_0aba == oracle on the body and the guard", { skip }, () => {
  assert.equal(ramDiff(loc_0aba, craft(0)), null, "the full-body path diverged");
  assert.equal(ramDiff(loc_0aba, craft(1)), null, "the guard path diverged");
  assert.ok(ramDiff(brokenNoOp, craft(0)), "vacuous: oracle wrote nothing on the body path");
  assert.equal(ramDiff(brokenNoOp, craft(1)), null, "guard path should be a no-op on both sides");
  console.log("  EQUAL: body + guard paths, loc_0aba == oracle");
});

test("TEETH: broken twins are caught on the body path", { skip }, () => {
  const e = craft(0);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, e), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenSkipBlit, e), "the skip-blit twin escaped");
  console.log("  TEETH: no-op, wrong-tile, skip-blit all caught");
});
