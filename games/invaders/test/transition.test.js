// SPDX-License-Identifier: GPL-3.0-only
//
// transition — invaders' standing whole-game gate for the FORCED transitions the coin/start/play tape
// never reaches (runbook §5): round/wave advance, life loss with reserves, and game over. A coin/start
// tape settles a live 1-player round; at FORCE_AT it pokes the ROM's REAL trigger (an empty alien field,
// or the record-0 ship death-animation drain) and lets the loop/object-walker drive through it. Each case
// asserts the transition FIRED (the teeth) — a run that never reached play fails, never vacuously passes.
// IDIOMATIC-ONLY (no oracle byte-compare): invaders is model-(b) — the vblank ISR tail-dispatches game
// logic with FRAME_DELAY_TIMER draw-waits, so the oracle deadlocks under runCycleFree (see tape.test.js).
// Byte-exact gameplay-vs-MAME correctness lives in the pixel --done gate + mechanics_gate. ROM-guarded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import manifest from "../manifest.js";
import {
  GAME_ACTIVE, GAME_IN_PROGRESS, ALIEN_COUNT, ACTIVE_PLAYER_PAGE,
  GAME_OBJECT_TABLE, loc_2011, PLAYER_SHIP_DRAW_PENDING, loc_2015, WARM_RESTART_SUPPRESS,
  PLAYER_SHIP_HANDLER_ADDR,
} from "../idiomatic/names.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROM_PATH = join(HERE, "..", "rom", "maincpu.bin");
const HAVE_ROM = existsSync(ROM_PATH);
const ROM = HAVE_ROM ? new Uint8Array(readFileSync(ROM_PATH)) : null;

const PLAY_ACTIVE = 1;   // GAME_ACTIVE (0x20e9) is raised the frame the round's main loop takes over (~f537)
const FORCE_AT = 560;    // a settled in-play frame: GAME_ACTIVE + GAME_IN_PROGRESS set, the alien field live
const FRAMES = 720;      // past the force: round-advance completes ~f609 (48-frame arm wait + reseed), and
                         //   game-over's GAME_ACTIVE stays cleared to the end (attract re-arms it much later)
const FIELD_CELLS = 0x37; // the active player's 0x37-byte alien-status field (base = page << 8)
const { idiomatic } = manifest.convergence;
const { nmiReturnPC } = idiomatic;

const A = manifest.inputs.actions;
// Minimal tape: a coin banks a credit, start-1 launches a one-player game. That alone settles a live round
// (the round-start splash runs to ~f537, then the main loop takes over) — no fire/move needed for the force.
function tapeInput(f) {
  const a = {};
  const press = (act) => { a[act.port] = (a[act.port] || 0) | act.bit; };
  if (f >= 300 && f < 306) press(A.coin);
  if (f >= 360 && f < 366) press(A.start1);
  return a;
}

// The active player's page cells, as the ROM addresses them: the alien-status field at page<<8, the round
// counter at page:0xfe, and the reserve-ship count at page:0xff (readActivePlayerPageTopByte's cell).
const fieldBase = (m) => m.mem.read8(ACTIVE_PLAYER_PAGE) << 8;
const roundCounterAddr = (m) => (m.mem.read8(ACTIVE_PLAYER_PAGE) << 8) | 0xfe;
const reserveCountAddr = (m) => (m.mem.read8(ACTIVE_PLAYER_PAGE) << 8) | 0xff;

