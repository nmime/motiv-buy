// Docker Bake configuration for optimized multi-app builds
// Usage: docker buildx bake -f docker-bake.hcl

variable "TAG" {
  default = "latest"
}

// Shared build context - ensures all-apps-builder runs ONCE
group "default" {
  targets = ["api", "bot"]
}

// Base target with shared settings
target "_base" {
  dockerfile = "Dockerfile"
  context    = "."
  platforms  = ["linux/amd64"]
}

// API service
target "api" {
  inherits = ["_base"]
  args = {
    APP_NAME = "api"
  }
  tags = ["motiv-buy-api:${TAG}"]
}

// Bot service
target "bot" {
  inherits = ["_base"]
  args = {
    APP_NAME = "bot"
  }
  tags = ["motiv-buy-bot:${TAG}"]
}

// Migration (on-demand)
target "migration" {
  inherits = ["_base"]
  args = {
    APP_NAME = "migration"
  }
  tags = ["motiv-buy-migration:${TAG}"]
}

// Build all including migration
group "all" {
  targets = ["api", "bot", "migration"]
}
