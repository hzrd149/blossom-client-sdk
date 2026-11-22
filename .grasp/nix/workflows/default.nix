{ pkgs }:
let
  # Playwright downloads the browser revisions selected by pnpm-lock.yaml.
  # An FHS environment supplies their Linux loader and shared libraries, rather
  # than substituting nixpkgs' potentially different Playwright browser versions.
  browserLibraries = with pkgs.playwright-driver.components; (
    chromium.buildInputs ++ firefox.buildInputs ++ webkit.buildInputs
  );
  command = name: script: pkgs.buildFHSEnv {
    inherit name;
    targetPkgs = p: [
      p.nodejs_22
      p.pnpm_10
      p.deno
      p.bun
      p.bash
      p.coreutils
      p.git
      p.cacert
      p.fontconfig
      p.dejavu_fonts
      p.glibc
    ] ++ browserLibraries;
    profile = ''
      export CI=true
      export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
      export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu-24.04
    '';
    runScript = pkgs.writeShellScript "${name}-run" ''
      set -euo pipefail
      ${script}
    '';
  };
  browser = name: command name ''
    pnpm exec playwright install ${name}
    pnpm test:browser --browser.name=${name}
  '';
in
{
  install = command "install" "pnpm install --frozen-lockfile";
  node = command "node" "pnpm test:node";
  deno = command "deno" "pnpm test:deno";
  bun = command "bun" "pnpm test:bun";
  chromium = browser "chromium";
  firefox = browser "firefox";
  webkit = browser "webkit";
}
