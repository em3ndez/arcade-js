// SPDX-License-Identifier: GPL-3.0-only
/**
 * issueSoundCommand  —  ROM 0x0794  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The hardware hand-off that delivers one already-chosen sound command to Frogger's separate audio
 *   CPU. The main CPU never synthesizes tones itself: it parks a one-byte command on a data port and
 *   strobes an interrupt line so a second Z80 (the sound CPU) wakes, reads the byte, and plays the
 *   corresponding effect. This routine performs exactly that two-port hand-off for a single command.
 *
 * WHERE IT SITS
 *   The very bottom of the sound path — the only place that touches the sound hardware. Everything
 *   above it deals in a software FIFO of pending commands; this routine is what finally puts one on
 *   the wire. `dequeueSoundCommand` (0x07ac) pops one command off that ring each in-play frame and
 *   calls here to deliver it; `scanCoinInputAndCredit` (0x2cf0) calls here directly to sound the coin
 *   "blip" the instant a coin is credited. The queue bookkeeping lives in those callers, not here.
 *
 * LIVE-OUT
 *   IO-only. It writes the sound-data latch and pulses the sound-control port — pure hardware traffic
 *   that leaves no trace in a RAM dump — and returns no value the caller reads.
 */
import { SOUND_CMD_LATCH, SOUND_CTRL_PORT, SOUND_CTRL_SHADOW } from "./names.js";

export function issueSoundCommand(m, cmd = m.regs.a) {
  const { mem8 } = m;

  // ── Step 1: park the command byte on the sound-data port ─────────────────────────────
  // SOUND_CMD_LATCH (0xd000) is PPI1 port A — the 8-bit data latch the sound CPU reads. `cmd` defaults
  // to register A (the ROM's live-in), which is how every caller passes the command. This write only
  // stages the byte; the sound CPU has not yet been told to look — that is the /INT strobe in Step 2.
  mem8[SOUND_CMD_LATCH] = cmd;

  // ── Step 2: read the shadow of the (write-only) control port ─────────────────────────
  // SOUND_CTRL_PORT (0xd002) is PPI1 port B; its bit 3 is wired to the sound CPU's /INT line. The port
  // is write-only — you cannot read back what you last wrote — so the main CPU keeps a RAM shadow of
  // its current value in SOUND_CTRL_SHADOW (0x83d9). That shadow is the only record of the other seven
  // bits, and we must preserve them across the pulse rather than clobber them.
  const control = mem8[SOUND_CTRL_SHADOW];

  // ── Step 3: strobe bit 3 low-then-high to fire /INT ──────────────────────────────────
  // Pulse bit 3 down and back up. The FALLING edge (bit 3 going 1→0, since the shadow idles with bit 3
  // high) is what asserts the sound CPU's /INT, waking it to read the byte latched in Step 1. The first
  // write clears only bit 3 (`& 0xf7`, i.e. `& ~0x08`) while keeping the other seven shadow bits; the
  // second (`| 0x08`) drives bit 3 back high, ending the pulse. The command is already on the data port,
  // so by the time /INT fires the sound CPU sees the correct byte.
  mem8[SOUND_CTRL_PORT] = control & 0xf7;
  mem8[SOUND_CTRL_PORT] = control | 0x08;
}
