# SNL CLI Manual

This manual records the normative CLI product surface. A command is currently implemented only when its canonical path appears in machine-readable `snl --help`; absent commands are planned contracts and must not be emulated with a different operation.

## `snl init`

* `--root <path>`
* `--json`

## `snl info`

* `--root <path>`
* `--json`

## `snl validate`

* `--root <path>`
* `--json`

## `snl import`

* `--root <path>`
* `--input <file|->`
* `--json`

## `snl migrate`

* `--root <path>`
* `--to <schema-version>`
* `--json`

## `snl snoogl`

* `--query <text>`
* `--root <path>`
* `--mode <entry|macro>`
* `--json`

## `snl entry`

### `snl entry list`

* `--root <path>`
* `--query <text>`
* `--cursor <token>`
* `--limit <number>`
* `--json`

### `snl entry get`

* `<entry-id>`
* `--root <path>`
* `--json`

### `snl entry check`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl entry create`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl entry update`

* `<entry-id>`
* `--root <path>`
* `--if-match <revision>`
* `--input <file|->`
* `--json`

### `snl entry rename`

* `<entry-id>`
* `--to <new-entry-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl entry delete`

* `<entry-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl entry latex`

* `<entry-id>`
* `--root <path>`
* `--json`

### `snl entry references`

* `<entry-id>`
* `--root <path>`
* `--json`

### `snl entry relationships`

* `<entry-id>`
* `--root <path>`
* `--direction <incoming|outgoing|both>`
* `--json`

### `snl entry package`

#### `snl entry package get`

* `<entry-id>`
* `--root <path>`
* `--json`

#### `snl entry package set`

* `<entry-id>`
* `<entry-package-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

## `snl macro`

### `snl macro list`

* `--root <path>`
* `--query <text>`
* `--cursor <token>`
* `--limit <number>`
* `--json`

### `snl macro get`

* `<macro-id>`
* `--root <path>`
* `--json`

### `snl macro check`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl macro create`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl macro update`

* `<macro-id>`
* `--root <path>`
* `--if-match <revision>`
* `--input <file|->`
* `--json`

### `snl macro rename`

* `<macro-id>`
* `--to <new-macro-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl macro delete`

* `<macro-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl macro preview`

* `<macro-id>`
* `--root <path>`
* `--style <style-name>`
* `--json`

### `snl macro usages`

* `<macro-id>`
* `--root <path>`
* `--json`

## `snl entry-kind`

### `snl entry-kind list`

* `--root <path>`
* `--query <text>`
* `--cursor <token>`
* `--limit <number>`
* `--json`

### `snl entry-kind get`

* `<entry-kind-id>`
* `--root <path>`
* `--json`

### `snl entry-kind create`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl entry-kind update`

* `<entry-kind-id>`
* `--root <path>`
* `--if-match <revision>`
* `--input <file|->`
* `--json`

### `snl entry-kind delete`

* `<entry-kind-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl entry-kind usages`

* `<entry-kind-id>`
* `--root <path>`
* `--json`

## `snl macro-kind`

### `snl macro-kind list`

* `--root <path>`
* `--query <text>`
* `--cursor <token>`
* `--limit <number>`
* `--json`

### `snl macro-kind get`

* `<macro-kind-id>`
* `--root <path>`
* `--json`

### `snl macro-kind create`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl macro-kind update`

* `<macro-kind-id>`
* `--root <path>`
* `--if-match <revision>`
* `--input <file|->`
* `--json`

### `snl macro-kind delete`

* `<macro-kind-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl macro-kind usages`

* `<macro-kind-id>`
* `--root <path>`
* `--json`

## `snl entry-package`

### `snl entry-package list`

* `--root <path>`
* `--query <text>`
* `--cursor <token>`
* `--limit <number>`
* `--json`

### `snl entry-package get`

* `<entry-package-id>`
* `--root <path>`
* `--json`

### `snl entry-package create`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl entry-package update`

* `<entry-package-id>`
* `--root <path>`
* `--if-match <revision>`
* `--input <file|->`
* `--json`

### `snl entry-package delete`

* `<entry-package-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl entry-package export`

* `<entry-package-id>`
* `--root <path>`
* `--output <path>`
* `--json`

## `snl macro-package`

### `snl macro-package list`

* `--root <path>`
* `--query <text>`
* `--cursor <token>`
* `--limit <number>`
* `--json`

### `snl macro-package get`

* `<macro-package-id>`
* `--root <path>`
* `--json`

### `snl macro-package create`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl macro-package update`

* `<macro-package-id>`
* `--root <path>`
* `--if-match <revision>`
* `--input <file|->`
* `--json`

### `snl macro-package delete`

* `<macro-package-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl macro-package members`

* `<macro-package-id>`
* `--root <path>`
* `--json`

### `snl macro-package add-member`

* `<macro-package-id>`
* `<macro-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl macro-package remove-member`

* `<macro-package-id>`
* `<macro-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl macro-package export`

* `<macro-package-id>`
* `--root <path>`
* `--output <path>`
* `--json`

## `snl relationship`

### `snl relationship list`

* `--root <path>`
* `--query <text>`
* `--cursor <token>`
* `--limit <number>`
* `--json`

### `snl relationship get`

* `<relationship-id>`
* `--root <path>`
* `--json`

### `snl relationship create`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl relationship update`

* `<relationship-id>`
* `--root <path>`
* `--if-match <revision>`
* `--input <file|->`
* `--json`

### `snl relationship delete`

* `<relationship-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl relationship incoming`

* `<entity-id>`
* `--root <path>`
* `--json`

### `snl relationship outgoing`

* `<entity-id>`
* `--root <path>`
* `--json`

### `snl relationship between`

* `<source-id>`
* `<target-id>`
* `--root <path>`
* `--json`

### `snl relationship generate`

* `--root <path>`
* `--library <library-slug>`
* `--json`

## `snl library`

### `snl library list`

* `--root <path>`
* `--query <text>`
* `--cursor <token>`
* `--limit <number>`
* `--json`

### `snl library get`

* `<library-slug>`
* `--root <path>`
* `--json`

### `snl library check`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl library create`

* `--root <path>`
* `--input <file|->`
* `--json`

### `snl library update`

* `<library-slug>`
* `--root <path>`
* `--if-match <revision>`
* `--input <file|->`
* `--json`

### `snl library rename`

* `<library-slug>`
* `--to <new-library-slug>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl library delete`

* `<library-slug>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl library tree`

* `<library-slug>`
* `--root <path>`
* `--language <language-tag>`
* `--json`

### `snl library add-entry`

* `<library-slug>`
* `<entry-id>`
* `--root <path>`
* `--parent <entry-id>`
* `--after <entry-id>`
* `--if-match <revision>`
* `--json`

### `snl library move-entry`

* `<library-slug>`
* `<entry-id>`
* `--root <path>`
* `--parent <entry-id>`
* `--after <entry-id>`
* `--if-match <revision>`
* `--json`

### `snl library remove-entry`

* `<library-slug>`
* `<entry-id>`
* `--root <path>`
* `--if-match <revision>`
* `--json`

### `snl library html`

* `<library-slug>`
* `--root <path>`
* `--output <path>`
* `--json`

### `snl library export`

* `<library-slug>`
* `--root <path>`
* `--format <format>`
* `--output <path>`
* `--json`

## `snl batch`

### `snl batch check`

* `--root <path>`
* `--input <file|directory|->`
* `--json`

### `snl batch apply`

* `--root <path>`
* `--input <file|directory|->`
* `--json`
