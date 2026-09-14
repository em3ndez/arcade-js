// SPDX-License-Identifier: GPL-3.0-only
import { STATUS_FLAGS } from "./names.js";
import { loadSoundVoiceSlots } from "./loadSoundVoiceSlots.js";

/**
 * requestSoundIfEnabled — the sound enable gate. ROM 0xccc3.
 *
 * Role in the machine: the single choke point every sound cue passes through. Tempest can
 * mute all game audio via the enable flag loc_5; this routine honours that flag so that no
 * cue reaches the voice loader while sound is off. The named per-cue trampolines
 * (requestScoreAwardSound id 0x4f, requestSegmentHitSound id 0x9f, and the BCD-award path)
 * all funnel their fixed id here.
 *
 * Behavior: test bit 7 of the enable flag loc_5 (STATUS_FLAGS). If it is clear, sound is
 * disabled — return immediately, writing nothing. If set, forward the sound id in A (with
 * the X/Y indices) to loadSoundVoiceSlots, which registers the sound in a free voice slot.
 * A/X/Y default from the machine registers so a bare 6502-style call reads its operands.
 *
 * Live-out: none of its own; on the enabled path the voice-slot writes happen in the loader.
 * Grounding: [seen].
 */
export function requestSoundIfEnabled(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  // Bit 7 of loc_5 clear => audio muted: drop the cue silently, matching the ROM's early return.
  if ((mem8[STATUS_FLAGS] & 0x80) === 0) return;
  // Enabled: hand the id + indices to the voice loader to claim a slot.
  loadSoundVoiceSlots(m, a, x, y);
}
