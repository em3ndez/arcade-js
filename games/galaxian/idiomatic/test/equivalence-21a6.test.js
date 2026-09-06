// SPDX-License-Identifier: GPL-3.0-only
// Crafted-entry equivalence vs the frozen BCD score-update oracle at ROM 0x21a6. The routine is command-
// dispatched (no caller reads a register back), so live-out is memory only: the packed-BCD score field,
// the high-score field, the bonus-marker cells, and score/high-score digit VRAM. EQUAL crafts the gate-skip,
// the 3-byte BCD add (with a full carry chain), several increment indices, both player fields, the
// high-score copy, and the bonus-marker trip; each asserts ramDiff==null with non-vacuous positive controls.
// Teeth: no-op, ignore-gate, wrong increment-table base, always-copy-high-score, and never-award-bonus.
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_21a6 as cand } from "../loc_21a6.js";
import { loc_21a6 as oracle } from "../../translated/loc_21a6.js";
import {
  SCORE_INCREMENT_TABLE, CURRENT_PLAYER, HIGH_SCORE_BCD,
  PLAYER1_SCORE_BCD, PLAYER2_SCORE_BCD, loc_4007, loc_40ac, loc_40ad, loc_421d,
} from "../names.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SCORE = PLAYER1_SCORE_BCD; // player-1 score field (seeds use CURRENT_PLAYER=0)
const HS = HIGH_SCORE_BCD;
const fromBcd = (b) => (b >> 4) * 10 + (b & 0x0f);
const toBcd = (d) => (((d / 10) | 0) << 4) | (d % 10);

// A clean crafted entry: gate clear, player 1, zeroed score, a high score that no small add beats, the bonus
// threshold parked out of reach, and the bonus one-shot flags + marker counter cleared.
function seed(mut) {
  return craft((mem8, m) => {
    m.push16(0x9999); // caller-return word for the oracle's ret / tail dispatch
    m.regs.a = 0; // score-type index
    mem8[loc_4007] = 0;
    mem8[CURRENT_PLAYER] = 0;
    mem8[SCORE] = 0; mem8[SCORE + 1] = 0; mem8[SCORE + 2] = 0;
    mem8[HS] = 0x99; mem8[HS + 1] = 0x99; mem8[HS + 2] = 0x99;
    mem8[loc_40ac] = 0xff;
    mem8[loc_40ad] = 0; mem8[loc_40ad + 1] = 0;
    mem8[loc_421d] = 0;
    if (mut) mut(mem8, m);
  });
}

const gateSet = () => seed((mem) => { mem[loc_4007] = 1; });                              // (0x4007) bit0 -> skip
const add0 = () => seed();                                                                // idx 0 -> +30
const carry = () => seed((mem) => { mem[SCORE] = 0x99; mem[SCORE + 1] = 0x99; });          // 9999+30 carry chain
const idx6 = () => seed((mem, m) => { m.regs.a = 6; });                                    // +100 (touches middle byte)
const idx9 = () => seed((mem, m) => { m.regs.a = 9; });                                    // +300
const beat = () => seed((mem) => { mem[HS] = 0; mem[HS + 1] = 0; mem[HS + 2] = 0; });      // new high score
const bonus = () => seed((mem) => { mem[SCORE + 2] = 0x01; mem[loc_40ac] = 0x10; });       // derived 0x10 -> award
const noBonus = () => seed((mem) => { mem[SCORE + 2] = 0x01; mem[loc_40ac] = 0x11; });     // 0x10 < 0x11 -> no award
const player2 = () => seed((mem) => {
  mem[CURRENT_PLAYER] = 1;
  mem[PLAYER2_SCORE_BCD] = 0; mem[PLAYER2_SCORE_BCD + 1] = 0; mem[PLAYER2_SCORE_BCD + 2] = 0;
});

function runOracle(entry) { const a = entry.clone(); a.routines = STUBS; oracle(a); return a; }

// Wrong increment-table base (+3 = the next row) -> a wrong BCD add; only the score bytes need diverge.
function wrongIncBase(m) {
  const { mem8 } = m;
  if (mem8[loc_4007] & 1) return;
  const score = mem8[CURRENT_PLAYER] === 0 ? SCORE : PLAYER2_SCORE_BCD;
  const inc = SCORE_INCREMENT_TABLE + 3 + m.regs.a * 3;
  let c = 0;
  for (let i = 0; i < 3; i++) {
    const sum = fromBcd(mem8[score + i]) + fromBcd(mem8[inc + i]) + c;
    mem8[score + i] = toBcd(sum % 100);
    c = sum >= 100 ? 1 : 0;
  }
}

test("EQUAL (crafted): loc_21a6 == oracle across gate/BCD/high-score/bonus paths", { skip }, () => {
  for (const [name, mk] of [
    ["gate-set skip", gateSet], ["+30 idx0", add0], ["carry chain", carry],
    ["+100 idx6", idx6], ["+300 idx9", idx9], ["new high score", beat],
    ["bonus tripped", bonus], ["bonus not tripped", noBonus], ["player-2 field", player2],
  ]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `${name} diverged`);
  }

  // Non-vacuous positive controls: the oracle actually mutates the RAM the EQUAL arms compare.
  assert.equal(runOracle(add0()).mem8[SCORE], 0x30, "+30: low score byte 0x00 -> 0x30");
  const cc = runOracle(carry()).mem8;
  assert.deepEqual([cc[SCORE], cc[SCORE + 1], cc[SCORE + 2]], [0x29, 0x00, 0x01], "9999+30 -> 10029 packed BCD");
  assert.equal(runOracle(beat()).mem8[HS], 0x30, "new high score: low byte copied to 0x30");
  assert.equal(runOracle(bonus()).mem8[loc_421d], 1, "bonus tripped: marker counter 0 -> 1");
  assert.equal(runOracle(bonus()).mem8[loc_40ad], 1, "bonus tripped: player-1 one-shot flag raised");
  assert.equal(runOracle(gateSet()).mem8[SCORE], 0x00, "gate set: no score write");
  console.log("  EQUAL: loc_21a6 == oracle (gate skip, BCD add+carry, high-score copy, bonus, P2 field)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  assert.ok(ramDiff(oracle, noOp, add0()), "the no-op twin escaped (the add writes the score)");

  const ignoreGate = (m) => { m.mem8[loc_4007] = 0; cand(m); };
  assert.ok(ramDiff(oracle, ignoreGate, gateSet()), "the ignore-gate twin escaped");

  assert.ok(ramDiff(oracle, wrongIncBase, add0()), "the wrong-table-base twin escaped");

  const alwaysCopyHigh = (m) => {
    cand(m);
    const s = m.mem8[CURRENT_PLAYER] === 0 ? SCORE : PLAYER2_SCORE_BCD;
    for (let i = 0; i < 3; i++) m.mem8[HS + i] = m.mem8[s + i];
  };
  assert.ok(ramDiff(oracle, alwaysCopyHigh, add0()), "the always-copy-high-score twin escaped");

  const neverBonus = (m) => { m.mem8[loc_40ac] = 0xff; cand(m); };
  assert.ok(ramDiff(oracle, neverBonus, bonus()), "the never-award-bonus twin escaped");

  console.log("  TEETH: no-op, ignore-gate, wrong-table-base, always-copy-high, never-bonus all caught");
});
