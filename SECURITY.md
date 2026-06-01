# Security Policy

## Reporting a Vulnerability

**Do not open a public issue.** Instead, please report security vulnerabilities privately.

Send an email describing the vulnerability to the project maintainer. Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive a response within 48 hours. Once resolved, the vulnerability will be disclosed publicly after a patch is released.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Best Practices

- Never commit `.env.local` or service account JSON files
- Rotate API keys regularly
- Use passcode protection when deploying publicly
- Keep dependencies updated (`npm audit`)
