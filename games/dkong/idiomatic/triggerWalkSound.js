// SPDX-License-Identifier: GPL-3.0-only
/**
 * triggerWalkSound — request Mario's footstep ("walk") sound for 3 frames.  ROM 0x1d8f.
 *
 * The walk sound is a discrete analog circuit on ls259.6h bit 0 (hardware latch
 * 0x7D00), which the Z80 cannot read back, so game code asserts it through a
 * work-RAM shadow: it stores a small frame count into SND_TRIGGER[0] (0x6080) and
 * the per-vblank sound driver (soundDriverTick, ROM 0x00E0) counts that value down,
 * holding the latch asserted while it stays non-zero. This leaf performs that one
 * store — SND_TRIGGER[0] := 3, a 3-frame hold, i.e. one short footstep blip.
 *
 * It reads nothing, branches nowhere, and always writes the same constant, so its
 * effect is independent of prior machine state. The two callers gate it and pass
 * their decision through this single unconditional store:
 *   - loc_1cc2 (ROM 0x1CC7, `call c`) — the walking / turn footstep; and
 *   - loc_1d51 (ROM 0x1D61, `call z`) — the climb footstep, fired on the 0 phase of
 *     the climb-sound toggle (MARIO_CLIMB_SOUND_TOGGLE, 0x6224).
 * A LEAF — calls nothing. (SND_TRIGGER[0] = the "walk" effect per audio/README.md;
 * audio/sounds.js cites "0x1D8F sets 0x6080=3" as this very trigger.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-1d8f.test.js.
 * GATE:     crafted-entry — input-independent, straight-line (no data-dependent
 *           branch, so there are no unreached arms); validated on real captured 25m
 *           dispatches (FRESH clone per case — it writes RAM) PLUS a crafted
 *           pre-dirtied entry proving it overwrites any prior SND_TRIGGER[0] with 3.
 *           Reached once the attract demo walks/climbs on 25m.
 * LIVE-OUT: memory-only — SND_TRIGGER[0]. Both return sites overwrite A with an
 *           immediate before any read (0x1CCA `ld a,0x02`; 0x1D64 -> loc_1d49
 *           `ld a,0x01`) and consume no flag this leaves, so the oracle's residual
 *           A = 3 is dead ABI. pc/SP are not live either: the oracle models its
 *           terminal `ret` with m.step/m.ret (advancing pc to the popped return
 *           address, SP+2); the direct-call layer replaces that with a JS return.
 * NAMES:    SND_TRIGGER (ram.js, 0x6080 — base of the [8] sound-trigger shadow;
 *           index 0 = the "walk" effect). The 3-frame hold is a local const.
 */

import { SND_TRIGGER } from "../optimized/ram.js"; // 0x6080 — SND_TRIGGER[0] = walk (ls259.6h bit 0)

// Game code asserts a sound by storing a small frame count into its trigger shadow;
// soundDriverTick (ROM 0x00E0) counts it down, so 3 holds the walk latch for 3 frames.
const WALK_ASSERT_FRAMES = 0x03;

export function triggerWalkSound(m) {
  // ld a,0x03 ; ld (0x6080),a — SND_TRIGGER[0] := 3, one footstep blip.
  m.mem.write8(SND_TRIGGER, WALK_ASSERT_FRAMES);
}
