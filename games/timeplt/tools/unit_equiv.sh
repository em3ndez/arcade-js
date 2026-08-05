#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
#
# Per-routine equivalence, end to end: derive each translated routine's exit points
# from the ROM, capture entry/exit pairs from MAME, run the routines against them.
#
# The three stages MUST run together. The entry list comes from translated/ at the
# moment of the run, so a spec built against an older directory reports newer routines
# as "not reached" -- blaming attract mode for a gap in the instrument.
#
# Usage: unit_equiv.sh [seconds] [tape.lua]
#   seconds   emulated seconds to capture; attract includes a demo, so most gameplay
#             routines are reached with no input at all
#   tape.lua  optional input tape, to reach what attract never does (coin, start, play)
set -euo pipefail

SECONDS_TO_RUN="${1:-90}"
TAPE="${2:-}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="$(dirname "$HERE")"
REPO="$(dirname "$(dirname "$GAME")")"
UNITS="$GAME/out/units"
CAP="$UNITS/cap"
ROMPATH="${ROMPATH:-$GAME/rom}"
MAME="${MAME:-mame}"

mkdir -p "$UNITS"
rm -rf "$CAP"
mkdir -p "$CAP"

# 1. Entry list = every translated routine that exists right now.
# loc_*.js ONLY -- an unfiltered listing swept in _registry.generated.js, whose mangled
# name reaches routine_extents.py as a non-hex "address" and kills stage 2.
ls "$GAME/translated" | sed -n 's/^loc_\([0-9a-f]*\)\.js$/\1/p' | tr 'a-f' 'A-F' | sort -u > "$UNITS/entries.txt"

# 2. Exit points, from the ROM.
python3 "$HERE/routine_extents.py" \
  --rom "$GAME/rom/maincpu.bin" \
  --entries "$UNITS/entries.txt" \
  --spec "$UNITS/spec.txt" \
  --json "$UNITS/extents.json"

# 3. The MAME oracle. One run captures every pair.
SCRIPT="$HERE/lua/unit_capture.lua"
if [ -n "$TAPE" ]; then
  # MAME takes ONE -autoboot_script, so tape and instrument compose into a shim.
  SHIM="$UNITS/tape_shim.lua"
  { echo "dofile('$(cd "$(dirname "$TAPE")" && pwd)/$(basename "$TAPE")')"
    echo "dofile('$SCRIPT')"; } > "$SHIM"
  SCRIPT="$SHIM"
fi

# FRESH, THROWAWAY cfg AND nvram DIRECTORIES. MAME writes <game>.cfg on exit even under
# -nowriteconfig (that flag governs mame.ini), and a leftover cfg carries dipswitch and
# coin-counter state into the NEXT run, silently changing what was captured.
WORK="$UNITS/mame-work"
rm -rf "$WORK"
mkdir -p "$WORK/cfg" "$WORK/nvram"

echo "[capture] $SECONDS_TO_RUN emulated seconds"
SDL_VIDEODRIVER=dummy \
UNIT_SPEC="$UNITS/spec.txt" \
UNIT_OUT="$CAP" \
"$MAME" timeplt -rompath "$ROMPATH" \
  -noreadconfig -nowriteconfig -skip_gameinfo \
  -video none -sound none -nothrottle -frameskip 0 \
  -cfg_directory "$WORK/cfg" -nvram_directory "$WORK/nvram" \
  -nonvram_save -nocheat -noautosave \
  -seconds_to_run "$SECONDS_TO_RUN" \
  -autoboot_script "$SCRIPT"

echo "[capture] $(ls "$CAP" | grep -c 'entry\.bin$') pairs"

# 4. Compare.
node "$HERE/unit_equiv.mjs" --cap "$CAP" --json "$UNITS/results.json"
