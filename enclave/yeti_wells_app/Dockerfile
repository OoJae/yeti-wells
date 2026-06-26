# Build + run the Yeti Wells Nautilus enclave server, for deployment on Marlin Oyster.
# Place at: nautilus/src/nautilus-server/Dockerfile  (after wiring the yeti-wells app — see docs/NAUTILUS.md §2)
# Build:  docker build -t yeti-wells-enclave .   (from nautilus/src/nautilus-server/)
#
# The container runs the axum server on :3000 exposing /process_data + /health_check (the enclave's ed25519
# ephemeral pubkey). Oyster's CVM provides the genuine Nitro attestation (PCRs via `oyster-cvm verify`).
FROM rust:slim-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev ca-certificates git && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
# rust-toolchain.toml (if present) pins the compiler. Build with our app feature.
RUN cargo build --release --features yeti-wells

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /src/target/release/nautilus-server /app/nautilus-server
COPY src/apps/yeti-wells/allowed_endpoints.yaml /app/allowed_endpoints.yaml
EXPOSE 3000
CMD ["/app/nautilus-server"]
