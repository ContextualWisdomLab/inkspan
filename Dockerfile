# Multi-stage build for the standalone static demo.
# Build:  docker build -t cwl-editor-demo .
# Run:    docker run --rm -p 8080:80 cwl-editor-demo  ->  http://localhost:8080
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
RUN pnpm build:demo

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist-demo /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
