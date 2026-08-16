// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceVblankNmi — the vblank NMI handler: one frame of interrupt service. On hardware it saves all
 * registers, acks the NMI, scans coins, blits the sprite shadow into OBJRAM with a nibble-swap, ticks the
 * coin-counter pulse timers, then runs a dispatch tree on the play/mode flags that drives the attract
 * sequencer, the in-play sub-engines, the object/sound updaters and the board-complete reveal, before
 * restoring registers and returning.
 *
 * This layer does NOT model the register save/restore (those registers are dead to it) nor the final
 * interrupt return (memory-inert): the observable live-out is memory only. The four arms that are still
 * frozen (the attract sequencer, the in-play update, the death/hop driver, the collision orchestrator)
 * stay as calls; each reads a memory gate first, so none needs an incoming register. LIVE-OUT: memory-only.
 */
import { PLAY_FLAG, GAME_MODE, ACTIVE_PLAYER, IN2_PORT } from "./names.js";
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

const NMI_ENABLE = 0xb808;   // NMI enable latch (io): 0 acks, 1 re-enables
const ATTRACT_SEQ = 0x0e7a;
const IN_PLAY_UPDATE = 0x2341;
const DEATH_DRIVER = 0x16f8;
const COLLISION_ORCH = 0x1a55;

const swapNibbles = (v) => ((v >> 4) | (v << 4)) & 0xff;

