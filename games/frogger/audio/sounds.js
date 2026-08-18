// SPDX-License-Identifier: GPL-3.0-only
//
// Frogger sound-command map — DATA ONLY. The main CPU never makes sound itself: it parks a one-byte
// command on PPI1 port A (0xD000, SOUND_CMD_LATCH) and pulses PPI1 port B bit 3 low (0xD002) so the
// falling edge wakes a second Z80 + AY-3-8910 that plays the effect (issueSoundCommand, ROM 0x0794).
// That audio CPU is NOT emulated: web/player.html replays one recorded clip per command (record/replay,
// like Time Pilot). This file is the committed, human-readable record of what each command MEANS and
// what the hardware DID when driven — the clips + index.json are gitignored copyright, so a fresh clone
// is silent by design.
//
// name/kind are two independent readings that a wrong player conflates: `fires` (which ROM routine sends
// the command) names the game FUNCTION; `measured` is what the recorder heard when it drove that byte in
// isolation (games/frogger/tools/record_samples.py). Where they DISAGREE — a command a routine treats as
// a sound but the hardware plays silent — the entry carries an explicit `conflict`, never a quiet pick.

export const KINDS = ["oneshot", "sustained", "control"];
export const SOURCES = ["ay8910", "none"];
export const CONFIDENCE = ["confirmed", "inferred", "unknown"];

// The two sound-side write surfaces (boards/frogger/io.js, galaxian.cpp konami_sound_control_w @855).
export const PORTS = { latch: 0xd000, control: 0xd002, intBit: 3, muteBit: 4 };

