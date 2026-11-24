# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:25-slim AS build
RUN npm install --global pnpm@12.23.0
WORKDIR /src

# Lockfile-only layer: dependency download is cached until the lockfile moves.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --offline --frozen-lockfile --filter @plinth/api... \
 && pnpm --filter @plinth/api... build \
 && pnpm --filter @plinth/api deploy --prod --legacy /out

FROM gcr.io/distroless/nodejs24-debian12:nonroot
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
EXPOSE 8787
CMD ["--import", "./dist/telemetry.js", "dist/server.js"]
