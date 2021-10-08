-- this lua script remove all embedded refs for each model of username

-- keys
local userEmbeddedKey = KEYS[1]
local fileDataKey = KEYS[2]
local fileEmbeddedPostFix = KEYS[3]

-- retrieves all filenames with embedded refs in username index
local fileNames = redis.call('smembers', userEmbeddedKey)

-- remove all filename indexes with embedded refs
for i, fileName in ipairs(fileNames) do
    local fileEmbeddedKey = fileDataKey .. ':' .. fileName .. ':' .. fileEmbeddedPostFix

    redis.call('del', fileEmbeddedKey)
end

redis.call('del', userEmbeddedKey)
