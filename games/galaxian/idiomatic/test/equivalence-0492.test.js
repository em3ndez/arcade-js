// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0492 — crafted-entry equivalence vs the frozen credit-gated round-launch dispatch at ROM 0x0492.
 * Three memory-only paths:
 *   ONE-PLAYER (IN1 0x4011 bit0): tail into the one-player start (0x04f2) — here with no credits, which
 *     forces GAME_STATE (0x4005)=1.
 *   SPEND (bit0 clear, bit1 set, >=2 credits): spend two credits, blit the 32-byte template (0x051b) into
 *     the saved-state snapshot (0x41a0), arm the state-advance gate (0x41b5) on config 0x401f bit0, then
 *     tail into the round start (0x04bc) with spawn pointer 0x0100 — which blits the flag bitmap (0x4180),
 *     arms the sub-state gate (0x4195), seeds the play cells, and queues spawn words.
 *   LOW CREDITS (bit1 set, <2 credits): ret, nothing touched.
 * Every effect is work RAM, so EQUAL asserts ramDiff==null. Teeth prove the credit spend, both blits, the
 * arm, and the round-start delegate are each load-bearing. Plus an SP-seam tooth on the tail dispatch.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_0492 as cand } from "../loc_0492.js";
import { loc_0492 as oracle } from "../../translated/loc_0492.js";
import { armStateAdvanceGate } from "../armStateAdvanceGate.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const IN1 = 0x4011;
const CREDITS = 0x4002;
const CONFIG = 0x401f;
const TEMPLATE_SRC = 0x051b;
const SNAP = 0x41a0;
const SNAP_END = 0x41bf;
const GATE = 0x41b5; // armStateAdvanceGate cell (inside the snapshot blit)
const GATE_SUB = 0x4195; // armSubstateAdvanceGate cell (round-start, inside the flag bitmap)
const FLAG_BITMAP = 0x4180; // round-start template blit destination
const GAME_STATE = 0x4005;
const PTR_LO = 0x400d;
const PTR_HI = 0x400e;
const QUEUE_HEAD = 0x40a0;
const QUEUE_BASE = 0x4000;
const HEAD = 0xc0;

const spend = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[IN1] = 2; // bit1 set, bit0 clear
  mem[CREDITS] = 5;
  mem[CONFIG] = 1; // config bit0 -> arm both gates
  mem[SNAP] = mem[TEMPLATE_SRC] ^ 0xff; // dirty so the snapshot blit is observable
  mem[SNAP_END] = mem[TEMPLATE_SRC + 31] ^ 0xff;
  mem[FLAG_BITMAP] = mem[TEMPLATE_SRC] ^ 0xff; // dirty so the round-start blit is observable
  mem[GAME_STATE] = 0x55;
  mem[QUEUE_HEAD] = HEAD;
  for (let i = HEAD; i <= 0xff; i++) mem[QUEUE_BASE + i] = 0xff; // arm queue slots free
});

const onePlayer = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[IN1] = 1; // bit0 set -> one-player start
  mem[CREDITS] = 0; // no credits -> the start forces GAME_STATE=1
  mem[GAME_STATE] = 0x55;
});

const lowCredits = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[IN1] = 2; // bit1 set, bit0 clear
  mem[CREDITS] = 1; // < 2 -> ret, no-op
  mem[GAME_STATE] = 0x55;
});

function runOracle(entry) { const a = entry.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_0492 == oracle spending two credits into a round start", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, spend()), null, "loc_0492 diverged on the spend path");
  const a = runOracle(spend());
  assert.equal(a.mem8[CREDITS], 3, "positive control: oracle spent two credits (5->3)");
  assert.equal(a.mem8[SNAP], a.mem8[TEMPLATE_SRC], "positive control: oracle blitted the snapshot head");
  assert.equal(a.mem8[SNAP_END], a.mem8[TEMPLATE_SRC + 31], "positive control: oracle blitted the snapshot tail");
  assert.equal(a.mem8[GATE], 3, "positive control: config bit set -> oracle armed the state gate");
  assert.equal(a.mem8[FLAG_BITMAP], a.mem8[TEMPLATE_SRC], "positive control: round start blitted the flag bitmap");
  assert.equal(a.mem8[GATE_SUB], 3, "positive control: round start armed the sub-state gate");
  assert.equal(a.mem8[GAME_STATE], 3, "positive control: round start set GAME_STATE=3");
  assert.equal(a.mem8[PTR_LO], 0, "positive control: spawn pointer 0x0100 low byte");
  assert.equal(a.mem8[PTR_HI], 1, "positive control: spawn pointer 0x0100 high byte");
  console.log("  EQUAL: loc_0492 == oracle (spend) — credits spent, both blits, both gates armed, round start entered");
});

test("EQUAL (crafted): loc_0492 == oracle starting a one-player game", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, onePlayer()), null, "loc_0492 diverged on the one-player path");
  const a = runOracle(onePlayer());
  assert.equal(a.mem8[GAME_STATE], 1, "positive control: one-player start forced GAME_STATE=1");
  assert.equal(a.mem8[CREDITS], 0, "positive control: no credit to spend");
  console.log("  EQUAL: loc_0492 == oracle (one-player) — GAME_STATE forced to 1");
});

test("EQUAL (crafted): loc_0492 == oracle bailing on insufficient credits", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, lowCredits()), null, "loc_0492 diverged on the low-credit path");
  const a = runOracle(lowCredits());
  assert.equal(a.mem8[CREDITS], 1, "positive control: oracle left the single credit untouched");
  assert.equal(a.mem8[GAME_STATE], 0x55, "positive control: oracle left the game state untouched");
  console.log("  EQUAL: loc_0492 == oracle (low credits) — credit not spent, nothing launched");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongCredit = (m) => { cand(m); m.mem8[CREDITS] = (m.mem8[CREDITS] + 1) & 0xff; };
  const wrongSnapshot = (m) => { cand(m); m.mem8[SNAP] ^= 0xff; };
  const unArm = (m) => { cand(m); m.mem8[GATE] = 0; };
  const skipRoundStart = (m) => {
    m.mem8[CREDITS] = m.mem8[CREDITS] - 2;
    for (let i = 0; i < 32; i++) m.mem8[SNAP + i] = m.mem8[TEMPLATE_SRC + i];
    armStateAdvanceGate(m);
  };
  const consumeAnyway = (m) => { m.mem8[CREDITS] = (m.mem8[CREDITS] - 2) & 0xff; };

  assert.ok(ramDiff(oracle, noOp, spend()), "the no-op twin escaped (spend)");
  assert.ok(ramDiff(oracle, wrongCredit, spend()), "the wrong-credit twin escaped");
  assert.ok(ramDiff(oracle, wrongSnapshot, spend()), "the snapshot-scribble twin escaped");
  assert.ok(ramDiff(oracle, unArm, spend()), "the gate-dropping twin escaped");
  assert.ok(ramDiff(oracle, skipRoundStart, spend()), "the skip-round-start twin escaped (delegate not load-bearing?)");
  assert.ok(ramDiff(oracle, consumeAnyway, lowCredits()), "the consume-anyway twin escaped (credit guard not load-bearing?)");
  console.log("  TEETH: no-op, wrong-credit, snapshot-scribble, drop-arm, skip-round-start, consume-anyway all caught");
});

test("SP-SEAM TOOTH: the tail dispatch places at the dispatch seam", { skip }, () => {
  const r = seamPlaceable(withOmittedRet, cand, 0x0492, spend());
  assert.equal(r.placeable, true, `seam refused the stack-neutral body: ${r.error}`);
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x0492, spend());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places; stack-adrift mutant refused");
});
