# Dependency security review — 2026-10-05

`npm audit` reports five high-severity entries originating from one advisory:
https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

Dependency chain: `eslint-config-next@16.3.6` → `@next/eslint-plugin-next@16.3.6` → `fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`.

The advisory describes stack exhaustion from deeply nested brace patterns. At review time the latest published braces version is 3.0.3 and the advisory lists no patched version. This finding remains unresolved; it has not been suppressed or marked fixed.

The installed chain is development lint tooling. `npm audit --omit=dev` reports zero vulnerabilities at this review, which is not a guarantee of application security. Avoid running lint/build tooling with production credentials on untrusted contributions. Production runtime installations should not include development tooling.

Do not run `npm audit fix --force`: its current suggested change downgrades eslint-config-next to 14.2.35, mismatching the installed Next.js 16.3.6 framework. Recheck upstream for a compatible fix before changing versions. Keep the framework and its lint configuration aligned.

Recheck with `npm audit`, `npm audit --omit=dev`, and `npm ls braces micromatch fast-glob @next/eslint-plugin-next`. After any eventual fix, rerun lint, unit tests, the production build, and payment UI smoke tests.
