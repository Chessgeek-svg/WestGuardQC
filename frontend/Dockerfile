# Build the SPA, then serve the static output. The runtime image carries nginx
# and the compiled assets only, with no Node and no source.
FROM node:20-alpine AS build

WORKDIR /app

# Copy manifests first so a source-only change reuses the cached install layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# 127.0.0.1 rather than localhost: the container resolves localhost to ::1
# first, and nginx's `listen 80` binds IPv4 only, so the check would be refused
# against a server that is serving perfectly well.
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=5 \
    CMD ["wget", "--spider", "-q", "http://127.0.0.1/"]
