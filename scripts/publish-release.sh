#!/bin/bash
set -euo pipefail

# Strip https:// to get the bare host for .npmrc
REGISTRY_HOST="${REGISTRY_URL#https://}"

# Write .npmrc auth for the registry
echo "//$REGISTRY_HOST/:_authToken=$REGISTRY_AUTH_TOKEN" > .npmrc

# Publish to the release registry
npm publish --registry "https://$REGISTRY_HOST" --access public
