// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
/**
 * blankEnemyBandOnTimerExpiry — retire a timed on-screen object once its state timer runs out.
 *
 * WHAT IT IS
 *   ROM 0x3d8f. Grounding: [seen]. This is one state handler in an on-screen object's own little
 *   state machine — the state-10 slot. Every moving thing on the field (enemies, thrown objects,
 *   the eagle) is an actor record in work RAM, and each record carries a state index that picks
 *   which handler runs for it this frame. When a record has entered this state, the per-frame
 *   sweep hands the record here (through the index pointer IX) once every frame.
 *
 * ROLE IN THE MACHINE
 *   This is the "play out an animation for a fixed number of frames, then disappear" state. It is
 *   how a short-lived object — one that just needs to show a brief animated flourish and then leave
 *   the screen — spends its final moments. Each frame the object's animation is advanced by one
 *   step so its picture keeps moving, and a per-object countdown is ticked. As long as the
 *   countdown has not reached zero the object simply keeps animating in place. On the frame the
 *   countdown hits zero the object is done: its sprite band is blanked so it vanishes from the
 *   screen on the next frame.
 *
 *   The frame timer lives at object-record offset +0x11, a per-object countdown byte that state
 *   handlers use to pace how long an object stays in the state that owns it.
 *
 * LIVE-OUT
 *   On the elapsed (band-blank) path the exit state is whatever blankActorSpriteBand leaves: HL =
 *   the pointer advanced just past the blanked sprite band (record base + band width) and B = 0
 *   (the fill counter, drained to zero). A caller that leaves straight out of here inherits that.
 *   The not-elapsed path is memory-only — the animation step and the decremented timer live wholly
 *   in the object record, and no register a caller reads is meaningful on that path.
 */

// Object-record offset of the per-object frame timer: the byte counted down once per frame while
// the object is in this state. Reaching zero is the signal to retire the object.
const FRAME_TIMER_FIELD = 0x11; // record byte counted down each frame

export function blankEnemyBandOnTimerExpiry(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — keep the object's picture moving. advanceObjectAnimationFrame walks this object's own
  // animation program by one frame's worth of time: it ticks the frame-hold at record+0x0e and,
  // when that expires, pulls the next tile/attribute/hold entry from the object's animation script
  // (record+0x0c/+0x0d). This runs every frame regardless of the timer below, so the object stays
  // animated right up to the frame it is retired.
  advanceObjectAnimationFrame(m, ix);

  // Step 2 — tick the object's state timer down by one. The countdown byte at record+0x11 is a
  // plain 8-bit value; subtracting one and masking to a byte reproduces the wrap-around of the
  // hardware's decrement (0x00 would roll to 0xff, though in normal play the object is retired at
  // 0x01->0x00 before that can happen). The new value is written straight back into the record.
  const timer = (mem8[ix + FRAME_TIMER_FIELD] - 1) & 0xff;
  mem8[ix + FRAME_TIMER_FIELD] = timer;

  // Step 3 — while the timer has not reached zero the object still has time left in this state, so
  // leave it on screen and come back next frame. Nothing else to do this frame.
  if (timer !== 0) return; // frame timer still running

  // Step 4 — the timer has elapsed: the object's time in this state is up, so retire it.
  // blankActorSpriteBand zeroes the leading sprite band of the record at IX, which parks the
  // hardware sprite at coordinate zero with a blank shape — the object draws nothing on the next
  // frame and is gone. Leaving through it makes its exit state (HL past the band, B = 0) this
  // handler's exit state as well.
  return blankActorSpriteBand(m, ix); // elapsed: blank the sprite band (sets HL + B)
}