// Every command Frogger's code sends to the latch, keyed by byte. `measured.audible`/`durationSec` come
// from record_samples.py; a silent control byte carries no clip, so the player plays nothing for it.
const SOUNDS = {
  model: "clips",
  soundLatch: 0xd000,
  ports: PORTS,
  commands: {
    0x00: {
      name: "silence",
      kind: "control",
      source: "none",
      confidence: "confirmed",
      fires: "cold-boot mute pulse (initColdBootAndEnterMainLoop 0x02a3) and the prefix of every queued jingle sequence (drainForegroundThenYieldEachVblank, driveFrogDeathAnimation)",
      evidence: ["initColdBootAndEnterMainLoop issues command 0 as the boot mute pulse", "recorder: cmd 0x00 measured silent"],
      measured: { audible: false, kind: "silent", durationSec: 0 },
    },
    0x01: {
      name: "coin",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "a coin is credited (scanCoinInputAndCredit 0x2cf0 issues command 1 directly, bypassing the ring)",
      evidence: ["scanCoinInputAndCredit issueSoundCommand(m, 1) on the coin release edge", "recorder: cmd 0x01 audible 1.88s one-shot"],
      measured: { audible: true, kind: "oneshot", durationSec: 1.88 },
    },
    0x02: {
      name: "drownDeath",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "the frog drowns/dies (driveFrogDeathAnimation queues 0x00 then 0x02 on the first death frame)",
      evidence: ["driveFrogDeathAnimation enqueueSoundCommand(m, 0x02) after zeroing the sound-sequence countdown", "recorder: cmd 0x02 audible 1.13s one-shot"],
      measured: { audible: true, kind: "oneshot", durationSec: 1.13 },
    },
    0x03: {
      name: "squashDeath",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "the frog is squashed by road traffic (driveFrogDeathAnimation queues 0x00 then 0x03 on the first squash frame)",
      evidence: ["driveFrogDeathAnimation enqueues 0x03 as the road-death jingle, distinct from 0x02 drown", "recorder: cmd 0x03 audible 1.02s one-shot"],
      measured: { audible: true, kind: "oneshot", durationSec: 1.02 },
    },
    0x04: {
      name: "hop",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "a fresh frog hop begins in any direction (animateFrogHop 0x1b8b/0x1be4/0x1c41/0x1ca0, HOP_SOUND)",
      evidence: ["animateFrogHop enqueues 0x04 on every hop-begin", "recorder: cmd 0x04 audible 0.28s one-shot"],
      measured: { audible: true, kind: "oneshot", durationSec: 0.28 },
    },
    0x05: {
      name: "countdownWarning",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "the score-display countdown warning (driveScoreDisplayCountdown 0x0870, SOUND_COUNTDOWN_WARNING)",
      evidence: ["driveScoreDisplayCountdown enqueues 0x05", "recorder: cmd 0x05 audible 1.09s one-shot"],
      measured: { audible: true, kind: "oneshot", durationSec: 1.09 },
    },
    0x06: {
      name: "countdownStart",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "the score-display countdown starts (driveScoreDisplayCountdown 0x0870, SOUND_COUNTDOWN_START, latched on first entry)",
      evidence: ["driveScoreDisplayCountdown enqueues 0x06 on the first countdown frame", "recorder: cmd 0x06 audible 2.33s one-shot"],
      measured: { audible: true, kind: "oneshot", durationSec: 2.33 },
    },
    0x07: {
      name: "extraLife",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "an extra life is awarded and its HUD tile is stamped (addScoreAndAwardExtraLife 0x08e0, TILE_UPDATE_CMD)",
      evidence: ["addScoreAndAwardExtraLife enqueues 0x07 as it flushes the HUD cell", "recorder: cmd 0x07 audible 1.13s one-shot"],
      measured: { audible: true, kind: "oneshot", durationSec: 1.13 },
    },
    0x08: {
      name: "homeFanfare",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "a non-final home bay is filled (stampHomeGoalAndResetFrog queues the 0x08/0x0e arrival-fanfare pair)",
      evidence: ["stampHomeGoalAndResetFrog enqueues 0x08 then 0x0e when a non-final bay fills", "recorder: cmd 0x08 audible 7.98s"],
      measured: { audible: true, kind: "oneshot", durationSec: 7.98 },
    },
    0x09: {
      name: "startJingleA",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "new-game start jingle, first of the 0x09/0x0a/0x0b sequence (drainForegroundThenYieldEachVblank)",
      evidence: ["drainForegroundThenYieldEachVblank enqueues 0x00,0x09,0x0a,0x0b at game start", "recorder: cmd 0x09 audible 6.82s"],
      measured: { audible: true, kind: "oneshot", durationSec: 6.82 },
    },
    0x0a: {
      name: "startJingleB",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "new-game start jingle, second of the 0x09/0x0a/0x0b sequence (drainForegroundThenYieldEachVblank)",
      evidence: ["drainForegroundThenYieldEachVblank enqueues 0x0a at game start", "recorder: cmd 0x0a audible 6.68s"],
      measured: { audible: true, kind: "oneshot", durationSec: 6.68 },
    },
    0x0b: {
      name: "startJingleC",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "new-game start jingle, third of the 0x09/0x0a/0x0b sequence (drainForegroundThenYieldEachVblank)",
      evidence: ["drainForegroundThenYieldEachVblank enqueues 0x0b at game start", "recorder: cmd 0x0b audible 6.68s"],
      measured: { audible: true, kind: "oneshot", durationSec: 6.68 },
    },
    0x0c: {
      name: "gameOverA",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "the game-over screen, first of the two-note jingle (runIntroTimerThenInitGame, after blitGameOverLine paints the banner)",
      evidence: ["runIntroTimerThenInitGame enqueues 0x0c then 0x0d as the game-over jingle", "recorder: cmd 0x0c audible 3.43s"],
      measured: { audible: true, kind: "oneshot", durationSec: 3.43 },
    },
    0x0d: {
      name: "gameOverB",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "the game-over screen, second of the two-note jingle (runIntroTimerThenInitGame)",
      evidence: ["runIntroTimerThenInitGame enqueues 0x0c then 0x0d as the game-over jingle", "recorder: cmd 0x0d audible 3.33s"],
      measured: { audible: true, kind: "oneshot", durationSec: 3.33 },
    },
    0x0e: {
      name: "homeFanfareTail",
      kind: "oneshot",
      source: "ay8910",
      confidence: "inferred",
      fires: "queued right after 0x08 as the second half of the home-fanfare pair (stampHomeGoalAndResetFrog)",
      evidence: ["stampHomeGoalAndResetFrog enqueues 0x08 then 0x0e", "recorder: cmd 0x0e context-dependent -- silent when driven alone"],
      measured: { audible: null, kind: "context-dependent", durationSec: 0 },
      conflict: "the second byte of the home-fanfare pair; a sequence tail whose sound depends on 0x08's AY-chip state, so isolation recording is not dispositive (audible marked null, not silently forced either way).",
    },
    0x0f: {
      name: "sequenceEnd",
      kind: "sustained",
      source: "ay8910",
      confidence: "confirmed",
      fires: "the active sound-sequence countdown drains to zero (serviceVblankNmi fires the 0x0f/0xb0 end-of-sequence pair)",
      evidence: ["serviceVblankNmi enqueues 0x0f then 0xb0 when SOUND_SEQUENCE_COUNTDOWN reaches 0", "recorder: cmd 0x0f audible, sustained past the 10s late-stop"],
      measured: { audible: true, kind: "sustained", durationSec: 10.0 },
    },
    0x10: {
      name: "boardAdvance",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "a board is cleared and advances, first of the queued pair (advanceBoardForeground 0x05f0)",
      evidence: ["advanceBoardForeground enqueues 0x10 then 0x30 as the board-cleared fanfare", "recorder: cmd 0x10 audible 5.80s"],
      measured: { audible: true, kind: "oneshot", durationSec: 5.80 },
    },
    0x18: {
      name: "flyEat",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "the frog catches the fly (animateFlyEatCollision 0x26a6, EAT_SOUND)",
      evidence: ["animateFlyEatCollision enqueues 0x18 on a latched catch", "recorder: cmd 0x18 audible 1.47s one-shot"],
      measured: { audible: true, kind: "oneshot", durationSec: 1.47 },
    },
    0x30: {
      name: "boardAdvanceTail",
      kind: "oneshot",
      source: "ay8910",
      confidence: "inferred",
      fires: "queued right after 0x10 as the board-cleared 'pair' (advanceBoardForeground 0x05f0)",
      evidence: ["advanceBoardForeground enqueues 0x10 then 0x30", "recorder: cmd 0x30 context-dependent -- silent in some isolation passes, audible in others"],
      measured: { audible: null, kind: "context-dependent", durationSec: 0 },
      conflict: "the second byte of the board-advance pair; the recorder measured it SILENT in some isolation passes and AUDIBLE in others, so it is a sequence tail whose sound depends on 0x10's AY-chip state -- audible marked null rather than picking a winner.",
    },
    0x80: {
      name: "restart",
      kind: "oneshot",
      source: "ay8910",
      confidence: "inferred",
      fires: "a new frog is placed at the start of a life (beginNextLifeOrIntro 0x0457, RESTART_SOUND)",
      evidence: ["beginNextLifeOrIntro enqueues 0x80 as the per-life restart jingle", "recorder: cmd 0x80 measured silent in isolation"],
      measured: { audible: false, kind: "silent", durationSec: 0 },
      conflict: "the routine names 0x80 the per-life restart jingle, but a high-bit byte driven alone plays nothing (Konami sound bytes >= 0x80 are commonly control/mode, not triggers). Whether it sounds given prior audio-CPU state is unresolved; no clip until a real life-restart is captured.",
    },
    0x90: {
      name: "spriteSpawn",
      kind: "sustained",
      source: "ay8910",
      confidence: "inferred",
      fires: "the first sprite-object spawn of a turn (raiseSpriteArmOneShotAndQueueSound 0x2ae6, one-shot per turn)",
      evidence: ["raiseSpriteArmOneShotAndQueueSound enqueues 0x90 once per turn", "recorder: cmd 0x90 audible, sustained past the 10s late-stop"],
      measured: { audible: true, kind: "sustained", durationSec: 10.0 },
      conflict: "audible in isolation but the ring drops 0x90 unless a game is in play (PLAY_FLAG gated), so it is rarely heard; recorded as sustained with no clean loop point, so the player plays it once, not looped.",
    },
    0xb0: {
      name: "sequenceEndTail",
      kind: "oneshot",
      source: "ay8910",
      confidence: "inferred",
      fires: "queued right after 0x0f as the second half of the end-of-sequence pair (serviceVblankNmi)",
      evidence: ["serviceVblankNmi enqueues 0x0f then 0xb0", "recorder: cmd 0xb0 context-dependent -- silent when driven alone"],
      measured: { audible: null, kind: "context-dependent", durationSec: 0 },
      conflict: "the second byte of the end-of-sequence pair; a high-bit tail whose sound depends on 0x0f's AY-chip state, so isolation recording is not dispositive (audible marked null).",
    },
    0xd0: {
      name: "laneScrollTile",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "the per-frame frog-on-log edge blit, queued on the sound ring in sync with lane scroll (enqueueLaneScrollSyncedCommand, BLIT_CMD)",
      evidence: ["enqueueLaneScrollSyncedCommand pushes 0xd0 onto the shared ring", "recorder: cmd 0xd0 audible 1.51s one-shot"],
      measured: { audible: true, kind: "oneshot", durationSec: 1.51 },
    },
    0xf0: {
      name: "homeArrival",
      kind: "oneshot",
      source: "ay8910",
      confidence: "confirmed",
      fires: "the frog reaches a home bay in a live game (stampHomeGoalAndResetFrog queues 0x00 then 0xf0 as the arrival jingle)",
      evidence: ["stampHomeGoalAndResetFrog enqueues 0xf0 after clearing the sound-sequence countdown", "recorder: cmd 0xf0 audible 0.27s one-shot"],
      measured: { audible: true, kind: "oneshot", durationSec: 0.27 },
    },
    0xff: {
      name: "unmute",
      kind: "control",
      source: "none",
      confidence: "confirmed",
      fires: "cold-boot unmute pulse, paired with the 0x00 mute pulse (initColdBootAndEnterMainLoop 0x02a3)",
      evidence: ["initColdBootAndEnterMainLoop issues command 0xff as the boot unmute pulse", "recorder: cmd 0xff measured silent"],
      measured: { audible: false, kind: "silent", durationSec: 0 },
    },
  },
};

export default SOUNDS;
