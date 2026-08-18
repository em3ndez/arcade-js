// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceVblankNmi  —  ROM 0x0066  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The vblank NMI handler: one full frame of interrupt service. The video hardware raises an NMI once
 *   per displayed frame, and this routine is the game's frame clock and its SOLE accumulator — everything
 *   that moves forward in time (timers, positions, scores, mode transitions) is stepped here, exactly once
 *   per frame. The free-running foreground loop (drainForegroundThenYieldEachVblank, 0x0341) only renders
 *   the header and reads the START buttons; it writes no accumulating state, so this NMI is where the game
 *   actually advances.
 *
 * WHERE IT SITS
 *   Fired by the engine as this.call(0x0066) at each vblank. It runs a fixed prologue every frame — ack
 *   the interrupt, scan coins, blit the sprite shadow to OBJRAM, tick the coin-counter pulse timers,
 *   cocktail-mirror the 2P sprites — then forks on the play/mode flags into one of two worlds: the in-play
 *   sub-engine cascade (lane motion, frog-vs-lane collision, death animation, score/countdowns,
 *   board-complete reveal) or the attract/intro housekeeping (demo sequencer, intro pacer, slate scrub).
 *   Every arm converges on the epilogue, which re-arms the NMI.
 *
 * STRUCTURE
 *   The body is a faithful transcription of the ROM's basic-block graph: each inner function is one ROM
 *   label, and its NAME IS THAT LABEL'S ADDRESS (b_00fc = ROM 0x00fc, b_0122 = ROM 0x0122, …). A
 *   `return b_xxxx()` is the ROM's jump to that label — a tail-call chain, not real recursion. The address
 *   names are kept deliberately as exact cross-references into the disassembly; each block's comment says
 *   in plain terms what that block does and why.
 *
 * NOT MODELLED
 *   The hardware register save/restore that brackets the handler (those registers are dead to this layer)
 *   and the interrupt-return instruction itself (memory-inert). Only the memory effects are reproduced.
 *
 * LIVE-OUT
 *   Memory only — the OBJRAM sprite shadow, the coin/credit and timer state, and the stepped sub-engine
 *   state. Returns nothing; leaves no register the caller reads.
 */
import {
  PLAY_FLAG, GAME_MODE, ACTIVE_PLAYER, IN2_PORT, FROG_Y, OBJECT_READY_0, FLY_SPRITE_X,
  COIN_PULSE_TIMER_0, COIN_PULSE_TIMER_1, BOARD_LAYOUT_GATE, FROG_TIMER_A, POINT_TABLE_DRAW_STATE,
  ATTRACT_DEMO_PHASE_COUNTER, PER_TURN_SCRATCH, PLAYER1_SLOT, PLAYER2_SLOT, HOME_REVEAL_DELAY_TIMER,
  HOME_REVEAL_COUNTDOWN, INPLAY_COUNTDOWN_WORD, BOARD_ADVANCE_DONE_FLAG, SCROLL_EDGE_FLAG,
  SCROLL_WRAP_LATCH, LANE_OBJLIST_8109, LANE_OBJLIST_8124, HOME_COLUMN_STATE, FROG_STATE_DEMO_FLAG,
  loc_83cf, PLAYER1_DIFFICULTY_INDEX, HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY,
  HOME_BAY1_OCCUPANCY_ALT, HOME_BAY5_OCCUPANCY_ALT, COIN_COUNTER_0, COIN_COUNTER_1,
  STATUS_ROW_VRAM_BASE, NO_MORE_FROGS_COLUMN_VRAM,
  FLY_SPRITE_Y, SPRITE_SHADOW_SRC_BASE, SPRITE_OBJECT_SLOT_A, STATUS_ROW_BLIT_COUNTDOWN,
  GATED_COUNTDOWN_ENABLE_MIRROR, OBJRAM_SPRITE_DMA_LEAD, OBJRAM_SPRITE_BLIT_BASE,
  OBJRAM_FLY_SPRITE_BASE, FLY_SPRITE_Y_OBJRAM, FROG_SPRITE_Y_OBJRAM, OBJRAM_SPRITE_SLOT_A_BASE,
  NMI_ENABLE, SOUND_SEQUENCE_COUNTDOWN, BOARD_ADVANCE_REVEAL_STRIP_SRC,
  loc_83af, loc_83b0, loc_83b1,
} from "./names.js";
import { scanCoinInputAndCredit } from "./scanCoinInputAndCredit.js";
import { dequeueSoundCommand } from "./dequeueSoundCommand.js";
import { moveLaneObjectsAndCarryFrog } from "./moveLaneObjectsAndCarryFrog.js";
import { advanceAnimationFrameBuffer } from "./advanceAnimationFrameBuffer.js";
import { driveScoreDisplayCountdown } from "./driveScoreDisplayCountdown.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { advanceScrollLaneObjects } from "./advanceScrollLaneObjects.js";
import { dispatchFrogMoveAgainstLanes } from "./dispatchFrogMoveAgainstLanes.js";
import { driveSpriteObjectCluster } from "./driveSpriteObjectCluster.js";
import { tickGatedCountdown } from "./tickGatedCountdown.js";
import { loc_0292 } from "./loc_0292.js";
import { loc_05d3 } from "./loc_05d3.js";
import { stampHomeBayFrogByColumn } from "./stampHomeBayFrogByColumn.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { driveAttractDemoSequencer } from "./driveAttractDemoSequencer.js";
import { driveFrogDeathAnimation } from "./driveFrogDeathAnimation.js";
import { driveInPlayFrameUpdate } from "./driveInPlayFrameUpdate.js";
import { orchestrateCollisionsAndFrogInput } from "./orchestrateCollisionsAndFrogInput.js";
import { u16 } from "../../../core/int.js";

