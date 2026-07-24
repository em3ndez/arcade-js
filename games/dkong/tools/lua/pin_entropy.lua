-- SPDX-License-Identifier: GPL-3.0-only
-- Entropy pinning, MAME side (game-agnostic). Reads a patch spec from the ENTROPY_PIN env var
-- and applies it to the maincpu ROM region BEFORE the CPU runs, so the game's RNG working set
-- becomes deterministic and identical to the pinned JS translation (see core/entropy-pin.js and
-- docs/08-entropy-pinning.md). The patches are cycle-neutral operand rewrites (they redirect a
-- store or a read to a different address; they never change instruction lengths), so the frame
-- timing the game itself depends on is untouched.
--
-- Spec format: "AAAA:VV,AAAA:VV,..." — each is a ROM byte offset (hex) and its new value (hex),
-- exactly the strings produced by entropyPinRomSpec() from manifest.entropyPin.romPatches. This
-- is a TEST-ONLY instrument; it is composed ahead of a validation tape, never shipped.
local spec = os.getenv("ENTROPY_PIN")
if spec and #spec > 0 then
  local reg = manager.machine.memory.regions[":maincpu"]
  if reg then
    local n = 0
    for pair in spec:gmatch("[^,]+") do
      local a, v = pair:match("(%x+):(%x+)")
      if a and v then
        reg:write_u8(tonumber(a, 16), tonumber(v, 16))
        n = n + 1
      end
    end
    print(string.format("[pin_entropy] applied %d ROM patch(es)", n))
  end
end
