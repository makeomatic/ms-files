-- first key is redis hash key
-- we need to determine if it exists or not and if it does - return error
local key = KEYS[1]
local redisCall = redis.call
local next = next

-- key type ~= hash means not exists
if redisCall('type', key).ok ~= 'hash' then
  return redis.error_reply('404');
end

local params
-- ARGV[1] could be a JSON object { omit: [], pick: []}
-- * we do not have whitelist, because we do not know what fields are actually there
-- * fields provided in `omit` list automatically excluded from `pick` list.
-- * if no fields provided in `pick` list we use all fields from hash
-- * both fields are optional, so if they have type ne object We override them with defalt values
if type(ARGV[1]) == 'string' then params=cjson.decode(ARGV[1]) end

local filtered

if type(params) == 'table' then
  local omit = (type(params['omit']) == 'table' and params['omit'] or {})
  local pick = (type(params['pick']) == 'table' and params['pick'] or redisCall('hkeys', key))

  local insert = table.insert
  local omitTree = {}

  for _,field in pairs(omit) do
    omitTree[field] = true
  end

  filtered = {}
  for _,field in pairs(pick) do
    -- if field present in omit we exclude it from pick list
    if (omitTree[field] ~= true) then insert(filtered, field) end
  end

  -- no fields left
  if #filtered == 0 then
    return { filtered, {} }
  end

else
  filtered = redisCall('hkeys', key)
end

-- fetched data
local data = redisCall('hmget', key, unpack(filtered))

-- return 2 lists of keys & associated data
return {filtered, data};
