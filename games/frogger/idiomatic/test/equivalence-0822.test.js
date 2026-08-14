// SPDX-License-Identifier: GPL-3.0-only
/**
 * handOffToOtherPlayer — memory-equivalent to the frozen oracle at ROM 0x0822.
 * GATE: crafted-entry. Attract never dispatches this player-swap, so coherent post-boot states are
 * captured at the per-frame score redraw (0x0b1f) and replayed through both sides; the routine reads
 * all its inputs from memory (no register live-in), so any such state is a valid entry. Real states
 * hold the play flag at 0 (multi-player path, cocktail disabled), so a seeded twin enables cocktail
 * to exercise the flip arm and a second twin forces the one-player early return. The flip_x/flip_y
 * writes (0xB810/0xB80C) are IO latches absent from dumpState, so the cocktail toggle is observed
 * through its work-RAM latch (0x83CB); both sides drive the same IO setter identically. Live-out is
 * memory-only, so RAM is compared and registers/SP are not. Teeth: three broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { handOffToOtherPlayer } from "../handOffToOtherPlayer.js";
import { loc_0822 as oracle } from "../../translated/loc_0822.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const NEIGHBOUR = 0x0b1f; // per-frame score redraw; a source of coherent post-boot states
const CAP = 200;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let captured = null;
function captureNeighbours() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(NEIGHBOUR);
  const m = makeMachine(new Map([[NEIGHBOUR, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.ok(entries.length > 0, "vacuous: the neighbour was never dispatched, no state to replay");
  captured = entries;
  return captured;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// cocktail entry: two players, active player 1, distinct lives, cocktail enabled; markers on the
// reset cells so the swap is observable.
function craftCocktail(machine) {
  const c = machine.clone();
  c.mem8[0x83fe] = 2; c.mem8[0x83fd] = 1;
  c.mem8[0x83b8] = 5; c.mem8[0x83b9] = 3;
  c.mem8[0x83c2] = 1; c.mem8[0x83cb] = 0;
  c.mem8[0x8371] = 0x99; c.mem8[0x83b7] = 0x99; c.mem8[0x83b6] = 0x99; c.mem8[0x825a] = 0x99;
  return c;
}
function craft1p(machine) { const c = machine.clone(); c.mem8[0x83fe] = 1; c.mem8[0x8371] = 0x99; return c; }
function oracled(machine) { const a = machine.clone(); oracle(a); return a.dumpState(); }

function brokenNoOp() {}
function brokenWrongToggle(m) {
  const { mem8 } = m;
  mem8[0x8371] = 0;
  if (mem8[0x83fe] === 1) return;
  const player = mem8[0x83fd] ^ 0x02;   // BUG: ^2 not ^3
  mem8[0x83fd] = player;
  mem8[0x83b7] = mem8[player === 1 ? 0x83b8 : 0x83b9];
  mem8[0x83b6] = 0; mem8[0x825a] = 1;
  if (mem8[0x83c2] === 0) return;
  const flip = mem8[0x83cb] ^ 0x01;
  mem8[0x83cb] = flip; mem8[0xb810] = flip; mem8[0xb80c] = flip;
}
function brokenSkipFlipLatch(m) {
  const { mem8 } = m;
  mem8[0x8371] = 0;
  if (mem8[0x83fe] === 1) return;
  const player = mem8[0x83fd] ^ 0x03;
  mem8[0x83fd] = player;
  mem8[0x83b7] = mem8[player === 1 ? 0x83b8 : 0x83b9];
  mem8[0x83b6] = 0; mem8[0x825a] = 1;
  // BUG: return before toggling the cocktail flip latch even when enabled
}

test("REAL: oracle == rewrite on every captured neighbour state", { skip }, () => {
  const entries = captureNeighbours();
  for (const e of entries) assert.equal(ramDiff(handOffToOtherPlayer, e), null, "a captured machine diverged");
  console.log(`  REAL: ${entries.length} neighbour states, oracle == rewrite`);
});

test("CRAFTED: oracle == rewrite on the cocktail and one-player arms", { skip }, () => {
  const base = captureNeighbours()[0];
  const cocktail = craftCocktail(base), one = craft1p(base);
  assert.equal(ramDiff(handOffToOtherPlayer, cocktail), null, "diverged on the cocktail flip arm");
  assert.equal(ramDiff(handOffToOtherPlayer, one), null, "diverged on the one-player early-return arm");
  assert.notDeepEqual(oracled(cocktail), cocktail.dumpState(), "cocktail entry vacuous: oracle changed nothing");
  console.log("  CRAFTED: cocktail-flip and one-player arms, oracle == rewrite");
});

test("TEETH: broken twins are caught on the cocktail entry", { skip }, () => {
  const cocktail = craftCocktail(captureNeighbours()[0]);
  assert.ok(ramDiff(brokenNoOp, cocktail), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongToggle, cocktail), "the wrong-toggle twin escaped");
  assert.ok(ramDiff(brokenSkipFlipLatch, cocktail), "the skip-flip-latch twin escaped");
  console.log("  TEETH: no-op, wrong-toggle, skip-flip-latch all caught");
});
