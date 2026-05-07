FROM node:22-bookworm-slim

COPY ./docker/dev/requirements.txt .

RUN apt-get update && apt-get install -y $(cat requirements.txt) \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 3000 9229

WORKDIR /workspace

# Copy only the files needed at build time. The dev container mounts the workspace
# at runtime, so a recursive COPY of the repo would only inflate the image.
COPY --chown=node:node package.json package-lock.json* tsconfig*.json nest-cli.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node test ./test

# Pre-create node_modules with node ownership: the dev compose mounts an anonymous
# volume there, and Docker preserves the existing dir's ownership.
RUN mkdir -p /workspace/node_modules \
    && chown -R node:node /workspace

COPY --chown=node:node ./docker/dev/entrypoint.sh /tmp/entrypoint.sh
RUN chmod +x /tmp/entrypoint.sh

USER node

ENTRYPOINT [ "/usr/bin/tini", "--", "/bin/bash", "/tmp/entrypoint.sh" ]
