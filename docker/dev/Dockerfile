FROM node:22-bookworm-slim

COPY ./docker/dev/requirements.txt .

RUN apt-get update && apt-get install -y $(cat requirements.txt) \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 3000 9229

WORKDIR /workspace

# Copy only the files needed at build time. The dev container mounts the workspace
# at runtime, so a recursive COPY of the repo would only inflate the image and
# could leak host-side files. All copies are root-owned and read-only.
COPY --chown=root:root --chmod=444 package.json ./
COPY --chown=root:root --chmod=444 package-lock.json ./
COPY --chown=root:root --chmod=444 tsconfig.json ./
COPY --chown=root:root --chmod=444 tsconfig.build.json ./
COPY --chown=root:root --chmod=444 nest-cli.json ./
COPY --chown=root:root --chmod=555 src ./src
COPY --chown=root:root --chmod=555 test ./test

# Pre-create node_modules with node ownership: the dev compose mounts an anonymous
# volume there at runtime, and Docker preserves the existing dir's ownership.
RUN mkdir -p /workspace/node_modules \
    && chown -R node:node /workspace/node_modules

# Entrypoint is read+execute only, root-owned (immutable).
COPY --chown=root:root --chmod=555 ./docker/dev/entrypoint.sh /tmp/entrypoint.sh

USER node

ENTRYPOINT [ "/usr/bin/tini", "--", "/bin/bash", "/tmp/entrypoint.sh" ]
