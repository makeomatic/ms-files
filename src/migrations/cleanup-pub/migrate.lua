-- KEYS[1] is reserved for VERSION of migrations
local files_index_pub = KEYS[1]
local files_data = KEYS[2]

-- retrieves all filenames in the public index
local uids = redis.call('smembers', files_index_pub)

for i, uid in ipairs(uids) do
  local dataKey = files_data .. ':' .. uid

  if redis.call('exists', dataKey) == 0 then
    redis.call('srem', files_index_pub, uid)
  end
end
