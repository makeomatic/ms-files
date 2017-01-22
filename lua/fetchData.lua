-- first key is redis hash key
-- we need to determine if it exists or not and if it does - return error
local key = KEYS[1]
local hashKeys = redis.call('hkeys', key)
local next = next

-- no keys, doesnt exist
if next(hashKeys) == nil then
  return redis.error_reply('404');
end

-- ARGV[1...N] could be a list of fields to omit
-- we do not have whitelist, because we do not know what fields are actually there
local filter = ARGV
local filtered

if next(filter) ~= nil then
  local tree = {}
  local insert = table.insert

  for _,field in pairs(filter) do
    tree[field] = true
  end

  filtered = {}
  for _,field in pairs(hashKeys) do
    if tree[field] ~= true then insert(filtered, field) end
  end

else
  filtered = hashKeys
end

-- fetched data
local data = redis.call('hmget', key, unpack(filtered))

-- return 2 lists of keys & associated data
return {filtered, data};
