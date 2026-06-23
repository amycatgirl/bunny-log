{
  description = "A very basic flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }: let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
    devShells.${system}.default = pkgs.mkShell {
      buildInputs = with pkgs; [corepack nodejs-slim python3 typescript-language-server];
    };
  };
}
