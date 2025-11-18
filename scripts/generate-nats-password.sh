#!/bin/bash
# Generate bcrypt hashed password for NATS
# Usage: ./scripts/generate-nats-password.sh <password>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <password>"
  echo "Example: $0 mySecurePassword123"
  exit 1
fi

PASSWORD="$1"

echo "Generating bcrypt hash for NATS password..."
echo ""

# Use NATS docker image to generate bcrypt hash
docker run --rm nats:latest nats server passwd <<EOF
$PASSWORD
$PASSWORD
EOF

echo ""
echo "Copy the generated hash to your NATS configuration file"
