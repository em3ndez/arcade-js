// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { GAME_MODE } from "./names.js";
import { seedToneBurstCount } from "./seedToneBurstCount.js";

/**
 * foldToneTableByte -- XOR one indexed table byte into the running byte, then fall into the tone-burst path. ROM 0xd92f.
 *
 * Role in the machine: this is the head of the power-on / attract tone-sequence builder. Tempest's
 * self-test and start-up chirps are assembled from a small table whose base pointer lives in the zero
 * page at GAME_MODE ($0000) (that low cell doubles as an indirect pointer here, not the game-mode code).
 * This step reads one table byte through that pointer, folds it into the running accumulator by XOR, and
 * hands the result straight into the burst-count stage -- so the tone number emitted is a scrambled
 * function of both the caller's A and the table contents at the given cursor.
 *
 * Behavior: form the 16-bit effective address (zero-page pointer word at GAME_MODE) + Y, read that byte,
 * XOR it with the incoming A, and truncate to a byte. Then tail-call seedToneBurstCount with the folded
 * byte as the new A -- it derives the pass-seed from MODE_DISPATCH_SEL and drives runPowerOnToneBursts.
 * There is no local branch or loop; this routine is a single fold that continues the tone pipeline.
 *
 * Live-out: nothing is written to memory here; the folded byte is passed forward as A into
 * seedToneBurstCount, whose return is propagated back to the caller.
 *
 * Grounding: [code].
 */
export function foldToneTableByte(m, a = m.regs.a, y = m.regs.y) {
  const { mem8, mem16 } = m;
  // Read the table byte through the zero-page pointer word at GAME_MODE indexed by Y, XOR into A.
  const folded = u8(a ^ mem8[u16(mem16[GAME_MODE] + y)]);
  // Fall through into the burst-count stage with the folded byte.
  return seedToneBurstCount(m, folded);
}
