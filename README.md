# 🔗 LinXup - AI-Powered Broken Link Checker

> An intelligent broken link checker that doesn't just find broken links—it explains what broke, why it matters, and suggests fixes.

**LinXup** is built for nonprofits and businesses that need more than just a list of 404s. Powered by GPT-4, LinXup analyzes your broken links in context and provides actionable insights.

## What Makes LinXup Different

Instead of just saying "Link is broken (404)", LinXup tells you:

✅ **What the link was supposed to be** - AI analyzes surrounding context
✅ **Why it matters** - Prioritizes by business impact (donation buttons = critical)
✅ **How to fix it** - Suggests replacement URLs using Wayback Machine + GPT-4
✅ **Where it appears** - Shows context (navigation vs footer)

## Status

**Current Version:** 0.1.0 (Development)

LinXup is based on [Linkinator](https://github.com/JustinBeckwith/linkinator) - a powerful open-source link checker by Justin Beckwith. We're extending it with AI analysis and SaaS features.

### Roadmap

- ✅ **Week 1:** Core link checking functionality (inherited from Linkinator)
- 🚧 **Week 2:** PostgreSQL database integration
- 🚧 **Week 3:** OpenAI GPT-4 integration for link analysis
- 📋 **Week 4-5:** API and scheduled scanning
- 📋 **Week 6-7:** Multi-user support and billing
- 📋 **Week 8-9:** Web frontend (Next.js)
- 📋 **Week 10:** Alaska Impact Alliance pilot launch

## Installation

```sh
npm install
npm run build
```

## Basic Usage

```sh
# Check a website
node build/src/cli.js https://example.com --recurse

# Check local files
node build/src/cli.js ./path/to/files --recurse

# Check markdown files
node build/src/cli.js ./README.md --markdown
```

## Features (Inherited from Linkinator)

- 🔥 Scan remote sites or local files
- 🔥 Check all link types (not just `<a href>`)
- 🔥 Supports redirects, absolute/relative links
- 🔥 Configure regex patterns to skip
- 🔥 Scan markdown files
- 🔥 JSON/CSV output formats
- 🔥 Concurrent link checking

## Coming Soon: AI Features

- 🤖 GPT-4 analysis of broken links
- 🤖 Automatic priority scoring
- 🤖 Intelligent fix suggestions
- 🤖 Historical tracking and trends
- 🤖 Scheduled scans with alerts
- 🤖 Web dashboard

## For Nonprofits

LinXup is being built specifically with nonprofit needs in mind:
- Affordable pricing ($24.50/mo after pilot)
- Easy-to-understand reports
- Actionable insights (not just technical data)
- Designed for non-technical staff

## Development

```sh
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Fix linting issues
npm run fix
```

## Tech Stack

- **Core:** TypeScript/Node.js (forked from Linkinator)
- **Database:** PostgreSQL (coming soon)
- **AI:** OpenAI GPT-4 (coming soon)
- **Queue:** Bull + Redis (coming soon)
- **API:** Express REST API (coming soon)
- **Frontend:** Next.js + shadcn/ui (coming soon)

## License

MIT License

LinXup is based on [Linkinator](https://github.com/JustinBeckwith/linkinator) by Justin Beckwith.
See NOTICE.txt for attribution details.

## Author

jbuz13

---

**First Customer:** Alaska Impact Alliance (6-month free pilot launching Week 10)