// Drive the coin/start tape through the idiomatic engine, applying forcePoke pre-NMI at FORCE_AT (once the
// game is a live 1-player round). Captures the pre-force witness values and post-force observations, then
// returns the machine + witness for the per-case teeth.
async function drive(forcePoke) {
  const w = {
    forced: false, sawPlay: false,
    gaAtForce: null, resvAtForce: null, rndAtForce: null, alnAtForce: null,
    sawAlnZeroAfter: false, sawGaClearAfter: false,
  };
  const overrides = await resolveAllIdiomatic();
  const m = new Machine(ROM, { overrides });
  const r = runIdiomaticGame(m, {
    bootAddr: 0x0000, nmiReturnPC, maxFrames: FRAMES,
    onFrame: (mm, f) => {
      if (f === 0) return; // power-on sample, before the boot generator runs
      mm.io.inputAssert = tapeInput(f);
      if (mm.mem.read8(GAME_ACTIVE) === PLAY_ACTIVE) w.sawPlay = true;
      if (f === FORCE_AT && mm.mem.read8(GAME_ACTIVE) === PLAY_ACTIVE) {
        w.gaAtForce = mm.mem.read8(GAME_ACTIVE);
        w.resvAtForce = mm.mem.read8(reserveCountAddr(mm));
        w.rndAtForce = mm.mem.read8(roundCounterAddr(mm));
        w.alnAtForce = mm.mem.read8(ALIEN_COUNT);
        forcePoke(mm);
        w.forced = true;
      }
      if (f > FORCE_AT) {
        if (mm.mem.read8(ALIEN_COUNT) === 0) w.sawAlnZeroAfter = true;
        if (mm.mem.read8(GAME_ACTIVE) === 0) w.sawGaClearAfter = true;
      }
    },
  });
  assert.equal(r.stopError, null, `idiomatic run errored: ${r.stop}`);
  return { m, w };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// CASE 1 — ROUND / WAVE ADVANCE. mainLoop runs countLiveAliens (republishes ALIEN_COUNT from the field)
// then, on ALIEN_COUNT===0, advanceToNextRound. So the genuine trigger is an EMPTY FIELD, not a raw
// ALIEN_COUNT poke (countLiveAliens would overwrite it). advanceToNextRound bumps the round counter
// (page:0xfe, masked 0x07) and reseeds a fresh fleet (ALIEN_COUNT returns nonzero).
function forceRoundAdvance(m) {
  const base = fieldBase(m);
  for (let i = 0; i < FIELD_CELLS; i++) m.mem.write8(base + i, 0x00);
}

test("round/wave advance: the round counter bumps and a fresh fleet reseeds", { skip: !HAVE_ROM }, async () => {
  const { m, w } = await drive(forceRoundAdvance);

  // The force actually landed on a live round.
  assert.ok(w.sawPlay, "the tape never reached a live round (GAME_ACTIVE never set)");
  assert.ok(w.forced, "the round-advance force never fired (game was not in play at FORCE_AT)");
  assert.equal(w.alnAtForce, FIELD_CELLS, `the fleet was not full at the force (ALIEN_COUNT ${w.alnAtForce})`);

  // TEETH: the empty field WAS observed (countLiveAliens saw 0) and drove advanceToNextRound...
  assert.ok(w.sawAlnZeroAfter, "ALIEN_COUNT never reached 0 — the empty-field board-clear condition never took");
  // ...which bumped the round counter past its value at the force, and re-seeded a fresh (nonzero) fleet.
  const endRnd = m.mem.read8(roundCounterAddr(m));
  const endAln = m.mem.read8(ALIEN_COUNT);
  assert.ok(endRnd > w.rndAtForce, `the round counter did not advance (${w.rndAtForce} -> ${endRnd})`);
  assert.notEqual(endAln, 0, "a fresh fleet was not seeded (ALIEN_COUNT stayed 0 after the advance)");
  // The game stayed live through the same-player wave handoff (not game over).
  assert.equal(m.mem.read8(GAME_ACTIVE), PLAY_ACTIVE, "the game left play across the wave advance (GAME_ACTIVE cleared)");
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Seat record-0 (base GAME_OBJECT_TABLE) so the next NMI dispatches playerShipHandler AT its death
// drain-complete step: frame timer (rec+0/1) + gate (rec+2) zero to dispatch now, target 0x028e, animByte
// (rec+5) != 0xff (death anim, not the alive sentinel), inner (rec+6)=outer (rec+7)=1 so one pass drains
// the animation -> the ROM consumes the life and arms the next flow. WARM_RESTART_SUPPRESS (warm-restart suppress) clear.
const REC = GAME_OBJECT_TABLE;           // 0x2010, record-0 base
const REC_TARGET_LO = REC + 3;           // 0x2013 handler-target low byte
const REC_TARGET_HI = REC + 4;           // 0x2014 handler-target high byte (also the recPtr the handler gets)
const REC_INNER = REC + 6;               // 0x2016 inner frame timer
const REC_OUTER = REC + 7;               // 0x2017 outer animation counter
function seatShipDeathDrain(m) {
  m.mem.write8(REC, 0x00);               // frame-timer hi = 0
  m.mem.write8(loc_2011, 0x00);          // frame-timer lo (rec+1) = 0  -> timer drained, dispatch this NMI
  m.mem.write8(PLAYER_SHIP_DRAW_PENDING, 0x00);          // gate byte (rec+2) = 0        -> dispatch the handler now
  m.mem.write8(REC_TARGET_LO, PLAYER_SHIP_HANDLER_ADDR & 0xff);   // 0x8e
  m.mem.write8(REC_TARGET_HI, (PLAYER_SHIP_HANDLER_ADDR >> 8) & 0xff); // 0x02  -> target 0x028e (player ship)
  m.mem.write8(loc_2015, 0x00);          // animByte (rec+5) != 0xff     -> death animation (not alive/armed)
  m.mem.write8(REC_INNER, 0x01);         // inner timer -> decrements to 0 this pass
  m.mem.write8(REC_OUTER, 0x01);         // outer counter -> decrements to 0 -> animation done, life consumed
  m.mem.write8(WARM_RESTART_SUPPRESS, 0x00);          // warm-restart suppress off
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// CASE 2 — LIFE LOSS WITH RESERVES REMAINING. On the death drain the handler clears GAME_ACTIVE, reads the
// reserve count at page:0xff, and — with reserves left in a one-player game — arms doJFlow, which
// decrementShipsAndDrawReadout (reserve count -1) then re-enters the round (setGameActive raises GAME_ACTIVE
// again): the player respawns, the game continues (NOT game over). We seat reserves at 2 so the drop is
// non-vacuous, then let the flow drive the respawn.
function forceLifeLoss(m) {
  m.mem.write8(reserveCountAddr(m), 0x02); // two reserves -> a life loss, not the last life
  seatShipDeathDrain(m);
}

test("life loss (reserves remain): the reserve count drops by one and the game continues", { skip: !HAVE_ROM }, async () => {
  const { m, w } = await drive(forceLifeLoss);

  assert.ok(w.sawPlay, "the tape never reached a live round (GAME_ACTIVE never set)");
  assert.ok(w.forced, "the life-loss force never fired (game was not in play at FORCE_AT)");
  // Reserves and the live flag were set going in, or the assertions below would be vacuous.
  assert.equal(w.gaAtForce, PLAY_ACTIVE, "GAME_ACTIVE was not set at the force — the run was not live");
  assert.ok(w.resvAtForce >= 2, `no reserves to spare at the force (${w.resvAtForce})`);

  // TEETH: the life was consumed — the reserve count dropped by exactly one...
  const endResv = m.mem.read8(reserveCountAddr(m));
  assert.equal(endResv, w.resvAtForce - 1, `the reserve count did not drop by one (${w.resvAtForce} -> ${endResv})`);
  // ...and it was a RESPAWN, not a teardown: the game stayed live (GAME_ACTIVE re-raised, GAME_IN_PROGRESS held).
  assert.equal(m.mem.read8(GAME_ACTIVE), PLAY_ACTIVE, "the game went to game over — GAME_ACTIVE stayed cleared on a life loss with reserves left");
  assert.notEqual(m.mem.read8(GAME_IN_PROGRESS), 0, "GAME_IN_PROGRESS cleared — a respawn must keep the game in progress");
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// CASE 3 — GAME OVER (LAST LIFE). Same death drain, but with NO reserves: the handler reads page:0xff as 0
// and arms gameOverFlow instead. The drain's clearGameActive drops GAME_ACTIVE 1->0 and gameOverFlow does
// not re-raise it (it hands off to the attract teardown), so the game ends and the engine falls back to
// attract. We seat reserves at 0 and assert GAME_ACTIVE clears.
function forceGameOver(m) {
  m.mem.write8(reserveCountAddr(m), 0x00); // last life -> the death arms gameOverFlow
  seatShipDeathDrain(m);
}

test("game over (last life): GAME_ACTIVE clears and the game ends", { skip: !HAVE_ROM }, async () => {
  const { m, w } = await drive(forceGameOver);

  assert.ok(w.sawPlay, "the tape never reached a live round (GAME_ACTIVE never set)");
  assert.ok(w.forced, "the game-over force never fired (game was not in play at FORCE_AT)");
  // The flag was set going in, or "cleared" would be vacuous.
  assert.equal(w.gaAtForce, PLAY_ACTIVE, "GAME_ACTIVE was not set at the force — the run was not live");

  // TEETH: the teardown FIRED — GAME_ACTIVE cleared 1->0 and stayed clear (the game ended, back to attract).
  assert.ok(w.sawGaClearAfter, "GAME_ACTIVE never cleared after the force — the game-over teardown never ran");
  assert.equal(m.mem.read8(GAME_ACTIVE), 0, `GAME_ACTIVE did not clear (still ${m.mem.read8(GAME_ACTIVE)})`);
});
