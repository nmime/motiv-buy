# NATS Configuration

This directory contains NATS server configuration files for different environments.

## Security

NATS is configured with **bcrypt-hashed passwords** for enhanced security instead of plaintext passwords.

### Files

- `nats-dev.conf` - Development configuration (no authentication by default)
- `nats-staging.conf` - Staging configuration template (requires bcrypt password)
- `nats-production.conf` - Production configuration template (requires bcrypt password)
- `nats-*-runtime.conf` - Generated runtime configurations (created during deployment)

## Generating Bcrypt Passwords

### Using the Script

```bash
./scripts/generate-nats-password.sh <your-password>
```

### Manual Generation

```bash
docker run --rm -i natsio/nats-box:latest nats server passwd <<EOF
your-password-here
your-password-here
EOF
```

This will output a bcrypt hash like:
```
$2a$11$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP
```

## Configuration

### Environment Variables

The configuration files use environment variable substitution:

- `$NATS_USER` - NATS username (e.g., `nats_user`)
- `$NATS_PASSWORD` - NATS plaintext password (bcrypt hash is auto-generated)

### Runtime Configuration Generation

During deployment, the `prepare-nats-config.sh` script:
1. Generates a bcrypt hash from `NATS_PASSWORD`
2. Substitutes environment variables in the config template
3. Creates `nats-<env>-runtime.conf` with the bcrypt hash

```bash
./scripts/prepare-nats-config.sh <env>
```

## Development

For development, NATS runs without authentication by default. To enable authentication in development:

1. Uncomment the `authorization` block in `nats-dev.conf`
2. Set `NATS_USER` and `NATS_PASSWORD` in your `.env` file
3. Restart the NATS container

## Production/Staging

For production and staging environments:

1. Generate a secure password (e.g., `openssl rand -base64 32`)
2. Set `NATS_USER` and `NATS_PASSWORD` environment variables
3. The deployment process will automatically:
   - Generate a bcrypt hash from `NATS_PASSWORD`
   - Prepare the NATS configuration with the hash
   - Deploy the secure configuration

## Why Bcrypt?

NATS server logs a warning when plaintext passwords are detected:
```
[WRN] Plaintext passwords detected, use nkeys or bcrypt
```

Using bcrypt hashed passwords:
- Prevents password exposure in configuration files
- Protects against unauthorized access if config files are compromised
- Follows security best practices for production systems

## Connection

Applications connect to NATS using the plaintext password (not the bcrypt hash):

```typescript
const connection = await connect({
  servers: 'nats://nats-prod:4222',
  user: process.env.NATS_USER,
  pass: process.env.NATS_PASSWORD, // Plaintext password
});
```

The NATS server uses the bcrypt hash internally to verify the password.
