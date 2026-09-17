# Security policy

Security fixes target the latest `main` branch and latest release. Settlement is a local single-player application. The optional worker binds to `127.0.0.1`, uses a local SQLite database, and is not a production multi-user server.

Keep provider credentials in the server process environment. Do not place them in browser code, exported runs, screenshots or public issues. Live model calls are opt-in. Configure the provider's account limits as well as Settlement's local budget controls.

Browser saves are user-controlled game data, not a server-authoritative economy. Replay checks detect record changes; they are not cryptographic signatures or proof of broad agent safety.

## Report a vulnerability

Use GitHub's **Security → Report a vulnerability** on this repository to submit a private report. Include affected versions, reproduction steps, expected impact and a minimal example without live credentials or unnecessary personal data. Do not publish exploitable details or credentials in an issue.

If private reporting is temporarily unavailable, open an issue asking the maintainer for a private reporting channel without including exploit details. No response-time guarantee is implied.
