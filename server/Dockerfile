# Yeti Wells backend — deterministic Railway build (avoids nixpacks' flaky nix-env step).
# Runs the TypeScript Enoki-sponsor + attestation server directly via tsx on Node 22.
FROM node:22-slim
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Railway injects env vars (incl. PORT) at runtime; the server reads process.env.PORT (default 3001).
CMD ["node_modules/.bin/tsx", "index.ts"]
