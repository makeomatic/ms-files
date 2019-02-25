async function tagFile(fileData) {
  const { amqp, config: { process: processConfig } } = this;
  // new owner format
  const { files, owner, bucket, uploadId } = fileData;
  const file = files.find(f => f.type === 'c-preview');

  if (file === undefined) {
    return false;
  }

  await amqp.publish(
    `${processConfig.prefix}.${processConfig.postfix.annotate}`,
    { filename: file.filename, username: owner, bucket, uploadId }
  );

  return true;
}

module.exports = tagFile;
