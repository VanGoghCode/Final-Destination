# Security Policy

## Reporting a Vulnerability

**Do not open a public issue.** Report vulnerabilities privately to:

- Email: [maintainer email — replace before publishing]
- PGP key: [PGP public key URL or fingerprint — replace before publishing]

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Disclosure Timeline

- Acknowledgment: within 48 hours
- Status update: within 5 business days
- Patch release: within 30 days (critical: 7 days)
- Public disclosure: after patch is released

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Scope

- `src/app/api/` — all API route handlers
- `src/lib/ai-providers/` — AI provider integrations
- `src/lib/auth.ts` — credential handling
- `src/lib/db.ts` — Redis interactions
- `src/lib/sanitize.ts` — input sanitation
- `extension/` — browser extension

## Out of Scope

- Demo/test instances without production data
- Social engineering attacks
- DoS attacks (rate limiting is handled separately)

## Security Best Practices for Deployers

- Never commit `.env.local` or service account JSON files
- Rotate API keys every 90 days
- Deploy behind a VPN or use IP allowlists for admin routes
- Keep dependencies updated (`npm audit`)
- Use environment variable injection at runtime (Docker, Vercel)
