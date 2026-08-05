-- SPDX-License-Identifier: GPL-3.0-only
-- PC-EXACT state capture: a state that exists only PARTWAY through a frame is
-- invisible to frame-boundary sampling, and some of them matter.
--
-- `space:install_read_tap` works WITHOUT -debug, unlike cpu.debug, and fires when the
-- byte is READ. Tap ONE address, and gate on CURPC: a tap also sees DATA reads, and on
-- this ROM the boot self-check reads every byte long before most routines run.
--
-- Same 4608-byte state format as dump_state.lua. The META file carries the register
-- file sampled AT THE TAP. This is a ONE-SHOT SNAPSHOT, not a per-routine oracle --
-- there is no exit sample and so no pair. That is unit_capture.lua's job.
--
-- Env: PC_TARGET (default 0x07B1, the boot entry), STATE_OUT, PC_META, CONFIG_OUT

local cpu = manager.machine.devices[":maincpu"]
local sp = cpu.spaces["program"]
local target = tonumber(os.getenv("PC_TARGET") or "0x07B1")

-- Machine CONFIGURATION, on EVERY capture path: a missing config is treated as
-- unverified, and an unverified configuration read as a pass is the failure this
-- prevents. All of it is sampled AT SCRIPT LOAD -- dsw0/dsw1 as MAME resolved them,
-- the ROM byte proving the image loaded, and reg_* as the Z80 RESET state checked
-- against a pinned contract. These are NOT the registers at the tapped PC.
--
-- BOTH banks: DSW0 here is coinage only, while DSW1 holds lives, bonus, difficulty,
-- cabinet and demo sounds. The shared checker verifies only dsw0 today.
local cfgf = io.open(os.getenv("CONFIG_OUT") or "config.txt", "w")
if cfgf then
  cfgf:setvbuf("no")
  cfgf:write(string.format("dsw0=0x%02X\ndsw1=0x%02X\ncontrol_rom0000=0x%02X\n",
    sp:read_u8(0xC360), sp:read_u8(0xC200), sp:read_u8(0x0000)))
  local cpu = manager.machine.devices[":maincpu"]
  for _, rn in ipairs({"AF","BC","DE","HL","IX","IY","SP"}) do
    local ok, v = pcall(function() return cpu.state[rn].value end)
    if ok and v ~= nil then cfgf:write(string.format("reg_%s=0x%04X\n", rn, v)) end
  end
  cfgf:close()
end

local out = assert(io.open(os.getenv("STATE_OUT") or "state_at_pc.bin", "wb"))
out:setvbuf("no")
local meta = io.open(os.getenv("PC_META") or "state_at_pc.txt", "w")
if meta then meta:setvbuf("no") end

-- Mirrors hardware.json "stateRegions"; keep consistent with it.
local REGIONS = {
  { 0xA000, 0xA3FF, "color" },
  { 0xA400, 0xA7FF, "video" },
  { 0xA800, 0xAFFF, "work" },
  { 0xB000, 0xB0FF, "sprite0" },
  { 0xB400, 0xB4FF, "sprite1" }
}

_G.__pc_done = false
_G.__pc_tap = sp:install_read_tap(target, target, "pc_exact", function(offset, data, mask)
  -- CURPC IS LOAD-BEARING. The boot self-check reads every ROM byte, so for almost any
  -- address the FIRST tap hit is the checksum's data read, and the state captured would
  -- be the checksum's rather than the routine's.
  if cpu.state["CURPC"].value ~= target then return data end
  -- First opcode fetch only; an entry reached every frame would emit thousands.
  if _G.__pc_done then return data end
  _G.__pc_done = true

  local parts = {}
  for _, r in ipairs(REGIONS) do
    for a = r[1], r[2] do
      parts[#parts + 1] = string.char(sp:read_u8(a))
    end
  end
  out:write(table.concat(parts))

  if meta then
    local secs = manager.machine.time:as_double()
    meta:write(string.format(
      "pc=0x%04X\nopcode_byte=0x%02X\nseconds=%.9f\ncycles=%.0f\n",
      target, data, secs, secs * 3072000))
    -- The registers AS OF THIS FETCH -- read inside the tap, because the config.txt
    -- copy is the reset state and says nothing about the sampled moment.
    local cpu = manager.machine.devices[":maincpu"]
    for _, rn in ipairs({ "AF", "BC", "DE", "HL", "IX", "IY", "SP" }) do
      local ok, v = pcall(function() return cpu.state[rn].value end)
      if ok and v ~= nil then meta:write(string.format("reg_%s=0x%04X\n", rn, v)) end
    end
  end
  return data
end)
