#!/bin/bash

set -e

if [ ! -d node_modules ]; then
  npm install --legacy-peer-deps --no-prepare
fi

npx nest start --watch
