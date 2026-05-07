FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Pre-create node_modules with the right ownership: when docker compose mounts an
# anonymous/named volume on /workspace/node_modules, Docker preserves the ownership
# of the existing target dir, so the non-root user can write into it.
RUN mkdir -p /workspace/node_modules \
    && chown -R node:node /workspace

COPY --chown=node:node ./docker/test/entrypoint.sh /tmp/entrypoint.sh
RUN chmod +x /tmp/entrypoint.sh

USER node

ENTRYPOINT [ "/usr/bin/tini", "--", "/bin/bash", "/tmp/entrypoint.sh" ]
