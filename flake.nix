{
  description = "Bunny Log development shell";

  inputs = {
    nixpkgs.url = "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.zst";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs supportedSystems (system: f (builtins.getAttr system nixpkgs.legacyPackages));
    in
    {
      devShells = forAllSystems (
        {
          mkShell,
          pnpm,
          python3,
          typescript-language-server,
          atproto-goat,
          biome,
          ...
        }:
        {
          default = mkShell {
            buildInputs = [
              pnpm
              python3
              typescript-language-server
              atproto-goat
              biome
            ];
          };
        }
      );
    };
}
