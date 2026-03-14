#!/bin/bash

# creating .npmrc
echo "//$REGISTRY_URL/:_authToken=$REGISTRY_AUTH_TOKEN" > .npmrc

# Publish to NPM
npm publish --registry https://$REGISTRY_URL/ --tag canary
