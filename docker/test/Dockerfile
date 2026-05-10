FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Pre-create node_modules with the right ownership: when docker compose mounts an
# anonymous/named volume on /workspace/node_modules, Docker preserves the ownership
# of the existing target dir, so the non-root user can write into it.
RUN mkdir -p /workspace/node_modules \
    && chown -R node:node /workspace

# Copy as root, read+execute only - the entrypoint is intentionally immutable.
COPY --chown=root:root --chmod=555 ./docker/test/entrypoint.sh /tmp/entrypoint.sh

USER node

ENTRYPOINT [ "/usr/bin/tini", "--", "/bin/bash", "/tmp/entrypoint.sh" ]
