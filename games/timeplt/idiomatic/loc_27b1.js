// SPDX-License-Identifier: GPL-3.0-only
/** loc_27b1 — a round-start sequence arm. Seats a pair of player-object records to their
 * defaults, requests a sound and loads the difficulty record in force, then splits on
 * PLAY_ACTIVE: mid-game it queues a command and folds a program-image checksum into the
 * sound latch; on a fresh round it cycles the stage counter, reseeds the random register,
 * clears two RAM banks and paints the star field. Both arms tail-advance the sequence
 * sub-step. LIVE-OUT: memory (registers and the dead stack scratch aside). */

import { loc_5834 } from "./loc_5834.js";
import { postCommand } from "./postCommand.js";
import { loadDifficultyRecord } from "./loadDifficultyRecord.js";
import { seedRandomRegister } from "./seedRandomRegister.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { u8 } from "../../../core/int.js";
import { PLAY_ACTIVE } from "./names.js";

const SEED_A9CD = 0xa9cd;
const START_RUNG_SOURCE = 0xa9d3;
const SOUND_LATCH = 0xc308;
const STAGE_COUNTER = 0xa9d0;
const SUB_CHECKSUM_CELL = 0xa9ab;
const SEQUENCE_MODE = 0xa9eb;

const ZERO_CELLS = [0xad14, 0xad24, 0xad32, 0xad13, 0xad23, 0xad1d, 0xad2d, 0xad0c];
const ONE_CELLS = [0xad11, 0xad21, 0xad1e, 0xad2e];

export function loc_27b1(m) {
  const { mem8, mem16, regs } = m;

  loc_5834(m);

  mem8[0xac64] = 0x78;
  mem8[0xac65] = 0x84;
  mem16[0xad16] = 0x0000;
  mem16[0xad26] = 0x0000;

  const shared = mem8[SEED_A9CD];
  mem8[0xad12] = shared;
  mem8[0xad22] = shared;

  for (const cell of ZERO_CELLS) mem8[cell] = 0x00;
  for (const cell of ONE_CELLS) mem8[cell] = 0x01;

  if (mem8[PLAY_ACTIVE] !== 0) {
    mem8[0xad33] = 0x00;
    mem16[0xad34] = 0x0000;
    mem8[0xad36] = 0x00;
    mem16[0xad37] = 0x0000;

    regs.de = 0x0400;
    postCommand(m);

    regs.a = mem8[0xa9c4];
    loadDifficultyRecord(m);

    let a = 0;
    for (let hl = 0x1550, i = 0; i < 256; i++, hl++) a ^= mem8[hl];
    mem8[SOUND_LATCH] = u8(a + 1);

    const r = mem8[START_RUNG_SOURCE];
    mem8[0xad1a] = r;
    mem8[0xad2a] = r;
    mem8[SEQUENCE_MODE] = 0x96;
    return advanceSequenceSubStep(m);
  }

  let stage = u8(mem8[STAGE_COUNTER] + 1);
  if (stage >= 0x04) stage = 0x01;
  mem8[STAGE_COUNTER] = stage;
  mem8[0xad14] = stage;
  mem8[0xad11] = u8(stage + 1);

  mem8[0xa980] = 0x00;
  mem8[0xa9ce] = 0x00;
  mem8[0xa9cf] = 0x00;
  seedRandomRegister(m);

  for (let cell = 0xaa80; cell <= 0xaadf; cell++) mem8[cell] = 0x00;
  for (let cell = 0xa800; cell <= 0xa97f; cell++) mem8[cell] = 0x00;

  regs.a = 0x02;
  loadDifficultyRecord(m);

  const r = mem8[START_RUNG_SOURCE];
  mem8[0xad1a] = r;
  mem8[0xad2a] = r;

  let sum = mem8[SUB_CHECKSUM_CELL];
  for (let hl = 0x3310, i = 0; i < 256; i++, hl++) sum = u8(sum - mem8[hl]);
  mem8[SUB_CHECKSUM_CELL] = sum ^ 0x90;

  for (let cell = 0xac74; cell <= 0xac83; cell++) mem8[cell] = 0x80;
  mem8[SEQUENCE_MODE] = 0x5a;
  return advanceSequenceSubStep(m);
}
