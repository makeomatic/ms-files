# Uploading, Finishing, Processing and Updating files with **ms-files** module

Architecture Diagram:
![alt text][diagram]

[diagram]: ./images/up_fin_pr_upd.png "Diagram"

## Client

Client initializes uploading or updating a file or collection of files from a client application (desktop, web, etc.) and talks directly to [GLS](#google-cloud-storage).

## HTTP ACL Gateway

After the first step (upload or update) a client makes request to the API.
Here is the list of some important calls:

* `POST /api/files` -> Upload
  * **Description:** Initializes file upload, creating a resumable session id, which will be valid for a couple of hours and can be used to upload a file directly to storage provider
* `POST /api/files/gce` -> Finish
  * **Description:** Sets status of the file to uploaded and puts it into post-processing queue. Returns location of the file
  and code 202. It means that file had been pushed to post processing queue, but still not available for download. Client should
  poll status of this file in order to find out when it's ready. 412 error will be returned until it's available for download
* `POST /api/files/process` -> Process
  * **Description:** Re-processes filename based on input metadata. Returns 201 Accepted, poll to get results of processing
* `PATCH /api/files/update` -> Update
  * **Description:** Updates file metadata

API communicates with [ms-files](#ms-files) over amqp protocol (**RabbitMQ**).Although, the client receives a "synchronous" answer from the API. For example, the result of `/api/files` are singed URIs. 

## [Google Cloud Storage](https://cloud.google.com/storage/docs)

## [Google Cloud PubSub](https://cloud.google.com/pubsub/docs)

This real-time messaging platform is responsible for notifying **[ms-files](#ms-files)** module for any status changes coming from [GLS](#google-cloud-storage).

## ms-files

In the sake of simplicity we are going to describe 4 important functionalities of the module - **[upload](../src/actions/upload.js)**, **[finish](../src/actions/finish.js)**, **[process](../src/actions/process.js)** and **[update](../src/actions/update.js)**.

### Upload

#### initFileUpload

* Generates an array called `parts` which contains files file name, metadata, type and location
* Depending on the parameter resumable calls whether `gce.initResumableUpload` or `gce.createSignedURL` methods and assigns the result to `location`
* Based on various parameters creates the `fileData` object and adds necessary properties
* Adds upload `uploadId` into the temporary(?) indexes set in redis
* Adds the `fileData` as a value into the hash by `uploadKey` key in redis
* For each part creates a key based on it's name and sets it a key into hash with values `bucketName` and `STATUS_PENDING`
* For each redis set adds the `uploadTTL` parameter(?) which comes from configs
* If the `postAction` parameter is provided then we need to add a key in redis for post processing (again, with time to live `uploadTTL`)

### Finish

#### completeFileUpload

* Fetches the related metadata by `uploadPartKey` which is based on the file name
* Checks if the file exists
* Checks if all parts are uploaded

### Process

#### postProcessFile

* Fetches the data by `key` based on the `uploadId` parameter
* Checks the availability to export(???) based on:
  * the `export settings` format
  * `status` (`STATUS_PENDING` and `STATUS_PROCESSING`)
* If no need to export checks the `status` and throws an error if not uploaded or failed
* If processing was failed and max tries are reached throws an error
* If none of the errors were thrown calls the `postProcess` util method
* Gets `postActionKey` based on the `uploadId` parameter
* In case of none existence of an post action returns `data` gotten from calling the `postProcess` util method
* Checks if there is need to `update` and sends an message over `amqp`
* Based on the `awaitPostActions` parameter performs promises from `actions` array
* Deletes `postActionKey` from redis
* Returns the response from `actions`

### Update

#### acquireLock

* Locks access while updating the info

#### updateMeta

* Creates `key` based on the `uploadId` parameter, preprocesses `meta`
* Fetches the related metadata from redis by `key`, checks whether the upload is processed and is listed
* Then checks if user has an access to the file info
* Recreates `alias` if one is available and deletes the existing one if there any
* If no `alias` - deletes `aliasPTRs` from hash
* Manages `directOnly` and `isPublic` accesses

#### initFileUpdate

* Prevents race-conditions and calls safely the `updateMeta` method

### Google Cloud Provider

Let's also see how we use Google Cloud Provider. The design of the module implies that we can use different providers besides Google Cloud (for example, AWS S3).

#### Constructor

* Initializes `postProcess` method
* Extending the class with the `provider` method
* When ready is ready duplicates the redis for internal and pub/sub usages (different strategies depending on the type of redis)
* Adds migrations of redis

#### close

* Disconnects pub/sub
* Depending on the `WEBHOOK_TERMINATE` environment variable calls the `stopWebhook` method

#### handleUploadNotification

* Tries to send over `amqp` file name, resource id and event type (action)
* In case of an error manually sends positive or negative acknowledgements based on the error instance type

#### connect

* Starts the microfleet service
* Calls the `initWebhook` method
* Each provider subscribes(starts to use?) the `handleUploadNotification` method
