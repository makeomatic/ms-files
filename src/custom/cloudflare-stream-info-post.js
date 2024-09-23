const {
  FILES_PUBLIC_FIELD,
  UPLOAD_TYPE_CLOUDFLARE_STREAM,
} = require('../constant');

const isCloudflareStreamFile = (filename) => filename.startsWith('cfs:');

const setCloudflareStreamData = async (service, uploadData) => {
  const cloudflareStream = service.providersByAlias['cloudflare-stream'];

  if (cloudflareStream && uploadData.preview && isCloudflareStreamFile(uploadData.preview)) {
    if (uploadData[FILES_PUBLIC_FIELD]) {
      uploadData.preview = await cloudflareStream.getThumbnailUrl(uploadData.preview);
    } else {
      uploadData.preview = await cloudflareStream.getThumbnailUrlSigned(uploadData.preview);
    }
  }

  if (uploadData.files) {
    for (const { filename } of uploadData.files) {
      if (isCloudflareStreamFile(filename)) {
        try {
          uploadData[filename] = JSON.parse(uploadData[filename]);
        } catch (error) {
          service.log.error({ error, uploadData }, 'failed to parse cloudflare-stream meta');
        }
      }
    }
  }
};

module.exports = async function cloudflareStreamInfoPost(file) {
  if (file.uploadType === UPLOAD_TYPE_CLOUDFLARE_STREAM) {
    await setCloudflareStreamData(this, file);
  }

  return file;
};
