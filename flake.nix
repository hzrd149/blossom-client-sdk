{
  description = "blossom-client-sdk CI toolchains";

  inputs.nixpkgs.url = "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.zst";

  outputs = { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      commands = import ./.grasp/nix/workflows { inherit pkgs; };
    in
    {
      ngit-ci.commands.${system} = commands;
      apps.${system} = builtins.mapAttrs (name: command: {
        type = "app";
        program = "${command}/bin/${name}";
      }) commands;
    };
}