export function serviceVblankNmi(m) {
  const { regs, mem } = m;

  mem.write8(NMI_ENABLE, 0); // ack; the register save + watchdog read are dead here
  scanCoinInputAndCredit(m);

  blitSpriteShadow(m);

  // Coin-counter pulse timers: tick each while set, clearing the io pulse when it drains.
  if (mem.read8(0x837f) !== 0) {
    const v = (mem.read8(0x837f) - 1) & 0xff;
    mem.write8(0x837f, v);
    if (v === 0) mem.write8(0xb81c, 0); // io
  }
  if (mem.read8(0x837e) !== 0) {
    const v = (mem.read8(0x837e) - 1) & 0xff;
    mem.write8(0x837e, v);
    if (v === 0) mem.write8(0xb818, 0); // io
  }

  return b_00ce();

  // Cocktail-mirror the frog X/Y sprite by +2 when a 2-player game is in play.
  function b_00ce() {
    if ((mem.read8(IN2_PORT) & 0x08) !== 0 &&
        mem.read8(PLAY_FLAG) !== 0 &&
        mem.read8(ACTIVE_PLAYER) !== 0 &&
        mem.read8(ACTIVE_PLAYER) !== 1) {
      mem.write8(0xb043, (mem.read8(0x8043) + 2) & 0xff);
      mem.write8(0xb047, (mem.read8(0x8047) + 2) & 0xff);
    }
    return b_00fc();
  }

  function b_00fc() {
    if (mem.read8(PLAY_FLAG) === 0) return b_0122();
    dequeueSoundCommand(m);
    if (mem.read8(0x83ea) === 0) return epilogue();
    const w = mem.read16(0x83d2);
    if (w === 0) return b_0171();
    mem.write16(0x83d2, (w - 1) & 0xffff);
    moveLaneObjectsAndCarryFrog(m);
    advanceAnimationFrameBuffer(m);
    return epilogue();
  }

  function b_0122() {
    if (mem.read8(GAME_MODE) >= 2) return b_0158();
    if (mem.read8(GAME_MODE) === 0) { m.push16(0x012e); m.call(ATTRACT_SEQ); } // kept: attract sequencer
    m.push16(0x0131); m.call(IN_PLAY_UPDATE); // kept: in-play update
    mem.write8(0x83cd, 0);
    mem.write8(0x83cf, 0);
    mem.write8(0x83b5, 0);
    mem.write16(0x8293, 0);
    for (let a = 0x825c; a <= 0x8267; a++) mem.write8(a, 0);
    mem.write8(0x83af, 0x80);
    mem.write8(0x83b0, 0);
    mem.write8(0x83b1, 0);
    return epilogue();
  }

  function b_0158() {
    if (mem.read8(0x83d8) === 0) return epilogue();
    mem.write8(0x83d8, (mem.read8(0x83d8) - 1) & 0xff);
    if (mem.read8(0x83d8) !== 0) return epilogue();
    if (mem.read8(0x83d7) !== 0) return epilogue();
    mem.write8(GAME_MODE, (mem.read8(GAME_MODE) - 1) & 0xff);
    return epilogue();
  }

  function b_0171() {
    const w = mem.read16(0x8382);
    if (w === 0) return b_018a();
    const dec = (w - 1) & 0xffff;
    mem.write16(0x8382, dec);
    if (dec !== 0) return b_018a();
    regs.a = 0x0f; enqueueSoundCommand(m);
    regs.a = 0xb0; enqueueSoundCommand(m);
    mem.write8(0x8371, 0);
    return b_018a();
  }

  function b_018a() {
    if (((mem.read8(ACTIVE_PLAYER) - 1) & 0xff) !== 0) return b_0274();
    if (mem.read8(0x825c) === 0x05) return b_025e();
    return b_0199();
  }

  function b_0199() {
    if (mem.read8(0x8298) === 0) return b_01a6();
    mem.write8(0x8298, (mem.read8(0x8298) - 1) & 0xff);
    return b_01e2();
  }

  function b_01a6() {
    if (mem.read8(0x8297) !== 0) return b_0257();
    if (mem.read16(0x829d) !== 0) return b_01e2();
    driveScoreDisplayCountdown(m);
    m.push16(0x01ba); m.call(COLLISION_ORCH); // kept: collision orchestrator
    if (mem.read8(0x83b5) !== 0) return b_01e2();
    mem.write8(0x83b5, 1);
    mem.write8(0x8384, 0xff);
    if (mem.read8(0x8380) === 0) return b_01e2();
    mem.write8(0x8380, 0);
    mem.write16(0x8382, 0x0040);
    regs.de = 0x2f7b; regs.hl = 0xaa51; regs.b = 0x07;
    copyRunUpTileColumn(m);
    return b_01e2();
  }

  function b_01e2() {
    if (mem.read8(0x8384) === 0) return b_01f2();
    const d = (mem.read8(0x8384) - 1) & 0xff;
    mem.write8(0x8384, d);
    if (d === 0) { regs.hl = 0xa850; blitFourTileGroupColumn(m); }
    return b_01f2();
  }

  function b_01f2() {
    advanceScrollLaneObjects(m);
    advanceAnimationFrameBuffer(m);
    if (mem.read8(0x8107) !== 0) mem.write8(0x8109, (mem.read8(0x8109) - 1) & 0xff);
    return b_0205();
  }

  function b_0205() {
    if (mem.read8(0x8108) !== 0) mem.write8(0x8124, (mem.read8(0x8124) - 1) & 0xff);
    return b_0212();
  }

  function b_0212() {
    dispatchFrogMoveAgainstLanes(m);
    if (mem.read8(0x8107) !== 0) mem.write8(0x8109, (mem.read8(0x8109) + 1) & 0xff);
    return b_0222();
  }

  function b_0222() {
    if (mem.read8(0x8108) !== 0) mem.write8(0x8124, (mem.read8(0x8124) + 1) & 0xff);
    return b_022f();
  }

  function b_022f() {
    m.push16(0x0232); m.call(DEATH_DRIVER); // kept: death/hop driver
    moveLaneObjectsAndCarryFrog(m);
    driveSpriteObjectCluster(m);
    tickGatedCountdown(m);
    loc_0292(m);
    const sel = mem.read8(0x8297);
    if (sel !== 0) { regs.a = sel; stampHomeBayFrogByColumn(m); }
    return epilogue();
  }

  function b_0257() {
    mem.write8(0x8297, (mem.read8(0x8297) - 1) & 0xff);
    return b_01e2();
  }

  function b_025e() {
    for (let a = 0x825e; a <= 0x8262; a++) mem.write8(a, 0);
    mem.write8(0x825c, 0);
    loc_05d3(m);
    return epilogue();
  }

  function b_0274() {
    if (mem.read8(0x825d) !== 0x05) return b_0199();
    for (let a = 0x8263; a <= 0x8267; a++) mem.write8(a, 0);
    mem.write8(0x825d, 0);
    loc_05d3(m);
    return epilogue();
  }

  // Restore registers (dead here) and re-enable the NMI, then return -- memory-inert; only the latch write.
  function epilogue() {
    mem.write8(NMI_ENABLE, 1); // io
  }
}

// Sprite DMA blit: copy the work-RAM sprite shadow into OBJRAM. A fixed lead byte straight, then 28 pairs
// (even byte nibble-swapped, odd byte straight), then a second region whose start/length a state cell
// gates: pass count of (1 swapped byte + 3 straight bytes).
function blitSpriteShadow(m) {
  const { mem } = m;
  mem.write8(0xb007, mem.read8(0x8007));
  for (let i = 0; i < 0x1c; i++) {
    const s = 0x8008 + i * 2, d = 0xb008 + i * 2;
    mem.write8(d, swapNibbles(mem.read8(s)));
    mem.write8(d + 1, mem.read8(s + 1));
  }
  let passes, sBase, dBase;
  if (mem.read8(0x842f) === 0) { passes = 8; sBase = 0x8040; dBase = 0xb040; }
  else { passes = 6; sBase = 0x8048; dBase = 0xb048; }
  for (let p = 0; p < passes; p++) {
    const s = sBase + p * 4, d = dBase + p * 4;
    mem.write8(d, swapNibbles(mem.read8(s)));
    mem.write8(d + 1, mem.read8(s + 1));
    mem.write8(d + 2, mem.read8(s + 2));
    mem.write8(d + 3, mem.read8(s + 3));
  }
}
