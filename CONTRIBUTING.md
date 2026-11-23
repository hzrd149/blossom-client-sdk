# Contributing

## Testing

Install dependencies with `pnpm install --frozen-lockfile`.

- `pnpm test`: the Node Vitest suite.
- `pnpm test:browser`: the Vitest suite, including DOM/media tests, in headless Chromium, Firefox, and WebKit.
  Install browsers first with `pnpm exec playwright install --with-deps`.
  To run one browser, append `--browser.name=chromium` (or `firefox` / `webkit`).
- `pnpm test:node`, `pnpm test:deno`, `pnpm test:bun`: build the package and run the **same full Vitest suite**
  in the selected runtime, followed by the same built-package export and HTTP integration tests.
  Install Deno 2 or Bun for their respective commands. Worker runtime checks prevent accidental fallback to Node.
  DOM-only tests run in browsers; Buffer-only tests run in server runtimes.
  Deno needs `-A` for Vitest's workers, module loading, and local servers. TypeScript is checked during the build.
- `pnpm test:all`: run all of the above (requires all runtimes and browsers).

GitHub Actions runs the full suite across supported Node versions, Deno 2, the latest Bun, and all three browser engines.

### ngit CI

Contributing via ngit or curious about ngit CI? See [ngit.dev](https://ngit.dev/) for more information.

The native [ngit CI workflow](https://ngit.dev/ci/workflows/) is `.grasp/nix/workflows/ci.yaml`.
It runs the same scripts in six independent jobs: Node 22, Deno, Bun, Chromium, Firefox, and WebKit.
The root `flake.lock` pins the Nix toolchain; `pnpm-lock.yaml` pins JavaScript dependencies and Playwright browser revisions.
Jobs require an x86_64 Linux provider with network access for package/browser downloads and support for
Bubblewrap's FHS environment (user namespaces). No repository secrets are needed.

With Nix flakes enabled, validate and run commands locally from this checkout:

```sh
nix flake check --no-build
nix run .#install
nix run .#node
nix run .#deno
nix run .#bun
nix run .#chromium
nix run .#firefox
nix run .#webkit
```

A maintainer must arrange a coordinator/provider and authorize the coordinator before automatic runs:

```sh
ngit ci request <coordinator-npub>
# After publishing the committed workflow to the repository:
ngit ci trigger <coordinator-npub> HEAD --workflow .grasp/nix/workflows/ci.yaml
ngit ci status HEAD --json --require-ci-trust maintainer-directed
```

The workflow responds to pushes and pull requests targeting `master`. Adding it alone does not activate a hosted CI service.
