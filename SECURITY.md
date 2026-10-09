# Security policy

This is a personal, single-user project maintained by one person. The technical security design is
in [docs/security/SECURITY-MODEL.md](docs/security/SECURITY-MODEL.md).

## Reporting a vulnerability

If you find a security problem, please **don't open a public issue**. Instead:

- Use GitHub's **private vulnerability reporting** ("Security" tab → "Report a vulnerability") on
  this repository, once it's hosted on GitHub and the feature is enabled, or
- contact the repository owner privately through their GitHub profile.

Please include what you found, how to reproduce it, and its impact. I aim to acknowledge reports
within 7 days. As a personal project, there is no bug bounty.

## Handling process (for the maintainer)

1. **Contain first.** If a credential may be exposed (committed, logged, pasted, screenshotted):
   1. **Revoke/rotate it immediately** in Google Cloud (delete the service-account key and create a
      new one). Deleting the file or the commit is _not_ enough, because Git history, forks and
      CI logs keep copies.
   2. Check the Google Cloud audit logs for use of the old key.
   3. Only then clean the history if needed, and document what happened.
2. **If personal order data is exposed** (public URL, bundle, log, issue): take the exposure
   offline, then remove the data. Check whether the spreadsheet's sharing settings changed.
3. **Fix** on a branch, with a regression test where possible. Run `npm run check` and
   `npm run audit:deps`.
4. **Record** a short note in `docs/security/` describing the cause, the fix, and how the gap was
   closed.

## Supported versions

Only the latest commit on `main` is supported.