// The sprite hardware stores each shadow byte's two nibbles in swapped order, so the DMA blit below swaps
// them back as it copies: high nibble <-> low nibble. This is the hardware's sprite-attribute encoding,
// not a change of value.
const swapNibbles = (v) => ((v >> 4) | (v << 4)) & 0xff;

export function serviceVblankNmi(m) {
  const { mem8, mem16 } = m;

  // ── Prologue, step 1: ack the interrupt ──────────────────────────────────────────────
  // NMI_ENABLE (0xb808) is the vblank NMI-enable latch. Writing 0 acknowledges and disables the interrupt
  // so it does not re-fire while we service it; the epilogue writes 1 to re-arm it. (On hardware the
  // register save and watchdog read happen around here; both are dead to this memory-only layer.)
  mem8[NMI_ENABLE] = 0; // ack; the register save + watchdog read are dead here

  // ── Prologue, step 2: coin scan ──────────────────────────────────────────────────────
  // scanCoinInputAndCredit (0x2cf0) latches the inverted coin/service bits on its first pass, then on the
  // release edge credits one coin: it issues the coin sound, pulses the credited slot's hardware counter,
  // and (unless a game is already live) forces the player-select mode and redraws the credit line.
  scanCoinInputAndCredit(m);

  // ── Prologue, step 3: sprite-DMA shadow blit ─────────────────────────────────────────
  // Publish this frame's sprites: copy the work-RAM sprite shadow into OBJRAM so the video hardware sees
  // them, with the per-byte nibble-swap the attribute encoding requires. (See blitSpriteShadow below.)
  blitSpriteShadow(m);

  // ── Prologue, step 4: coin-counter pulse timers ──────────────────────────────────────
  // The coin scanner started a physical pulse on a hardware coin-counter and seeded a short timer. Here we
  // tick each timer (COIN_PULSE_TIMER_1 0x837f, COIN_PULSE_TIMER_0 0x837e) down by one while it is set, and
  // when a timer drains to 0 we drop its coin-counter latch (COIN_COUNTER_1 0xb81c / COIN_COUNTER_0 0xb818)
  // back to 0 — ending the physical pulse the scanner began.
  if (mem8[COIN_PULSE_TIMER_1] !== 0) {
    const v = (mem8[COIN_PULSE_TIMER_1] - 1) & 0xff;
    mem8[COIN_PULSE_TIMER_1] = v;
    if (v === 0) mem8[COIN_COUNTER_1] = 0; // io
  }
  if (mem8[COIN_PULSE_TIMER_0] !== 0) {
    const v = (mem8[COIN_PULSE_TIMER_0] - 1) & 0xff;
    mem8[COIN_PULSE_TIMER_0] = v;
    if (v === 0) mem8[COIN_COUNTER_0] = 0; // io
  }

  // Fall into the block graph. b_00ce is ROM label 0x00ce (the cocktail mirror); from there each block
  // tail-calls the next ROM label until an arm reaches the epilogue.
  return b_00ce();

  // ── Prologue, step 5 — Cocktail mirror (ROM 0x00ce) ──────────────────────────────────
  // On a cocktail cabinet the second player sees a screen flipped 180°. When IN2_PORT (0xe004) bit 3 (the
  // cocktail / 2P-select line) is set AND a game is live (PLAY_FLAG 0x83fe != 0) with player 2 or higher
  // active (ACTIVE_PLAYER 0x83fd is neither 0 nor 1), nudge the OBJRAM copies of the fly and frog Y down
  // by two pixels: FLY_SPRITE_Y_OBJRAM (0xb043) = FLY_SPRITE_Y (0x8043) + 2 and FROG_SPRITE_Y_OBJRAM
  // (0xb047) = FROG_Y (0x8047) + 2. Only the Y bytes are touched — this is the second player's sprite
  // registration tweak for the flipped view.
  function b_00ce() {
    if ((mem8[IN2_PORT] & 0x08) !== 0 &&
        mem8[PLAY_FLAG] !== 0 &&
        mem8[ACTIVE_PLAYER] !== 0 &&
        mem8[ACTIVE_PLAYER] !== 1) {
      mem8[FLY_SPRITE_Y_OBJRAM] = mem8[FLY_SPRITE_Y] + 2;
      mem8[FROG_SPRITE_Y_OBJRAM] = mem8[FROG_Y] + 2;
    }
    return b_00fc();
  }

  // ── Fork on PLAY_FLAG, then the in-play frame (ROM 0x00fc) ────────────────────────────
  // PLAY_FLAG (0x83fe) is 0 during attract and the player count (1/2) during a game. If 0, hand the whole
  // frame to the attract/intro branch (b_0122). Otherwise we are in play: pop one queued sound
  // (dequeueSoundCommand 0x07ac). BOARD_LAYOUT_GATE (0x83ea) is 0 until the board is laid out, so while it
  // is 0 there is nothing to step yet and we go straight to the epilogue. FROG_TIMER_A (0x83d2) is a 16-bit
  // freeze/hold timer (e.g. start-of-life pause): while it is non-zero we decrement it and run only the
  // MINIMAL world step — move the lane objects and carry the frog (moveLaneObjectsAndCarryFrog 0x14b7) plus
  // advance the animation buffer — deferring the full gameplay cascade until the timer drains to 0 (b_0171).
  function b_00fc() {
    if (mem8[PLAY_FLAG] === 0) return b_0122();
    dequeueSoundCommand(m);
    if (mem8[BOARD_LAYOUT_GATE] === 0) return epilogue();
    const w = mem16[FROG_TIMER_A];
    if (w === 0) return b_0171();
    mem16[FROG_TIMER_A] = u16(w - 1);
    moveLaneObjectsAndCarryFrog(m);
    advanceAnimationFrameBuffer(m);
    return epilogue();
  }

  // ── Attract / intro housekeeping (ROM 0x0122) ────────────────────────────────────────
  // Reached when PLAY_FLAG is 0. GAME_MODE (0x83d6) >= 2 is an intro / point-table mode: pace it in
  // b_0158. GAME_MODE == 0 is attract proper: step the attract demo sequencer (driveAttractDemoSequencer
  // 0x0e7a). In either sub-2 mode we then call driveInPlayFrameUpdate (0x2341) (a bare return outside
  // active play) and scrub the per-frame demo scratch so attract begins each frame from a clean slate:
  // clear FROG_STATE_DEMO_FLAG (0x83cd), loc_83cf (0x83cf), GATED_COUNTDOWN_ENABLE_MIRROR (0x83b5) and the
  // word PLAYER1_DIFFICULTY_INDEX (0x8293), then zero the whole slot/occupancy run from PLAYER1_SLOT
  // (0x825c) through HOME_BAY5_OCCUPANCY_ALT (0x8267). Finally seed the three still-ungrounded NMI-pointer
  // cells loc_83af/loc_83b0/loc_83b1 (0x83af–0x83b1) to 0x80/0/0 (role open — read indirectly via the NMI
  // HL pointer).
  function b_0122() {
    if (mem8[GAME_MODE] >= 2) return b_0158();
    if (mem8[GAME_MODE] === 0) driveAttractDemoSequencer(m);
    driveInPlayFrameUpdate(m);
    mem8[FROG_STATE_DEMO_FLAG] = 0;
    mem8[loc_83cf] = 0;
    mem8[GATED_COUNTDOWN_ENABLE_MIRROR] = 0;
    mem16[PLAYER1_DIFFICULTY_INDEX] = 0;
    for (let a = PLAYER1_SLOT; a <= HOME_BAY5_OCCUPANCY_ALT; a++) mem8[a] = 0;
    mem8[loc_83af] = 0x80;
    mem8[loc_83b0] = 0;
    mem8[loc_83b1] = 0;
    return epilogue();
  }

  // ── Intro-mode pacing countdown (ROM 0x0158) ─────────────────────────────────────────
  // POINT_TABLE_DRAW_STATE (0x83d8) paces the intro / point-table screens. Hold here until it drains:
  // return if it is already 0, otherwise decrement it. Only on the frame it reaches 0 AND the attract-demo
  // phase counter ATTRACT_DEMO_PHASE_COUNTER (0x83d7) is also 0 do we step GAME_MODE (0x83d6) down by one,
  // advancing the intro sequence one stage toward attract/play.
  function b_0158() {
    if (mem8[POINT_TABLE_DRAW_STATE] === 0) return epilogue();
    mem8[POINT_TABLE_DRAW_STATE] = mem8[POINT_TABLE_DRAW_STATE] - 1;
    if (mem8[POINT_TABLE_DRAW_STATE] !== 0) return epilogue();
    if (mem8[ATTRACT_DEMO_PHASE_COUNTER] !== 0) return epilogue();
    mem8[GAME_MODE] = mem8[GAME_MODE] - 1;
    return epilogue();
  }

  // ── Full in-play cascade: sound-sequence countdown (ROM 0x0171) ──────────────────────
  // Reached when FROG_TIMER_A has drained: the frame's full gameplay accumulation begins here.
  // SOUND_SEQUENCE_COUNTDOWN (0x8382) is the 16-bit timer for the currently playing sound sequence.
  // Decrement it, and on the frame it reaches 0 enqueue the end-of-sequence sound pair (commands 0x0f
  // then 0xb0) and clear the per-turn scratch cell PER_TURN_SCRATCH (0x8371).
  function b_0171() {
    const w = mem16[SOUND_SEQUENCE_COUNTDOWN];
    if (w === 0) return b_018a();
    const dec = u16(w - 1);
    mem16[SOUND_SEQUENCE_COUNTDOWN] = dec;
    if (dec !== 0) return b_018a();
    enqueueSoundCommand(m, 0x0f);
    enqueueSoundCommand(m, 0xb0);
    mem8[PER_TURN_SCRATCH] = 0;
    return b_018a();
  }

  // ── Board-complete dispatch on the active player (ROM 0x018a) ─────────────────────────
  // Branch on which player is up (ACTIVE_PLAYER 0x83fd): (ACTIVE_PLAYER - 1) != 0 means player 2 is
  // active, handled in b_0274. For player 1, PLAYER1_SLOT (0x825c) == 5 means all five home bays are
  // filled — the board is complete — handled in b_025e. Otherwise fall through to the normal
  // reveal/collision chain (b_0199).
  function b_018a() {
    if (((mem8[ACTIVE_PLAYER] - 1) & 0xff) !== 0) return b_0274();
    if (mem8[PLAYER1_SLOT] === 0x05) return b_025e();
    return b_0199();
  }

  // ── Reveal chain: drain the delay timer (ROM 0x0199) ─────────────────────────────────
  // HOME_REVEAL_DELAY_TIMER (0x8298) delays the start of the board-complete "all frogs home" reveal. While
  // it is non-zero, just count it down this frame and skip ahead to the status-row/redraw stage (b_01e2);
  // the reveal countdown proper does not begin until this drains.
  function b_0199() {
    if (mem8[HOME_REVEAL_DELAY_TIMER] === 0) return b_01a6();
    mem8[HOME_REVEAL_DELAY_TIMER] = mem8[HOME_REVEAL_DELAY_TIMER] - 1;
    return b_01e2();
  }

  // ── Reveal + master collision/input (ROM 0x01a6) ─────────────────────────────────────
  // Once the delay timer has drained: if the reveal countdown HOME_REVEAL_COUNTDOWN (0x8297) is still
  // running, tick it (b_0257). If the in-play countdown word INPLAY_COUNTDOWN_WORD (0x829d) is non-zero,
  // wait (b_01e2). Only when both are clear do we run the frame's real gameplay: the score-display
  // countdown (driveScoreDisplayCountdown 0x0870) and the master collision/input orchestrator
  // (orchestrateCollisionsAndFrogInput 0x1a55). GATED_COUNTDOWN_ENABLE_MIRROR (0x83b5) is then a one-shot
  // latch: on the first frame through here it is 0, so we set it to 1 and arm the status-row redraw
  // (STATUS_ROW_BLIT_COUNTDOWN 0x8384 = 0xff); later frames short-circuit at the latch. Finally, on the
  // first frame that BOARD_ADVANCE_DONE_FLAG (0x8380) is set (the foreground finished laying the next
  // board), clear it, reload SOUND_SEQUENCE_COUNTDOWN to 64, and run the 7-tile ROM reveal strip
  // BOARD_ADVANCE_REVEAL_STRIP_SRC (0x2f7b) up the NO_MORE_FROGS_COLUMN_VRAM (0xaa51) column via
  // copyRunUpTileColumn (0x0028).
  function b_01a6() {
    if (mem8[HOME_REVEAL_COUNTDOWN] !== 0) return b_0257();
    if (mem16[INPLAY_COUNTDOWN_WORD] !== 0) return b_01e2();
    driveScoreDisplayCountdown(m);
    orchestrateCollisionsAndFrogInput(m);
    if (mem8[GATED_COUNTDOWN_ENABLE_MIRROR] !== 0) return b_01e2();
    mem8[GATED_COUNTDOWN_ENABLE_MIRROR] = 1;
    mem8[STATUS_ROW_BLIT_COUNTDOWN] = 0xff;
    if (mem8[BOARD_ADVANCE_DONE_FLAG] === 0) return b_01e2();
    mem8[BOARD_ADVANCE_DONE_FLAG] = 0;
    mem16[SOUND_SEQUENCE_COUNTDOWN] = 64;
    copyRunUpTileColumn(m, NO_MORE_FROGS_COLUMN_VRAM, BOARD_ADVANCE_REVEAL_STRIP_SRC, 0x07);
    return b_01e2();
  }

  // ── Status-row redraw tick (ROM 0x01e2) ──────────────────────────────────────────────
  // STATUS_ROW_BLIT_COUNTDOWN (0x8384) was armed to 0xff above. If it is 0 there is nothing to do; skip to
  // the world step (b_01f2). Otherwise decrement it, and on the frame it hits 0 repaint the four-tile
  // status row (blitFourTileGroupColumn 0x19e2) at STATUS_ROW_VRAM_BASE (0xa850). Then continue to b_01f2.
  function b_01e2() {
    if (mem8[STATUS_ROW_BLIT_COUNTDOWN] === 0) return b_01f2();
    const d = (mem8[STATUS_ROW_BLIT_COUNTDOWN] - 1) & 0xff;
    mem8[STATUS_ROW_BLIT_COUNTDOWN] = d;
    if (d === 0) { blitFourTileGroupColumn(m, STATUS_ROW_VRAM_BASE); }
    return b_01f2();
  }

  // ── World step: scroll & animate, open the collision-scan bracket (ROM 0x01f2) ────────
  // Scroll the lane objects (advanceScrollLaneObjects 0x2005) and advance the animation buffer. The
  // frog-vs-lane collision scan (in b_0212) must read the lane object lists as they were BEFORE this
  // frame's scroll, so blocks b_01f2..b_0222 form a ±1 bracket: roll the two list indices back, run the
  // scan, then roll them forward again. Here, if SCROLL_EDGE_FLAG (0x8107) is set, step the first list
  // index LANE_OBJLIST_8109 (0x8109) back by one.
  function b_01f2() {
    advanceScrollLaneObjects(m);
    advanceAnimationFrameBuffer(m);
    if (mem8[SCROLL_EDGE_FLAG] !== 0) mem8[LANE_OBJLIST_8109] = mem8[LANE_OBJLIST_8109] - 1;
    return b_0205();
  }

  // ── Collision-scan bracket: roll back the second list (ROM 0x0205) ───────────────────
  // If SCROLL_WRAP_LATCH (0x8108) is set, step the second list index LANE_OBJLIST_8124 (0x8124) back by
  // one — the other half of the pre-scroll roll-back.
  function b_0205() {
    if (mem8[SCROLL_WRAP_LATCH] !== 0) mem8[LANE_OBJLIST_8124] = mem8[LANE_OBJLIST_8124] - 1;
    return b_0212();
  }

  // ── Collision-scan bracket: run the scan, restore the first list (ROM 0x0212) ─────────
  // With the indices rolled back, run the frog move-vs-lanes resolver (dispatchFrogMoveAgainstLanes
  // 0x11bf) so its collision scan sees the pre-scroll lists. Then restore LANE_OBJLIST_8109 (0x8109),
  // stepping it forward one (gated on SCROLL_EDGE_FLAG 0x8107, mirroring the roll-back in b_01f2).
  function b_0212() {
    dispatchFrogMoveAgainstLanes(m);
    if (mem8[SCROLL_EDGE_FLAG] !== 0) mem8[LANE_OBJLIST_8109] = mem8[LANE_OBJLIST_8109] + 1;
    return b_0222();
  }

  // ── Collision-scan bracket: restore the second list (ROM 0x0222) ─────────────────────
  // Restore LANE_OBJLIST_8124 (0x8124), stepping it forward one (gated on SCROLL_WRAP_LATCH 0x8108),
  // closing the ±1 bracket so both lists are back to their post-scroll values.
  function b_0222() {
    if (mem8[SCROLL_WRAP_LATCH] !== 0) mem8[LANE_OBJLIST_8124] = mem8[LANE_OBJLIST_8124] + 1;
    return b_022f();
  }

  // ── World step: death, motion, sprites, countdowns, home bays (ROM 0x022f) ────────────
  // The rest of the per-frame world update, in order: drive the frog death animation
  // (driveFrogDeathAnimation 0x16f8), move the lane objects and carry the frog (moveLaneObjectsAndCarryFrog
  // 0x14b7), update the sprite-object cluster (driveSpriteObjectCluster 0x2970), tick the gated countdown
  // (tickGatedCountdown), and run loc_0292 (0x0292, which decrements the in-play countdown word). Finally,
  // if the home-reveal countdown HOME_REVEAL_COUNTDOWN (0x8297) is non-zero, use it as a column selector to
  // stamp that home bay's frog (stampHomeBayFrogByColumn 0x06a2). Then to the epilogue.
  function b_022f() {
    driveFrogDeathAnimation(m);
    moveLaneObjectsAndCarryFrog(m);
    driveSpriteObjectCluster(m);
    tickGatedCountdown(m);
    loc_0292(m);
    const sel = mem8[HOME_REVEAL_COUNTDOWN];
    if (sel !== 0) stampHomeBayFrogByColumn(m, sel);
    return epilogue();
  }

  // ── Tick the home-reveal countdown (ROM 0x0257) ──────────────────────────────────────
  // The reveal is running: count HOME_REVEAL_COUNTDOWN (0x8297) down by one this frame, then continue to
  // the status-row / world stage (b_01e2). (b_022f later reads this same cell as the home-bay column
  // selector.)
  function b_0257() {
    mem8[HOME_REVEAL_COUNTDOWN] = mem8[HOME_REVEAL_COUNTDOWN] - 1;
    return b_01e2();
  }

  // ── Player-1 board complete (ROM 0x025e) ─────────────────────────────────────────────
  // All five of player 1's home bays are filled (PLAYER1_SLOT == 5). Clear the five PRIMARY-bank home-bay
  // occupancy gates HOME_BAY1_OCCUPANCY_PRIMARY (0x825e) through HOME_BAY5_OCCUPANCY_PRIMARY (0x8262),
  // reset PLAYER1_SLOT (0x825c) to 0, and run the board-complete handler loc_05d3 (0x05d3). Then epilogue.
  function b_025e() {
    for (let a = HOME_BAY1_OCCUPANCY_PRIMARY; a <= HOME_BAY5_OCCUPANCY_PRIMARY; a++) mem8[a] = 0;
    mem8[PLAYER1_SLOT] = 0;
    loc_05d3(m);
    return epilogue();
  }

  // ── Player-2 board / home state (ROM 0x0274) ─────────────────────────────────────────
  // Player 2 is active. If player 2 does NOT yet have all five bays home (PLAYER2_SLOT != 5), fall through
  // to the normal reveal chain (b_0199). Otherwise the mirror of b_025e against the ALTERNATE bank: clear
  // HOME_BAY1_OCCUPANCY_ALT (0x8263) through HOME_BAY5_OCCUPANCY_ALT (0x8267), reset PLAYER2_SLOT (0x825d)
  // to 0, and run the board-complete handler loc_05d3 (0x05d3). Then epilogue.
  function b_0274() {
    if (mem8[PLAYER2_SLOT] !== 0x05) return b_0199();
    for (let a = HOME_BAY1_OCCUPANCY_ALT; a <= HOME_BAY5_OCCUPANCY_ALT; a++) mem8[a] = 0;
    mem8[PLAYER2_SLOT] = 0;
    loc_05d3(m);
    return epilogue();
  }

  // ── Epilogue: re-arm the NMI ─────────────────────────────────────────────────────────
  // Every dispatch arm converges here. On hardware the saved registers are restored (dead to this layer);
  // the one memory effect is re-enabling the vblank interrupt latch — NMI_ENABLE (0xb808) = 1 — so the next
  // vblank fires.
  function epilogue() {
    mem8[NMI_ENABLE] = 1; // io
  }
}

