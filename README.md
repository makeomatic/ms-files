# ms-files

Handles metadata processing, as well as various post-processing of files

## Plan

1. Provide access-control for read & writes on a per user basis
2. Initiate file upload for a given user
3. Complete file upload for a given user
4. Send completed file upload to a post-processing queue
5. Cleanup after abrupt file uploads
