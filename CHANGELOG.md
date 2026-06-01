# Changelog

All notable changes to this project are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- DeepSeek V4 Flash AI provider with reasoning support
- Prompt assembly system (system/user/tone separation)
- Ashby job board scraper
- Cloud storage with Upstash Redis
- Profile management (multiple profiles per user)
- Resume and cover letter template management
- Rate limiting for API routes
- Input sanitization against prompt injection
- Passcode-based authentication
- Job queue with progress tracking
- Company research and cold email generation
- Application Q&A generation with word/character limits
- External job portal links (Handshake, LinkedIn, etc.)
- Compact collapsible sidebar with search and filters
- Mobile responsive design

### Changed
- Migrated from Gemini/Claude to DeepSeek V4 Flash
- Replaced research step with manual research parameter
- Refactored prompts into system/user/tone modules
- Improved scraper architecture with unified interface

## [0.1.0] — 2025-12

### Added
- Initial release
- Resume and cover letter tailoring with AI
- H-1B company browser (732 companies, 4 tiers)
- Multi-platform job scraping (Greenhouse, Lever, Workday)
- Google Sheets application tracking
- LaTeX resume/cover letter generation
- DOL LCA data pipeline (FY2025 Q1-Q4)
