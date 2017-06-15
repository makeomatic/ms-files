# @microfleet/files

[![codecov.io](https://codecov.io/github/makeomatic/ms-files/coverage.svg?branch=master)](https://codecov.io/github/makeomatic/ms-files?branch=master)
[![npm version](https://badge.fury.io/js/ms-files.svg)](https://badge.fury.io/js/ms-files)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)](https://github.com/semantic-release/semantic-release)
[![Build Status](https://semaphoreci.com/api/v1/projects/88d40f13-da9b-44a5-ad04-4195f4971dd5/656972/shields_badge.svg)](https://semaphoreci.com/makeomatic/ms-files)
[![Code Climate](https://codeclimate.com/github/makeomatic/ms-files/badges/gpa.svg)](https://codeclimate.com/github/makeomatic/ms-files)

Handles metadata processing, as well as various post-processing of files

## Usage

TODO:

## Notes

To enable GCS pubsub notifications one must create a topic for it first:

```sh
gsutil notification create -t projects/<PROJECT_NAME>/topics/<TOPIC_NAME> -f json -e OBJECT_FINALIZE gs://<BUCKET_NAME>
```

## Roadmap

- [ ] document how it interacts with other services
