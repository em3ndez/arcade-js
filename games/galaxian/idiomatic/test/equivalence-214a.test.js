// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_214a — crafted-entry equivalence vs the frozen swap-and-draw tail at ROM 0x214a.
 * Swaps DE/HL then stamps a 2x2 tile block (dissolved drawTileBlock2x2) at the pointer that arrived in DE.
 * Two live-out kinds: the four tile writes (VRAM, in the state dump -> ramDiff) AND registers A (advanced
 * tile), HL (advanced pointer) and DE (the old HL handed back by the swap). ramDiff is register-blind, so a
 * regDiff helper compares A/HL/DE too. Teeth: no-op, no-swap (draws at the wrong pointer, DE not threaded),
 * and a wrong-DE twin — each caught on RAM or on a register.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { drawTileBlock2x2AtDe as cand } from "../drawTileBlock2x2AtDe.js";
import { loc_214a as oracle } from "../../translated/loc_214a.js";
import { drawTileBlock2x2 } from "../drawTileBlock2x2.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const DE_DST = 0x5100; // arrives in DE -> becomes the HL draw destination after the swap
const HL_IN = 0x5200;  // arrives in HL -> handed back in DE
const SEED_TILE = 0x40;

const entry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.a = SEED_TILE;
  mm.regs.de = DE_DST;
  mm.regs.hl = HL_IN;
});

// null == equivalent: RAM (stack masked) AND the register live-outs A/HL/DE.
function regDiff(twin, e) {
  const ram = ramDiff(oracle, twin, e);
  if (ram) return `RAM ${ram}`;
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.a !== b.regs.a) return `A: ${a.regs.a} vs ${b.regs.a}`;
  if (a.regs.hl !== b.regs.hl) return `HL: ${a.regs.hl} vs ${b.regs.hl}`;
  if (a.regs.de !== b.regs.de) return `DE: ${a.regs.de} vs ${b.regs.de}`;
  return null;
}

test("EQUAL (crafted): loc_214a == oracle on RAM and registers A/HL/DE", { skip }, () => {
  assert.equal(regDiff(cand, entry()), null, "loc_214a diverged");
  const a = entry(); oracle(a);
  // Top pair at the destination, bottom pair one tile-row (+0x20) below.
  assert.equal(a.mem8[DE_DST], 0x40, "positive control: top-left tile");
  assert.equal(a.mem8[DE_DST + 1], 0x41, "positive control: top-right tile");
  assert.equal(a.mem8[DE_DST + 0x20], 0x42, "positive control: bottom-left tile");
  assert.equal(a.mem8[DE_DST + 0x21], 0x43, "positive control: bottom-right tile");
  assert.equal(a.regs.a, 0x44, "positive control: tile advanced past the block");
  assert.equal(a.regs.hl, DE_DST + 0x40, "positive control: pointer advanced past two rows");
  assert.equal(a.regs.de, HL_IN, "positive control: old HL handed back in DE");
  console.log("  EQUAL: loc_214a == oracle (RAM + A/HL/DE), 2x2 block stamped at the swapped pointer");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const noSwap = (m) => { drawTileBlock2x2(m, m.regs.a, m.regs.hl); }; // draws at HL, DE not threaded
  const wrongDE = (m) => { cand(m); m.regs.de = 0; };
  assert.ok(regDiff(noOp, entry()), "no-op twin escaped");
  assert.ok(regDiff(noSwap, entry()), "no-swap twin escaped (wrong pointer / DE)");
  assert.ok(regDiff(wrongDE, entry()), "wrong-DE twin escaped (register teeth)");
  console.log("  TEETH: no-op, no-swap, wrong-DE all caught");
});
