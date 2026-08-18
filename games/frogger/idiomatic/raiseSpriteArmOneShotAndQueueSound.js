// SPDX-License-Identifier: GPL-3.0-only
/**
 * raiseSpriteArmOneShotAndQueueSound  —  ROM 0x2ae6  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The shared tail of the sprite-object spawn arms, and a once-per-turn "spawn sound" gate. Frogger's
 *   dispatcher A can fire several spawn arms in a single turn as it seeds the river/road objects, but the
 *   player should hear the spawn chirp at most once — not once per object. This routine is that gate: the
 *   FIRST arm to reach it this turn queues the spawn sound; every later arm this turn finds the flag
 *   already set and does nothing.
 *
 * WHERE IT SITS
 *   It is the common exit of two dispatcher-A arms. spawnSpriteObjectArmA (0x2a6a) *falls straight in* to
 *   it (it is the fall-through tail of that routine), and placeSpriteObjectSlotAndRetire (0x2af3) *calls*
 *   it explicitly at the top of an active placement. So on any frame where either arm does real work, it
 *   passes through here first. The one-shot key, PER_TURN_SCRATCH (0x8371), is a per-turn scratch cell:
 *   it is cleared at the start of every player hand-off by handOffToOtherPlayer (0x0822) and again at the
 *   end-of-sequence step of the in-play cascade, which is what re-arms this gate for the next turn.
 *
 * LIVE-OUT
 *   Memory only. On the already-fired path it writes nothing and returns. On the first-fire path it
 *   latches one flag cell (PER_TURN_SCRATCH) and hands a command to the sound ring. It returns nothing and
 *   leaves no register the caller reads.
 */
import { PER_TURN_SCRATCH } from "./names.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

// The command byte for the sprite-object "spawn" sound effect, as enqueued onto the sound-command ring.
// mechanisms.md and names.js both name 0x90 the "spawn sound"; enqueueSoundCommand (0x0018) is the ring
// producer that carries it.
const SPAWN_SOUND_COMMAND = 0x90;

export function raiseSpriteArmOneShotAndQueueSound(m) {
  const { mem8 } = m;

  // ── One-shot gate: has a spawn already chirped this turn? ─────────────────────────────
  // PER_TURN_SCRATCH (0x8371) is the per-turn one-shot latch. If it is already non-zero, an earlier arm
  // this turn has passed through here and queued the sound, so this arm has nothing to do — bail out
  // untouched. This is what collapses "N objects spawned this turn" down to a single audible chirp.
  if (mem8[PER_TURN_SCRATCH] !== 0) return;

  // ── First fire: latch the one-shot ───────────────────────────────────────────────────
  // Set PER_TURN_SCRATCH (0x8371) to 1 so every subsequent arm this turn takes the early return above.
  // The latch happens up front, before the sound is queued, so it holds even on the paths where the sound
  // itself is discarded (see below) — the "already fired" bookkeeping is independent of whether a noise
  // was actually made.
  mem8[PER_TURN_SCRATCH] = 1;

  // ── Queue the spawn sound ────────────────────────────────────────────────────────────
  // Hand command 0x90 to the sound-command ring via enqueueSoundCommand (0x0018, the `rst 0x18` vector).
  // That primitive silently drops the command when no game is in play (PLAY_FLAG 0x83fe == 0), so a spawn
  // armed outside live play makes no noise — but note the one-shot above has already latched regardless,
  // matching the ROM: the latch fires, the sound may not.
  enqueueSoundCommand(m, SPAWN_SOUND_COMMAND);
}
