#!/bin/bash
# Prepare NATS configuration by substituting environment variables
# Usage: ./scripts/prepare-nats-config.sh <env>
# env: dev, staging, or prod

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <env>"
  echo "Example: $0 staging"
  exit 1
fi

ENV="$1"
CONFIG_TEMPLATE="config/nats/nats-${ENV}.conf"
CONFIG_OUTPUT="config/nats/nats-${ENV}-runtime.conf"

# Check if template exists
if [ ! -f "$CONFIG_TEMPLATE" ]; then
  echo "Error: Configuration template not found: $CONFIG_TEMPLATE"
  exit 1
fi

# Check if required environment variables are set
if [ -z "$NATS_USER" ]; then
  echo "Warning: NATS_USER is not set. Using default 'nats_user'"
  NATS_USER="nats_user"
fi

if [ -z "$NATS_PASSWORD" ]; then
  echo "Error: NATS_PASSWORD is required but not set."
  exit 1
fi

echo "Preparing NATS configuration for environment: $ENV"

# Generate bcrypt hash from plaintext password
echo "Generating bcrypt hash from NATS_PASSWORD..."
NATS_BCRYPT_PASSWORD=$(docker run --rm -i natsio/nats-box:latest nats server passwd <<PASSWORD_EOF
$NATS_PASSWORD
$NATS_PASSWORD
PASSWORD_EOF
)

# Export variables for envsubst
export NATS_USER NATS_BCRYPT_PASSWORD

# Substitute environment variables
envsubst < "$CONFIG_TEMPLATE" > "$CONFIG_OUTPUT"

echo "Configuration prepared: $CONFIG_OUTPUT"
echo "NATS user: $NATS_USER"
echo "Bcrypt password: [REDACTED]"
