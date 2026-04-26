{
  description = "Lattice — desktop Matrix client";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      pkgsFor = system: nixpkgs.legacyPackages.${system};

      mkLattice = pkgs:
        let
          inherit (pkgs) lib stdenv;
          # Match the major Electron version pinned in package.json. Using a
          # mismatched Electron breaks the matrix-sdk-crypto-wasm V8 ABI.
          electron = pkgs.electron_41;
          nodejs = pkgs.nodejs_22;
          pnpm = pkgs.pnpm;
        in
        stdenv.mkDerivation (finalAttrs: {
          pname = "lattice";
          version = "0.5.0";

          src = lib.fileset.toSource {
            root = ./.;
            fileset = lib.fileset.unions [
              ./package.json
              ./pnpm-lock.yaml
              ./electron.vite.config.ts
              ./postcss.config.js
              ./tsconfig.json
              ./tsconfig.node.json
              ./tsconfig.web.json
              ./components.json
              ./resources
              ./src
            ];
          };

          pnpmDeps = pnpm.fetchDeps {
            inherit (finalAttrs) pname version src;
            # Replace with `nix hash convert --to sri --hash-algo sha256 ...`
            # output after the first build fails with a hash mismatch.
            hash = lib.fakeHash;
          };

          nativeBuildInputs = [
            nodejs
            pnpm.configHook
            pkgs.makeWrapper
          ] ++ lib.optionals stdenv.hostPlatform.isLinux [
            pkgs.copyDesktopItems
          ];

          desktopItems = lib.optionals stdenv.hostPlatform.isLinux [
            (pkgs.makeDesktopItem {
              name = "lattice";
              desktopName = "Lattice";
              comment = "Desktop Matrix client";
              exec = "lattice %U";
              icon = "lattice";
              terminal = false;
              categories = [ "Network" "InstantMessaging" ];
              mimeTypes = [ "x-scheme-handler/lattice" ];
            })
          ];

          # electron-vite build only needs the JS toolchain — skip pulling
          # the Electron binary at install time; we link the nixpkgs one in
          # the wrapper instead.
          env.ELECTRON_SKIP_BINARY_DOWNLOAD = "1";

          buildPhase = ''
            runHook preBuild

            pnpm run build

            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            mkdir -p $out/share/lattice
            cp -r out node_modules package.json $out/share/lattice/

            install -Dm644 resources/icon.png \
              $out/share/icons/hicolor/512x512/apps/lattice.png

            makeWrapper ${lib.getExe electron} $out/bin/lattice \
              --add-flags $out/share/lattice \
              --set LATTICE_DISABLE_AUTO_UPDATE 1

            runHook postInstall
          '';

          meta = {
            description = "Lattice — desktop Matrix client";
            homepage = "https://github.com/Newspicel/lattice";
            license = lib.licenses.mit;
            mainProgram = "lattice";
            platforms = lib.platforms.linux ++ lib.platforms.darwin;
            sourceProvenance = [ lib.sourceTypes.fromSource ];
          };
        });
    in
    {
      packages = forAllSystems (system: rec {
        lattice = mkLattice (pkgsFor system);
        default = lattice;
      });

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/lattice";
        };
      });

      devShells = forAllSystems (system:
        let pkgs = pkgsFor system; in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              pkgs.pnpm
              pkgs.electron_41
            ];
          };
        });

      formatter = forAllSystems (system: (pkgsFor system).nixpkgs-fmt);
    };
}
