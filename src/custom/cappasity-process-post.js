const Promise = require('bluebird');
const md5 = require('md5');
const { FILES_OWNER_FIELD } = require('../constant');

const ALLOWED_TYPES = ['c-bin', 'c-texture'];

module.exports = function finishPost(fileData, lock) {
  const { amqp, config } = this;
  const { process: { prefix, postfix: { process: route }, timeout: { process: timeout } } } = config;
  const { export: exportSettings } = fileData;

  if (!exportSettings) {
    // no need to process
    return null;
  }

  if (!fileData.bucket) {
    const provider = this.provider('download', fileData);
    fileData.bucket = provider.config.bucket.name;
  }

  const message = {
    ...fileData,
    export: {
      namePrefix: `${md5(fileData[FILES_OWNER_FIELD])}/${fileData.uploadId}`,
      outputFormat: exportSettings.format,
      compression: exportSettings.compression,
      meta: exportSettings.meta || {},
    },
    files: fileData.files.filter((file) => ALLOWED_TYPES.indexOf(file.type) >= 0),
  };

  return Promise
    .bind(this)
    .then(() => lock.extend(timeout))
    .then(() => amqp.publishAndWait(`${prefix}.${route}`, message, { timeout }))
    .then((file) => {
      fileData[file.type] = file.filename;
      fileData.files.push(file);
      return file;
    });
};
