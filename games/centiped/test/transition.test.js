// SPDX-License-Identifier: GPL-3.0-only
//
// transition — centiped's whole-game gate for the FORCED transitions the coin/start/play tape can't reach
// (runbook §5): a coin/start tape settles a live 1P round, then each case POKES the ROM's real trigger (the
// death/respawn interval machine advanceDeathRespawnSequence, ROM 0x23da, paced by $87) and asserts the
// transition FIRED (teeth) with a pre-force witness (never a vacuous pass).
//   CASE 1 BOARD RECYCLE — the "last object cleared" branch steps the round/life counter $86 and reseeds.
//   CASE 2 DEATH/RESPAWN — the "dying glyph" branch consumes the death flag $d6 and reseeds the shot cell $72.
// Scope: centiped has no clean single-cell lives counter or attract-return in the shipped idiomatic layer
// ($86 is a WRAPPING round/life counter — a recycle steps it 0->0xff and play continues), so life-loss-with-
// reserves / game-over-to-attract are not force-isolable; convergence.mjs is the gameplay-vs-MAME oracle. ROM-guarded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import { runIdiomaticIrqGame } from "../../../core/frame-stepped.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROM_PATH = join(HERE, "..", "rom", "maincpu.bin");
const GFX_PATH = join(HERE, "..", "rom", "gfx1.bin");
const HAVE_ROM = existsSync(ROM_PATH) && existsSync(GFX_PATH);
const ROM = HAVE_ROM ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const GFX = HAVE_ROM ? new Uint8Array(readFileSync(GFX_PATH)) : null;

const IRQ_VBLANK = [0, 0, 0, 1];
const FORCE_AT = 520; // a settled in-play frame ($89==1, $86 bit7 clear)
const FRAMES = 650;
const hex = (v) => `0x${(v & 0xff).toString(16).padStart(2, "0")}`;

// Grounded cells (see tape.test.js / the DONE report).
const PLAYER_ACTIVE = 0x89; // 1 == a live 1-player game
const GAME_STATE = 0x86;    // round/life counter; 0 in a fresh live round, bit7 set once it has wrapped
const DEATH_TIMER = 0x87;   // death-respawn interval counter; a branch fires the frame it ticks to 0
const FIELD_SCAN_HI = 0xdb; // nonzero pauses the death-respawn sequence
const DYING_GLYPH = 0xd6;   // "a glyph is dying and must be erased" flag (P1)
const STATE_MASK = 0x43;    // $43 & 0xaf must be nonzero to skip the P2 sprite-rebuild fall-through
const OBJ_A = 0xa5, OBJ_B = 0xa6; // both idle ($a5|$a6==0) selects the P4 board-recycle branch
const SHOT_CELL = 0x72;     // reseeded to 0x0c by seedPlayerShotStartCells during the death sequence
const SHOT_SEED = 0x0c;

// coin @300..309, 1P start @380..389 — that alone settles a live 1-player round by ~frame 420.
function tapeInput(f) {
  if (f >= 300 && f < 310) return 0x20;
  if (f >= 380 && f < 390) return 0x01;
  return 0;
}

