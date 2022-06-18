# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). For details on
what is and isn't covered by the project's backwards compatibility promise, see [the README](./README.md#backwards-compatibility).

## [1.1.0] - 2022-06-18

### Added

Added support for passing through "ignore file" options to glob package. Please be aware that there
are [known performance issues](https://github.com/sindresorhus/globby/issues/50) with these options
at the time of writing.

### Changed

Removed intermediary library used for reading globbed files (`glob-reader`). The underlying glob
package `globby` is still in use, so there should be no visible difference to behaviour.

Compiled with a new version of Typescript - `v4.7.4`.

## [1.0.6] - 2022-06-09

Packaging fixes for previous release.

## [1.0.5] - 2022-06-09

### Fixed

Supplying a base path to the checker that contains trailing path separators will no longer result
in spurious errors.
