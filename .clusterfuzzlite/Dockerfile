FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2
WORKDIR /src
RUN corepack enable && chown -R node:node /src
USER node
COPY --chown=node:node . .
RUN test -f package.json || (echo "::error title=ClusterFuzzLite Docker context::Build with repository root context: docker build -f .clusterfuzzlite/Dockerfile ." && exit 64)
RUN pnpm install --frozen-lockfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node --version >/dev/null || exit 1
CMD ["pnpm", "test", "--", "--run"]
