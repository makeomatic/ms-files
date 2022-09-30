## [16.0.7](https://github.com/makeomatic/ms-files/compare/v16.0.6...v16.0.7) (2022-09-27)


### Bug Fixes

* up max video file size to 100mb ([#277](https://github.com/makeomatic/ms-files/issues/277)) ([9d67c3c](https://github.com/makeomatic/ms-files/commit/9d67c3cf4347b84a25e5cd0cd6fe0b9fa61ad4db))

## [16.0.6](https://github.com/makeomatic/ms-files/compare/v16.0.5...v16.0.6) (2022-09-21)


### Bug Fixes

* allow searching by infix, too ([130dfdc](https://github.com/makeomatic/ms-files/commit/130dfdc67cd976d6824687a3041ec846faef83a1))
* revert suffix search ([4797bff](https://github.com/makeomatic/ms-files/commit/4797bffa9a3555700113cbdd21f509d17a98371b))

## [16.0.5](https://github.com/makeomatic/ms-files/compare/v16.0.4...v16.0.5) (2022-09-20)


### Bug Fixes

* multi-word tags search ([f78b4b6](https://github.com/makeomatic/ms-files/commit/f78b4b6848c485453bfa4971c83442d241246c7e))

## [16.0.4](https://github.com/makeomatic/ms-files/compare/v16.0.3...v16.0.4) (2022-09-20)


### Bug Fixes

* negative query at the start applies to everything in the query ([294850c](https://github.com/makeomatic/ms-files/commit/294850c81cee2a4d63325f728ce52b3a45308e01))

## [16.0.3](https://github.com/makeomatic/ms-files/compare/v16.0.2...v16.0.3) (2022-09-20)


### Bug Fixes

* correct temp filtering ([8c58047](https://github.com/makeomatic/ms-files/commit/8c58047493fadd8c83ec0a95715c85ed9dbad55d))
* do not ignore temp files ([e52b09d](https://github.com/makeomatic/ms-files/commit/e52b09d43f70e199aa77b690400a35d9c204dbe3))

## [16.0.2](https://github.com/makeomatic/ms-files/compare/v16.0.1...v16.0.2) (2022-09-20)


### Bug Fixes

* manual sync action, ignore temp during redis search ([fd57195](https://github.com/makeomatic/ms-files/commit/fd5719586038fb31f56be954ba3d727f17291cda))

## [16.0.1](https://github.com/makeomatic/ms-files/compare/v16.0.0...v16.0.1) (2022-09-19)


### Bug Fixes

* search with tags, #multi, # ([#274](https://github.com/makeomatic/ms-files/issues/274)) ([f8d6034](https://github.com/makeomatic/ms-files/commit/f8d603485d384d47adfeb20002557068b2d052c6))

# [16.0.0](https://github.com/makeomatic/ms-files/compare/v15.19.1...v16.0.0) (2022-09-18)


### Features

* redis-search, latest microfleet/amqp/pino ([#267](https://github.com/makeomatic/ms-files/issues/267)) ([2c115d9](https://github.com/makeomatic/ms-files/commit/2c115d9163a4347b2dfb021881007aa0c9e78510))


### BREAKING CHANGES

* includes new mode of operation for list action with redis-search, introduces a migration that creates indices in redis-search, this requires redis to have loaded appropriate modules. It still has backward compatibility in a sense that you can disable redis-search from being used, but you have to disable migrations as well. On top of it new versions of microfleet/amqp/pino are used - they are associated with performance gains, but configuration must be checked to be updated and compatible

* feat: upgrade deps
* chore: disable in_one on ci
* feat: working redis-search
* chore: adduser doesnt work on ci
* chore: test ordering / migrations
* fix: bluebird promises
* chore: run all tests in 1 process
* fix: broken custom hooks
* fix: lint
* fix: redisearch skip unlisted files
* fix: unlisted query
* fix: hide direct only files in list

Co-authored-by: pajgo <51755949+pajgo@users.noreply.github.com>

## [15.19.1](https://github.com/makeomatic/ms-files/compare/v15.19.0...v15.19.1) (2022-09-09)


### Bug Fixes

* reset caches when nft created ([#273](https://github.com/makeomatic/ms-files/issues/273)) ([7a5e972](https://github.com/makeomatic/ms-files/commit/7a5e972a966792f074adf4bacbcfb4a52a1c313f))

# [15.19.0](https://github.com/makeomatic/ms-files/compare/v15.18.0...v15.19.0) (2022-09-06)


### Features

* add version field ([#271](https://github.com/makeomatic/ms-files/issues/271)) ([ad5de71](https://github.com/makeomatic/ms-files/commit/ad5de71021aedaae43e0683c1d6e09863592e15a))

# [15.18.0](https://github.com/makeomatic/ms-files/compare/v15.17.2...v15.18.0) (2022-08-24)


### Features

* add cappacity nft meta fields ([ab0fd49](https://github.com/makeomatic/ms-files/commit/ab0fd49e3678af7669e929453e3230a37f44e2aa))
* add modelType filter to list action ([da3eaf1](https://github.com/makeomatic/ms-files/commit/da3eaf1adaabc48b7c1773c39682b032782e7853))

## [15.17.2](https://github.com/makeomatic/ms-files/compare/v15.17.1...v15.17.2) (2022-03-31)


### Bug Fixes

* panorama upload ([#250](https://github.com/makeomatic/ms-files/issues/250)) ([6c122a4](https://github.com/makeomatic/ms-files/commit/6c122a43318d5cbece28c7702ff964d8d0ff50ac))

## [15.17.1](https://github.com/makeomatic/ms-files/compare/v15.17.0...v15.17.1) (2022-02-06)


### Bug Fixes

* upgrade deps ([c38316e](https://github.com/makeomatic/ms-files/commit/c38316ece96fc053f825c69394f415b02991381b))

# [15.17.0](https://github.com/makeomatic/ms-files/compare/v15.16.0...v15.17.0) (2022-02-05)


### Bug Fixes

* hooks destructuring ([fc5a09a](https://github.com/makeomatic/ms-files/commit/fc5a09a5745a6bc7f9e128999f9f6fbd40bc1661))
* incorporate dlock plugin, pnpm, latest microfleet ([4ce39f8](https://github.com/makeomatic/ms-files/commit/4ce39f896c974e4aac97c749c7f0d375a8c4fb8d))
* linter error ([ec0e1a8](https://github.com/makeomatic/ms-files/commit/ec0e1a8bee849bf9389f1e10acc2a27a31089d4e))
* remove metricObservability from router config ([1b66095](https://github.com/makeomatic/ms-files/commit/1b6609560cc25484f9e5a55f877753fb45772061))
* update deps ([2b1fa16](https://github.com/makeomatic/ms-files/commit/2b1fa161ad0216212e089310eaba623a87a33266))
* upgrade deps ([b5c5704](https://github.com/makeomatic/ms-files/commit/b5c5704f9170fcbaca0d876400c0c09267bc03f6))


### Features

* c8 for native cov, no babel ([a31e459](https://github.com/makeomatic/ms-files/commit/a31e45939876801e0ae3d703a140149b67fc2ba0))
* introduces uploadedAt index for faster search ([#249](https://github.com/makeomatic/ms-files/issues/249)) ([ce1a138](https://github.com/makeomatic/ms-files/commit/ce1a13845eaa9137a4193e6a8f218bce550a50b6))
* upgrade microfleet to 17.9.0 ([4313682](https://github.com/makeomatic/ms-files/commit/43136827cc4a9181b1019c677794ede3daf41a10))

# [15.16.0](https://github.com/makeomatic/ms-files/compare/v15.15.0...v15.16.0) (2021-09-07)


### Features

* **remove:** add soft deletion ([#240](https://github.com/makeomatic/ms-files/issues/240)) ([1d0126e](https://github.com/makeomatic/ms-files/commit/1d0126ed944648263f7c3161a062247e37ffbf0d))

# [15.15.0](https://github.com/makeomatic/ms-files/compare/v15.14.0...v15.15.0) (2021-09-06)


### Bug Fixes

* python ([a8036b3](https://github.com/makeomatic/ms-files/commit/a8036b3051f7c67e15533e31904eef2da9dac74e))
* python version ([6e95ee5](https://github.com/makeomatic/ms-files/commit/6e95ee54eafb23a70f027fa2f212918e786e02ac))


### Features

* node 16, adjust timeouts ([33830c8](https://github.com/makeomatic/ms-files/commit/33830c801078247e9c76883afa3e8998ec3a64b1))

# [15.14.0](https://github.com/makeomatic/ms-files/compare/v15.13.0...v15.14.0) (2021-08-13)


### Features

* **embeds:** add new embed parameter ([e6b5ce9](https://github.com/makeomatic/ms-files/commit/e6b5ce9081ce20f2212c349f9da03b4be0461259))

# [15.13.0](https://github.com/makeomatic/ms-files/compare/v15.12.0...v15.13.0) (2021-07-20)


### Features

* added text/csv content type ([adb9a82](https://github.com/makeomatic/ms-files/commit/adb9a822d1a20c21b545cf03bd8c085a98dc00ec))

# [15.12.0](https://github.com/makeomatic/ms-files/compare/v15.11.0...v15.12.0) (2021-07-02)


### Features

* pHeight pWidth fields ([dabb47c](https://github.com/makeomatic/ms-files/commit/dabb47cd92647208aa637958228586cd699f15f7))

# [15.11.0](https://github.com/makeomatic/ms-files/compare/v15.10.0...v15.11.0) (2021-04-20)


### Bug Fixes

* audit log from microfleet ([a6f2e0d](https://github.com/makeomatic/ms-files/commit/a6f2e0d4a4e09969c7069b2b8360ae581becfb39))


### Features

* upgrade microfleet to 17.6 ([ef96090](https://github.com/makeomatic/ms-files/commit/ef960907b4e598af54d5af5db4d5d4eb2c3e9684))

# [15.10.0](https://github.com/makeomatic/ms-files/compare/v15.9.1...v15.10.0) (2021-01-27)


### Features

* allow disabling tag search cache ([139a9c7](https://github.com/makeomatic/ms-files/commit/139a9c7f9f0025be954e91bf36afbbbf3b969d89))

## [15.9.1](https://github.com/makeomatic/ms-files/compare/v15.9.0...v15.9.1) (2020-12-27)


### Bug Fixes

* revert prom-client (^12) ([041b039](https://github.com/makeomatic/ms-files/commit/041b039b31f6c69a2c11d8bd54ac9c7f71365af3))

# [15.9.0](https://github.com/makeomatic/ms-files/compare/v15.8.0...v15.9.0) (2020-12-26)


### Bug Fixes

* oss cname ([9ad371f](https://github.com/makeomatic/ms-files/commit/9ad371fce7d5322fa403789dc68cb7d00710ff62))
* select provider ([99f73c9](https://github.com/makeomatic/ms-files/commit/99f73c9c08c1990a00d4a09e18c72561bd0383f8))
* tests ([6cd9dac](https://github.com/makeomatic/ms-files/commit/6cd9dacef93a8fd4edbcefa487c196e2932f18df))
* tests ([40e498a](https://github.com/makeomatic/ms-files/commit/40e498a322b7e5b1737421ed00e5372bd7ff8de9))
* tests ([eab2396](https://github.com/makeomatic/ms-files/commit/eab2396774e3da42e9e1cfac0365f79db0d69311))
* tests ([fec8f13](https://github.com/makeomatic/ms-files/commit/fec8f13bd1063de69621d526868b7a4d2c8d38e8))
* update deps ([f5738b6](https://github.com/makeomatic/ms-files/commit/f5738b6edf759d67a01b2a0f16d401cce9997ba4))


### Features

* oss provider ([3d447e6](https://github.com/makeomatic/ms-files/commit/3d447e6350790b4d73983b66479690db2238fe49))

# [15.8.0](https://github.com/makeomatic/ms-files/compare/v15.7.4...v15.8.0) (2020-12-16)


### Features

* **cpst:** add apps field to embed options ([#213](https://github.com/makeomatic/ms-files/issues/213)) ([510b7ea](https://github.com/makeomatic/ms-files/commit/510b7ea3f4eff956ae01d27f93e046a70a4ded13))

## [15.7.4](https://github.com/makeomatic/ms-files/compare/v15.7.3...v15.7.4) (2020-07-30)


### Bug Fixes

* **embed:** remove ttc option from embed defaults ([#201](https://github.com/makeomatic/ms-files/issues/201)) ([79db869](https://github.com/makeomatic/ms-files/commit/79db86914d2476f12beb5c26ef1d469e9756c7b5))

## [15.7.3](https://github.com/makeomatic/ms-files/compare/v15.7.2...v15.7.3) (2020-07-09)


### Bug Fixes

* remove rotatemode from embed options ([71542c5](https://github.com/makeomatic/ms-files/commit/71542c5bd551728aa1321c40393bf4322348b3ef))

## [15.7.2](https://github.com/makeomatic/ms-files/compare/v15.7.1...v15.7.2) (2020-06-26)


### Bug Fixes

* move reverse parameter into playerSettings field ([#196](https://github.com/makeomatic/ms-files/issues/196)) ([aa71c06](https://github.com/makeomatic/ms-files/commit/aa71c06793e21eb0d64b492af3c737cc11815ade))

## [15.7.1](https://github.com/makeomatic/ms-files/compare/v15.7.0...v15.7.1) (2020-06-25)


### Bug Fixes

* serialize cycle/reverse properties ([e885965](https://github.com/makeomatic/ms-files/commit/e88596586914723e15b647501270e1cd06a382d1))

# [15.7.0](https://github.com/makeomatic/ms-files/compare/v15.6.2...v15.7.0) (2020-06-25)


### Features

* add advanced playerSettings properties ([#195](https://github.com/makeomatic/ms-files/issues/195)) ([074a353](https://github.com/makeomatic/ms-files/commit/074a353ae7d563ebb4d493027d16228f3476a3c6))

## [15.6.2](https://github.com/makeomatic/ms-files/compare/v15.6.1...v15.6.2) (2020-06-11)


### Bug Fixes

* node 12.18 + ar qs ([2874f33](https://github.com/makeomatic/ms-files/commit/2874f3368dcc7951264a1be45641fedc9ad69798))

## [15.6.1](https://github.com/makeomatic/ms-files/compare/v15.6.0...v15.6.1) (2020-06-04)


### Bug Fixes

* **embed:** change default arbutton value ([1e7d084](https://github.com/makeomatic/ms-files/commit/1e7d084e270f5549a8399bd7999709a3fd1a9d34))

# [15.6.0](https://github.com/makeomatic/ms-files/compare/v15.5.1...v15.6.0) (2020-06-03)


### Features

* extra meta props "playerSettings" ([#194](https://github.com/makeomatic/ms-files/issues/194)) ([4b704ae](https://github.com/makeomatic/ms-files/commit/4b704ae9c7f845ba717defd2ccb1577e004c01b8))

## [15.5.1](https://github.com/makeomatic/ms-files/compare/v15.5.0...v15.5.1) (2020-04-20)

# [15.5.0](https://github.com/makeomatic/ms-files/compare/v15.4.2...v15.5.0) (2020-04-20)


### Features

* creationInfo ([#189](https://github.com/makeomatic/ms-files/issues/189)) ([a5fb7db](https://github.com/makeomatic/ms-files/commit/a5fb7dbf42f7754c686b3ffaf19627fdcdcedfc3))

## [15.4.2](https://github.com/makeomatic/ms-files/compare/v15.4.1...v15.4.2) (2020-03-16)


### Bug Fixes

* bump @microfleet/core version ([#186](https://github.com/makeomatic/ms-files/issues/186)) ([8eae2fe](https://github.com/makeomatic/ms-files/commit/8eae2fe4c022d901663015cd79203c0b910d0dd4))

## [15.4.1](https://github.com/makeomatic/ms-files/compare/v15.4.0...v15.4.1) (2020-02-27)


### Bug Fixes

* ar3dParams validation ([#184](https://github.com/makeomatic/ms-files/issues/184)) ([64dca13](https://github.com/makeomatic/ms-files/commit/64dca1368474d2541ed1b4d21b854f5f400c388b))

# [15.4.0](https://github.com/makeomatic/ms-files/compare/v15.3.0...v15.4.0) (2020-02-27)


### Features

* files.data action + tests ([#182](https://github.com/makeomatic/ms-files/issues/182)) ([4b58e13](https://github.com/makeomatic/ms-files/commit/4b58e134b205d6b79e7a7f14b1a2a3a54b82a680))

# [15.3.0](https://github.com/makeomatic/ms-files/compare/v15.2.0...v15.3.0) (2020-02-25)


### Bug Fixes

* **info-post:** remove cappasityai from params/code for legacy support ([#180](https://github.com/makeomatic/ms-files/issues/180)) ([2440d32](https://github.com/makeomatic/ms-files/commit/2440d32218eed62bfe976a4aefd33942cfcad3ec))


### Features

* additional 3d ar props ([#183](https://github.com/makeomatic/ms-files/issues/183)) ([d9015eb](https://github.com/makeomatic/ms-files/commit/d9015eb1afd341667a1b7d2a888994433235ed97))

# [15.2.0](https://github.com/makeomatic/ms-files/compare/v15.1.2...v15.2.0) (2020-02-20)


### Features

* **embed:** add cappasityai field to embed params ([#177](https://github.com/makeomatic/ms-files/issues/177)) ([010ecaa](https://github.com/makeomatic/ms-files/commit/010ecaa3c8db696ea6667de0e74779db73c9c564))

## [15.1.2](https://github.com/makeomatic/ms-files/compare/v15.1.1...v15.1.2) (2020-02-12)


### Bug Fixes

* allow empty collections in list schema ([#176](https://github.com/makeomatic/ms-files/issues/176)) ([dac2218](https://github.com/makeomatic/ms-files/commit/dac2218165c34d6d1510b14ae2634c54c5d2d93c))

## [15.1.1](https://github.com/makeomatic/ms-files/compare/v15.1.0...v15.1.1) (2020-02-11)


### Bug Fixes

* allow empty `types` in download request schema ([#175](https://github.com/makeomatic/ms-files/issues/175)) ([10f89ed](https://github.com/makeomatic/ms-files/commit/10f89ed907d0b0332c048d7d0e2ecf38e62fc713))

# [15.1.0](https://github.com/makeomatic/ms-files/compare/v15.0.0...v15.1.0) (2020-02-05)


### Features

* add file count by user action ([#174](https://github.com/makeomatic/ms-files/issues/174)) ([8fbc6b7](https://github.com/makeomatic/ms-files/commit/8fbc6b71b31563a9c18bc60aa1df2c7341bd3cee))

# [15.0.0](https://github.com/makeomatic/ms-files/compare/v14.8.2...v15.0.0) (2020-01-24)


### Features

* upgrade @microfleet/core to 16 ([e1d8cad](https://github.com/makeomatic/ms-files/commit/e1d8caddd41070eba1eb325b7c43ef6f3c9cf278))


### BREAKING CHANGES

* transient configuration changes, min node is 12.14

## [14.8.2](https://github.com/makeomatic/ms-files/compare/v14.8.1...v14.8.2) (2020-01-14)


### Bug Fixes

* shorten store url toggle description ([#173](https://github.com/makeomatic/ms-files/issues/173)) ([11af0d5](https://github.com/makeomatic/ms-files/commit/11af0d597be18e4ae7e694a925db9267cb79a4a1))

## [14.8.1](https://github.com/makeomatic/ms-files/compare/v14.8.0...v14.8.1) (2020-01-14)


### Bug Fixes

* node 12.14.0 ([b34687b](https://github.com/makeomatic/ms-files/commit/b34687b1575391a7f16fd673798f38db3e4bb6c1))

# [14.8.0](https://github.com/makeomatic/ms-files/compare/v14.7.0...v14.8.0) (2020-01-13)


### Features

* **embed:** add embed option to hide player`s hints ([#172](https://github.com/makeomatic/ms-files/issues/172)) ([2dc12d9](https://github.com/makeomatic/ms-files/commit/2dc12d99db948577ebea7c4a10dd7fece8b14eaa))

# [14.7.0](https://github.com/makeomatic/ms-files/compare/v14.6.2...v14.7.0) (2020-01-07)


### Features

* add store url fields to embed ([#171](https://github.com/makeomatic/ms-files/issues/171)) ([bf64e2a](https://github.com/makeomatic/ms-files/commit/bf64e2aedfc5a9f97de8725dad1b8c8a55172ae6))

## [14.6.2](https://github.com/makeomatic/ms-files/compare/v14.6.1...v14.6.2) (2019-12-10)


### Bug Fixes

* capabilities, dimensions (de)serialization ([04e2215](https://github.com/makeomatic/ms-files/commit/04e2215d64d714a15d71cf5efb761eac6ec38ff1))

## [14.6.1](https://github.com/makeomatic/ms-files/compare/v14.6.0...v14.6.1) (2019-12-10)


### Bug Fixes

* c-pack type errors ([#169](https://github.com/makeomatic/ms-files/issues/169)) ([8b35f76](https://github.com/makeomatic/ms-files/commit/8b35f763448001a8c2a6fe2bc4ca0d70b4378d61))

# [14.6.0](https://github.com/makeomatic/ms-files/compare/v14.5.0...v14.6.0) (2019-12-05)


### Features

* new upload types & params ([#168](https://github.com/makeomatic/ms-files/issues/168)) ([c5a61c6](https://github.com/makeomatic/ms-files/commit/c5a61c6461b63fd06f8bd045fcfe532a0018f413))

# [14.5.0](https://github.com/makeomatic/ms-files/compare/v14.4.0...v14.5.0) (2019-11-27)


### Features

* allow upload videos ([#167](https://github.com/makeomatic/ms-files/issues/167)) ([c1e99d2](https://github.com/makeomatic/ms-files/commit/c1e99d2721f16737fbcb0640ffc0a738811d67d5))

# [14.4.0](https://github.com/makeomatic/ms-files/compare/v14.3.0...v14.4.0) (2019-11-01)


### Features

* node 12.13.0, upgraded all deps ([#165](https://github.com/makeomatic/ms-files/issues/165)) ([947b123](https://github.com/makeomatic/ms-files/commit/947b123))

# [14.3.0](https://github.com/makeomatic/ms-files/compare/v14.2.1...v14.3.0) (2019-10-08)


### Features

* permit spaces in alias and allow empty description ([#163](https://github.com/makeomatic/ms-files/issues/163)) ([e60be03](https://github.com/makeomatic/ms-files/commit/e60be03))

## [14.2.1](https://github.com/makeomatic/ms-files/compare/v14.2.0...v14.2.1) (2019-10-02)


### Bug Fixes

* upgrade deps ([5c9c9cc](https://github.com/makeomatic/ms-files/commit/5c9c9cc))

# [14.2.0](https://github.com/makeomatic/ms-files/compare/v14.1.5...v14.2.0) (2019-10-02)


### Features

* **capp:** add model ui padding embed params ([#160](https://github.com/makeomatic/ms-files/issues/160)) ([e0dda22](https://github.com/makeomatic/ms-files/commit/e0dda22))

## [14.1.5](https://github.com/makeomatic/ms-files/compare/v14.1.4...v14.1.5) (2019-08-23)


### Bug Fixes

* updated style, deps, node 10.16.3 ([7d2f1cb](https://github.com/makeomatic/ms-files/commit/7d2f1cb))

## [14.1.4](https://github.com/makeomatic/ms-files/compare/v14.1.3...v14.1.4) (2019-08-23)


### Bug Fixes

* **tags:** convert to lowercase ([#159](https://github.com/makeomatic/ms-files/issues/159)) ([bfa0df7](https://github.com/makeomatic/ms-files/commit/bfa0df7))

## [14.1.3](https://github.com/makeomatic/ms-files/compare/v14.1.2...v14.1.3) (2019-07-19)


### Bug Fixes

* add metrics support into the router ([#158](https://github.com/makeomatic/ms-files/issues/158)) ([586c222](https://github.com/makeomatic/ms-files/commit/586c222))
* init prometheus in default config ([cd792a2](https://github.com/makeomatic/ms-files/commit/cd792a2))

## [14.1.2](https://github.com/makeomatic/ms-files/compare/v14.1.1...v14.1.2) (2019-07-17)


### Bug Fixes

* storage/pubsub configuration no longer being mutated ([74d7345](https://github.com/makeomatic/ms-files/commit/74d7345))
* update dependencies ([d5d1abf](https://github.com/makeomatic/ms-files/commit/d5d1abf))

## [14.1.1](https://github.com/makeomatic/ms-files/compare/v14.1.0...v14.1.1) (2019-06-13)


### Bug Fixes

* upgrade deps, default to v2 for signed urls ([c73aa2b](https://github.com/makeomatic/ms-files/commit/c73aa2b))

# [14.1.0](https://github.com/makeomatic/ms-files/compare/v14.0.1...v14.1.0) (2019-04-07)


### Features

* split fsort into 2 executions ([#156](https://github.com/makeomatic/ms-files/issues/156)) ([af00829](https://github.com/makeomatic/ms-files/commit/af00829))

## [14.0.1](https://github.com/makeomatic/ms-files/compare/v14.0.0...v14.0.1) (2019-03-14)


### Bug Fixes

* update deps ([1e41884](https://github.com/makeomatic/ms-files/commit/1e41884))

# [14.0.0](https://github.com/makeomatic/ms-files/compare/v13.0.16...v14.0.0) (2019-02-25)


### Features

* hook for cappasity (tags) ([#154](https://github.com/makeomatic/ms-files/issues/154)) ([8ed9f33](https://github.com/makeomatic/ms-files/commit/8ed9f33))


### BREAKING CHANGES

* updated cappasity hooks. New tag updater

## [13.0.16](https://github.com/makeomatic/ms-files/compare/v13.0.15...v13.0.16) (2019-02-09)

## [13.0.15](https://github.com/makeomatic/ms-files/compare/v13.0.14...v13.0.15) (2019-02-09)


### Bug Fixes

* upgrade deps ([0534e12](https://github.com/makeomatic/ms-files/commit/0534e12))

## [13.0.14](https://github.com/makeomatic/ms-files/compare/v13.0.13...v13.0.14) (2018-12-24)


### Bug Fixes

* ensure masterNode is present ([196cab4](https://github.com/makeomatic/ms-files/commit/196cab4))

## [13.0.13](https://github.com/makeomatic/ms-files/compare/v13.0.12...v13.0.13) (2018-12-23)


### Bug Fixes

* stacktrace printing for errors ([9f5548f](https://github.com/makeomatic/ms-files/commit/9f5548f))

## [13.0.12](https://github.com/makeomatic/ms-files/compare/v13.0.11...v13.0.12) (2018-12-23)


### Bug Fixes

* updated audit log ([a300bdd](https://github.com/makeomatic/ms-files/commit/a300bdd))

## [13.0.11](https://github.com/makeomatic/ms-files/compare/v13.0.10...v13.0.11) (2018-12-23)


### Bug Fixes

* updated deps ([96faae5](https://github.com/makeomatic/ms-files/commit/96faae5))

## [13.0.10](https://github.com/makeomatic/ms-files/compare/v13.0.9...v13.0.10) (2018-12-23)


### Bug Fixes

* updated logging ([39ba0b0](https://github.com/makeomatic/ms-files/commit/39ba0b0))
* updated logging signatures ([1ae6da4](https://github.com/makeomatic/ms-files/commit/1ae6da4))

## [13.0.9](https://github.com/makeomatic/ms-files/compare/v13.0.8...v13.0.9) (2018-12-21)


### Bug Fixes

* sentry logger ([876bd10](https://github.com/makeomatic/ms-files/commit/876bd10))
* upgrade deps ([6c3ceb9](https://github.com/makeomatic/ms-files/commit/6c3ceb9))

## [13.0.8](https://github.com/makeomatic/ms-files/compare/v13.0.7...v13.0.8) (2018-12-20)


### Bug Fixes

* sentry logging ([f3d1977](https://github.com/makeomatic/ms-files/commit/f3d1977))

## [13.0.7](https://github.com/makeomatic/ms-files/compare/v13.0.6...v13.0.7) (2018-12-20)


### Bug Fixes

* default config maxTries ([486142f](https://github.com/makeomatic/ms-files/commit/486142f))

## [13.0.6](https://github.com/makeomatic/ms-files/compare/v13.0.5...v13.0.6) (2018-12-20)


### Bug Fixes

* upgrade logger, ensure masterNode exists ([48c34c5](https://github.com/makeomatic/ms-files/commit/48c34c5))

## [13.0.5](https://github.com/makeomatic/ms-files/compare/v13.0.4...v13.0.5) (2018-12-19)


### Bug Fixes

* missing sentry/node ([0c72b88](https://github.com/makeomatic/ms-files/commit/0c72b88))

## [13.0.4](https://github.com/makeomatic/ms-files/compare/v13.0.3...v13.0.4) (2018-12-19)


### Bug Fixes

* missing dep, upgrade deps ([ffb3c8f](https://github.com/makeomatic/ms-files/commit/ffb3c8f))

## [13.0.3](https://github.com/makeomatic/ms-files/compare/v13.0.2...v13.0.3) (2018-12-07)


### Bug Fixes

* upgrade deps ([d468ce6](https://github.com/makeomatic/ms-files/commit/d468ce6))

## [13.0.3](https://github.com/makeomatic/ms-files/compare/v13.0.2...v13.0.3) (2018-12-07)


### Bug Fixes

* upgrade deps ([d468ce6](https://github.com/makeomatic/ms-files/commit/d468ce6))

## [13.0.2](https://github.com/makeomatic/ms-files/compare/v13.0.1...v13.0.2) (2018-11-15)


### Bug Fixes

* upgrades deps, enables health check ([#152](https://github.com/makeomatic/ms-files/issues/152)) ([0516e67](https://github.com/makeomatic/ms-files/commit/0516e67))

## [13.0.1](https://github.com/makeomatic/ms-files/compare/v13.0.0...v13.0.1) (2018-10-07)


### Bug Fixes

* temporarily downgrade ioredis ([#151](https://github.com/makeomatic/ms-files/issues/151)) ([2c9aa58](https://github.com/makeomatic/ms-files/commit/2c9aa58))

# [13.0.0](https://github.com/makeomatic/ms-files/compare/v12.2.0...v13.0.0) (2018-10-04)


### Features

* upgrade ioredis to 4, test sentinel setup ([#150](https://github.com/makeomatic/ms-files/issues/150)) ([f4564c5](https://github.com/makeomatic/ms-files/commit/f4564c5))


### BREAKING CHANGES

* ioredis@4, added sentinel test suite, ensure tests can run in parallel

# [12.2.0](https://github.com/makeomatic/ms-files/compare/v12.1.0...v12.2.0) (2018-09-12)


### Features

* configurable api domain ([#148](https://github.com/makeomatic/ms-files/issues/148)) ([a5f9f9f](https://github.com/makeomatic/ms-files/commit/a5f9f9f))

# [12.1.0](https://github.com/makeomatic/ms-files/compare/v12.0.2...v12.1.0) (2018-09-11)


### Features

* gcs storage 2.0 ([#149](https://github.com/makeomatic/ms-files/issues/149)) ([48fe381](https://github.com/makeomatic/ms-files/commit/48fe381))

## [12.0.2](https://github.com/makeomatic/ms-files/compare/v12.0.1...v12.0.2) (2018-08-13)


### Bug Fixes

* finish provider selector ([d6df0c0](https://github.com/makeomatic/ms-files/commit/d6df0c0))

## [12.0.1](https://github.com/makeomatic/ms-files/compare/v12.0.0...v12.0.1) (2018-08-10)


### Bug Fixes

* downgrade gcs due to cname issues ([bac5cd3](https://github.com/makeomatic/ms-files/commit/bac5cd3))

# [12.0.0](https://github.com/makeomatic/ms-files/compare/v11.1.5...v12.0.0) (2018-08-09)


### Bug Fixes

* verify file exists before setting it as uploaded ([6e70124](https://github.com/makeomatic/ms-files/commit/6e70124))


### BREAKING CHANGES

* node 10.8.0, babel 7

<a name="11.1.5"></a>
## [11.1.5](https://github.com/makeomatic/ms-files/compare/v11.1.4...v11.1.5) (2018-05-24)

<a name="11.1.4"></a>
## [11.1.4](https://github.com/makeomatic/ms-files/compare/v11.1.3...v11.1.4) (2018-05-14)


### Bug Fixes

* **gce:** regression on remove() ([be07193](https://github.com/makeomatic/ms-files/commit/be07193))

<a name="11.1.3"></a>
## [11.1.3](https://github.com/makeomatic/ms-files/compare/v11.1.2...v11.1.3) (2018-05-07)


### Bug Fixes

* **gce:** update deps ([#145](https://github.com/makeomatic/ms-files/issues/145)) ([061fabb](https://github.com/makeomatic/ms-files/commit/061fabb))
