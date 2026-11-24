# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:24-slim AS build
RUN npm install --global pnpm@12.23.0
WORKDIR /src
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @plinth/api... \
 && pnpm --filter @plinth/api... build \
 && pnpm --filter @plinth/api deploy --prod --legacy /out

FROM gcr.io/distroless/nodejs24-debian12:nonroot
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
EXPOSE 8787
CMD ["--import", "./dist/telemetry.js", "dist/server.js"]
