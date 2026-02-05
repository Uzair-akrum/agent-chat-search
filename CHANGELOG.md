# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-05

### Added

- `--list-sessions` flag for browsing sessions without searching
- Session info display (message count, topic preview)
- Friendly help message when query is missing

### Changed

- Query is now optional when using `--list-sessions`

## [1.1.0] - 2026-02-05

### Added

- Snippet extraction to prevent context window overflow
- Token budget management with `--max-tokens`
- `--output-mode` flag (snippet/full/summary)
- `--snippet-size` customization
- Session position metadata (e.g., "message 15/42")
- Truncation indicators with percentage

### Changed

- Default output mode is now "snippet" instead of full content
- Estimated token count shown in output

## [1.0.0] - 2026-02-04

### Added

- Initial release
- Support for Claude Code sessions
- Support for Kimi sessions
- Basic search functionality
- Role filtering (--role)
- Context lines (--context)
- Work directory filtering (--work-dir)
- JSON output (--json)
- Cross-agent search (--all)

[1.2.0]: https://github.com/Uzair-akrum/agent-chat-search/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Uzair-akrum/agent-chat-search/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Uzair-akrum/agent-chat-search/releases/tag/v1.0.0
