// SPDX-License-Identifier: GPL-3.0-only

/** drainForegroundThenYieldEachVblank — the foreground main loop as the vblank coroutine.
 *
 * The foreground free-runs several times a frame, paced only by a busy-delay that writes no state;
 * all per-frame accumulation is in the NMI. So it is a per-frame fixed point (verified full-RAM,
 * 700+ frames). This generator drops the busy-delay, drains the body to that fixed point (two passes;
 * the second only settles the life-restart cascade), then yields for the engine to fire the NMI.
 * `entry` threads the head/tail re-entry across passes; the NMI and leaf tree are reached via m.call. */

import {
  GAME_MODE, PLAY_FLAG, START_LATCH, CREDIT_BCD, IN1_PORT, MAIN_LOOP_HEAD, PACE_TAIL,
} from "./names.js";

// Leaf routines the body drives, each reached via m.call.
const ATTRACT_DISPATCH = 0x0d11;   // mode>=2 attract/mode dispatcher (call nc)
const SERVICE_A = 0x0b1f;
const SERVICE_B = 0x0b67;           // skipped when mode==1 (call nz)
const SERVICE_C = 0x230f;
const IN_PLAY_TREE = 0x040b;        // board-start / life-loss dispatcher — the whole in-play family
const NEW_GAME_HUD = 0x0b0a;
const NEW_GAME_BOARD = 0x07d9;
const ENQUEUE_SOUND = 0x0018;       // rst 0x18
const CLEAR_TILEMAP = 0x0038;       // rst 0x38
const NEW_GAME_SEED_D = 0x07e6, NEW_GAME_SEED_E = 0x223d;

export function* drainForegroundThenYieldEachVblank(m) {
  let entry = MAIN_LOOP_HEAD;
  for (;;) {
    entry = runOneForegroundPass(m, entry);
    entry = runOneForegroundPass(m, entry);
    yield;
  }
}

// Run one foreground pass from `entry`, returning the entry the NEXT pass takes. Exported so the
// go-live byte-exact harness can drive it from a golden anchor to isolate the model from boot.
export function runOneForegroundPass(m, entry) {
  const { regs, mem } = m;

  if (entry === MAIN_LOOP_HEAD) {
    regs.a = mem.read8(GAME_MODE);
    regs.cp(0x02);
    if (regs.fNC) { m.push16(0x0349); m.call(ATTRACT_DISPATCH); }
    m.push16(0x034c); m.call(SERVICE_A);
    regs.a = mem.read8(GAME_MODE);
    regs.a = regs.dec8(regs.a);
    if (regs.fNZ) { m.push16(0x0353); m.call(SERVICE_B); }
    m.push16(0x0356); m.call(SERVICE_C);
    mem.write8(0x8254, 0x02); mem.write8(0x8255, 0x02);
    mem.write8(0x8256, 0x09); mem.write8(0x8257, 0x09);
    mem.write8(0x8258, 0x09); mem.write8(0x8259, 0x09);
  }

  // pace tail — the busy-delay is skipped: it writes no state.
  regs.a = mem.read8(PLAY_FLAG);
  regs.or(regs.a);
  if (regs.fNZ) {
    m.call(IN_PLAY_TREE); // runs one in-play pass; it returns here, so the frame yields next
    return PACE_TAIL;     // in-play stays at the tail, skipping the head
  }

  regs.a = mem.read8(START_LATCH);
  regs.or(regs.a);
  if (regs.fNZ) return MAIN_LOOP_HEAD;

  regs.a = mem.read8(IN1_PORT);
  regs.rlca(); // C = old bit 7 (START1)
  let players;
  if (regs.fNC) {
    players = 0x01;
  } else {
    regs.rlca(); // C = old bit 6 (START2)
    if (regs.fC) return MAIN_LOOP_HEAD;
    players = 0x02;
  }

  regs.a = mem.read8(CREDIT_BCD);
  regs.c = players;
  regs.cp(regs.c);
  if (regs.fC) return MAIN_LOOP_HEAD;

  startNewGame(m, players);
  m.call(IN_PLAY_TREE);
  return PACE_TAIL;
}

// The one-time new-game setup: deduct the credit, clear the play RAM, seed game state.
function startNewGame(m, players) {
  const { regs, mem } = m;

  regs.a = mem.read8(CREDIT_BCD);
  regs.c = players;
  regs.sub(regs.c); regs.daa();
  mem.write8(CREDIT_BCD, regs.a);
  regs.a = regs.c;
  mem.write8(0x8370, regs.a);

  regs.hl = 0x8500; regs.de = 0x8501; regs.bc = 0x01ff;
  mem.write8(regs.hl, regs.l);
  m.ldirAt(0x03a5, 0x03a7); // clear the play RAM

  mem.write8(PLAY_FLAG, regs.a); // = player count: a game is now in progress
  regs.a = 0x01;
  mem.write8(0x83fd, regs.a);
  mem.write8(START_LATCH, regs.a);
  regs.h = regs.a; regs.l = regs.a;
  mem.write8(0x83b7, regs.a);
  mem.write16(0x83b8, regs.hl);

  m.push16(0x03bd); m.call(NEW_GAME_HUD);
  regs.a = 0x03;
  mem.write8(0x803d, regs.a);
  m.push16(0x03c5); m.call(NEW_GAME_BOARD);
  regs.xor(regs.a);
  mem.write8(0x8071, regs.a);

  m.push16(0x03ca); m.call(ENQUEUE_SOUND); // A=0
  regs.a = 0x09; m.push16(0x03cd); m.call(ENQUEUE_SOUND);
  regs.a = 0x0a; m.push16(0x03d0); m.call(ENQUEUE_SOUND);
  regs.a = 0x0b; m.push16(0x03d3); m.call(ENQUEUE_SOUND);

  regs.hl = 0x0020; mem.write16(0x829d, regs.hl);
  regs.hl = 0x01a0; mem.write16(0x8382, regs.hl);
  regs.hl = 0x0000; mem.write16(0x83d2, regs.hl);

  m.push16(0x03e8); m.call(NEW_GAME_SEED_D);
  m.push16(0x03e9); m.call(CLEAR_TILEMAP);
  m.push16(0x03ec); m.call(NEW_GAME_SEED_E);

  regs.xor(regs.a);
  regs.h = regs.a; regs.l = regs.a;
  mem.write8(0x842f, regs.a);
  mem.write8(0x842d, regs.a);
  mem.write16(0x8293, regs.hl);

  regs.hl = 0x8440; regs.de = 0x8441; regs.bc = 0x004f;
  mem.write8(regs.hl, regs.b);
  m.ldirAt(0x0402, 0x0404); // clear a second play-RAM block

  mem.write8(0x8004, regs.a);
  regs.a = regs.inc8(regs.a);
  mem.write8(0x825a, regs.a);
}