// Drive the settle tape, apply forcePoke once at FORCE_AT (only while in play), capture pre/post witnesses.
async function drive(forcePoke) {
  const overrides = await resolveAllIdiomatic();
  const m = new Machine(ROM, { gfx1: GFX, overrides });
  const w = { sawPlay: false, forced: false, pre: null, post: null };
  runIdiomaticIrqGame(m, {
    bootAddr: 0x3b04, irqVblank: IRQ_VBLANK, maxFrames: FRAMES,
    onFrame: (mm, f) => {
      if (f === 0) return;
      const bits = tapeInput(f);
      mm.io.inputAssert = bits ? { 1: bits } : {};
      if (mm.mem.read8(PLAYER_ACTIVE) === 1) w.sawPlay = true;
      if (f === FORCE_AT && mm.mem.read8(PLAYER_ACTIVE) === 1) {
        w.pre = forcePoke(mm); // forcePoke seats its trigger and returns the pre-force witness
        w.forced = true;
      }
      // Capture the post-witness the frame AFTER the poke, while the effect is still discriminating:
      // some cells (e.g. the shot cell) relax back to their seed during play, so end-of-run is vacuous.
      if (f === FORCE_AT + 1 && w.forced && !w.post) {
        w.post = {
          shot: mm.mem.read8(SHOT_CELL), flag: mm.mem.read8(DYING_GLYPH),
          state: mm.mem.read8(GAME_STATE), player: mm.mem.read8(PLAYER_ACTIVE),
        };
      }
    },
  });
  return { m, w, R: (a) => m.mem.read8(a) };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// CASE 1 — BOARD RECYCLE. advanceDeathRespawnSequence's "both object cells idle" branch (ROM 0x23da,
// Priority 4) fires when the interval $87 ticks to 0 this frame, the sequence is not paused ($db==0), the
// quick P1/P2/P3 exits are skipped ($d6==0; $43&0xaf!=0; $86 bit7 clear), and no object remains
// ($a5|$a6==0). It DECREMENTS the round/life counter $86 and reseeds a fresh board. Arm exactly that.
function armBoardRecycle(m) {
  const pre = m.mem.read8(GAME_STATE);
  m.mem.write8(DEATH_TIMER, 0x01);  // ticks to 0 this frame -> a branch fires
  m.mem.write8(FIELD_SCAN_HI, 0x00); // not paused
  m.mem.write8(DYING_GLYPH, 0x00);   // skip P1
  m.mem.write8(STATE_MASK, 0x01);    // $43 & 0xaf != 0 -> skip the P2 fall-through
  m.mem.write8(OBJ_A, 0x00);         // both objects idle -> Priority 4 (board recycle)
  m.mem.write8(OBJ_B, 0x00);
  return { state: pre };
}

test("board recycle: the last-object-cleared branch steps the round/life counter and reseeds", { skip: !HAVE_ROM }, async () => {
  const { w, R } = await drive(armBoardRecycle);
  assert.ok(w.sawPlay, "the tape never reached a live 1-player round ($89 never became 1)");
  assert.ok(w.forced, "the board-recycle force never fired (not in play at FORCE_AT)");
  // Non-vacuity: the round counter had bit7 CLEAR going in, so the decrement is the real P4 branch.
  assert.ok((w.pre.state & 0x80) === 0, `round counter already wrapped at the force ($86=${hex(w.pre.state)})`);
  // TEETH: the round/life counter stepped down by exactly one (0x00 -> 0xff on the first recycle).
  const post = R(GAME_STATE);
  assert.equal(post, (w.pre.state - 1) & 0xff, `the round/life counter did not step ($86 ${hex(w.pre.state)} -> ${hex(post)})`);
  // The game stayed live across the recycle (a board recycle is not a game-over).
  assert.equal(R(PLAYER_ACTIVE), 1, "the game left the 1-player state across the board recycle");
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// CASE 2 — DEATH/RESPAWN SEQUENCE. advanceDeathRespawnSequence's Priority-1 branch fires when $87 ticks to
// 0 with the "dying glyph" flag $d6 set (and $db==0): it erases the flagged cell, CLEARS $d6, and reseeds
// the player's shot start cells (seedPlayerShotStartCells writes $72 = 0x0c). We dirty $72 first so the
// reseed is observable, then arm the branch.
function armDeathRespawn(m) {
  m.mem.write8(SHOT_CELL, 0x99);    // dirty the shot start cell so the reseed is visible
  m.mem.write8(DEATH_TIMER, 0x01);  // ticks to 0 this frame
  m.mem.write8(FIELD_SCAN_HI, 0x00); // not paused
  m.mem.write8(DYING_GLYPH, 0xf9);   // P1: a dying glyph is flagged
  return { shot: m.mem.read8(SHOT_CELL), flag: m.mem.read8(DYING_GLYPH) };
}

test("death/respawn sequence: the dying-glyph branch clears its flag and reseeds the player shot", { skip: !HAVE_ROM }, async () => {
  const { w, R } = await drive(armDeathRespawn);
  assert.ok(w.sawPlay, "the tape never reached a live 1-player round ($89 never became 1)");
  assert.ok(w.forced, "the death/respawn force never fired (not in play at FORCE_AT)");
  // Non-vacuity: going in, the flag was set and the shot cell was dirtied off its seed.
  assert.equal(w.pre.flag, 0xf9, "the dying-glyph flag did not take at the force");
  assert.notEqual(w.pre.shot, SHOT_SEED, "the shot cell was not dirtied at the force — the reseed would be vacuous");
  // TEETH (measured the frame AFTER the poke, before the shot cell relaxes back to its seed naturally):
  // the branch consumed the dying-glyph flag ...
  assert.equal(w.post.flag, 0x00, `the dying-glyph flag was not consumed ($d6=${hex(w.post.flag)})`);
  // ... and reseeded the player shot start cell to its 0x0c seed.
  assert.equal(w.post.shot, SHOT_SEED, `the death sequence did not reseed the shot cell ($72=${hex(w.post.shot)})`);
  // The game stayed live across the death-sequence stage.
  assert.equal(w.post.player, 1, "the game left the 1-player state across the death/respawn stage");
});