/**
 * blitSpriteShadow — the per-frame sprite-DMA blit (prologue step 3 of ROM 0x0066).
 *
 * Copies the work-RAM sprite shadow into OBJRAM so the video hardware sees this frame's sprites. Three
 * regions are copied:
 *   1. A single lead byte: OBJECT_READY_0 (0x8007) straight to OBJRAM_SPRITE_DMA_LEAD (0xb007).
 *   2. 28 (0x1c) two-byte pairs from SPRITE_SHADOW_SRC_BASE (0x8008) to OBJRAM_SPRITE_BLIT_BASE (0xb008):
 *      the even byte of each pair is nibble-swapped (the attribute encoding), the odd byte copies straight.
 *   3. A second region whose base and pass count are gated by HOME_COLUMN_STATE (0x842f): when it is 0,
 *      eight 4-byte passes from FLY_SPRITE_X (0x8040) to OBJRAM_FLY_SPRITE_BASE (0xb040); otherwise six
 *      passes from SPRITE_OBJECT_SLOT_A (0x8048) to OBJRAM_SPRITE_SLOT_A_BASE (0xb048). In each 4-byte pass
 *      only byte 0 is nibble-swapped; the other three copy straight.
 */
function blitSpriteShadow(m) {
  const { mem8 } = m;
  mem8[OBJRAM_SPRITE_DMA_LEAD] = mem8[OBJECT_READY_0];
  for (let i = 0; i < 0x1c; i++) {
    const s = SPRITE_SHADOW_SRC_BASE + i * 2, d = OBJRAM_SPRITE_BLIT_BASE + i * 2;
    mem8[d] = swapNibbles(mem8[s]);
    mem8[d + 1] = mem8[s + 1];
  }
  let passes, sBase, dBase;
  if (mem8[HOME_COLUMN_STATE] === 0) { passes = 8; sBase = FLY_SPRITE_X; dBase = OBJRAM_FLY_SPRITE_BASE; }
  else { passes = 6; sBase = SPRITE_OBJECT_SLOT_A; dBase = OBJRAM_SPRITE_SLOT_A_BASE; }
  for (let p = 0; p < passes; p++) {
    const s = sBase + p * 4, d = dBase + p * 4;
    mem8[d] = swapNibbles(mem8[s]);
    mem8[d + 1] = mem8[s + 1];
    mem8[d + 2] = mem8[s + 2];
    mem8[d + 3] = mem8[s + 3];
  }
}
