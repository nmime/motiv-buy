# Motiv-Buy Documentation Architecture

This project uses a **streamlined documentation system** organized by scope and stability, enabling efficient AI context loading and scalable development for the Motiv-Buy monorepo.

## Current Documentation Structure

The documentation is currently organized in a simple but effective hierarchy that can be expanded as the project grows.

## Documentation Principles
- **Co-location**: Documentation lives near relevant code when appropriate
- **Smart Extension**: New documentation files created when specific components develop complex patterns
- **AI-First**: Optimized for efficient AI context loading and machine-readable patterns
- **Monorepo Awareness**: Unified documentation reflecting the shared nature of apps and libraries

## Tier 1: Foundational Documentation (System-Wide)

- **[Master Context](/CLAUDE.md)** - *Essential for every session.* Coding standards, security requirements, MCP server integration patterns, development protocols, and monorepo structure
- **[Project Structure](/docs/ai-context/project-structure.md)** - *REQUIRED reading.* Complete technology stack, file tree, and system architecture. Must be referenced for any structural changes
- **[Documentation Architecture](/docs/ai-context/docs-overview.md)** - *This file.* How documentation is organized and when to extend it

## Tier 2: Application-Level Documentation (Future)

As applications develop distinct patterns and complexity, create component-level documentation:

### Potential API Documentation
- **[API Context](/apps/api/CONTEXT.md)** - *When API grows complex.* HTTP API patterns, endpoint organization, middleware, and integration approaches

### Potential Bot Documentation  
- **[Bot Context](/apps/bot/CONTEXT.md)** - *When bot grows complex.* Telegram bot patterns, handler organization, middleware, and user interaction flows

### Potential Migration Documentation
- **[Migration Context](/apps/migration/CONTEXT.md)** - *When migrations become complex.* Migration patterns, data transformation strategies, and rollback procedures

### Potential Library Documentation
- **[Database Context](/libs/database/CONTEXT.md)** - *When database layer becomes complex.* Entity patterns, repository conventions, and data access strategies
- **[DTO Context](/libs/dto/CONTEXT.md)** - *When DTOs become numerous.* Validation patterns, transformation strategies, and shared type conventions

## Tier 3: Feature-Specific Documentation (Future)

Granular CONTEXT.md files co-located with code for minimal cascade effects, created when specific feature areas develop distinct patterns:

### Potential API Feature Documentation
- **[API Health Context](/apps/api/src/app/health/CONTEXT.md)** - *If health checks become complex.* Health check patterns, monitoring integration, and service dependencies
- **[API User Context](/apps/api/src/app/user/CONTEXT.md)** - *If user management becomes complex.* User API patterns, validation strategies, and data handling

### Potential Bot Feature Documentation
- **[Bot Handlers Context](/apps/bot/src/app/handlers/CONTEXT.md)** - *If bot handlers develop complex patterns.* Command handling patterns, state management, and user interaction flows
- **[Bot Services Context](/apps/bot/src/app/services/CONTEXT.md)** - *If bot services become complex.* Service patterns, external API integration, and business logic organization

### Potential Database Feature Documentation
- **[Database Entities Context](/libs/database/src/entities/CONTEXT.md)** - *If entity relationships become complex.* Entity design patterns, relationship strategies, and data modeling approaches
- **[Database Repositories Context](/libs/database/src/repositories/CONTEXT.md)** - *If repository patterns diversify.* Query strategies, data access patterns, and performance optimizations

## When to Extend Documentation

### Create New Component CONTEXT.md when:
- An application (api, bot, migration) develops 5+ meaningful files with distinct patterns
- Cross-cutting concerns emerge that need architectural documentation
- Integration patterns become complex enough to warrant explanation
- Example: Adding complex authentication patterns to API → Create `apps/api/CONTEXT.md`

### Create New Feature-Specific CONTEXT.md when:
- A feature area within an application has 3+ files with distinct functional patterns
- Complex business logic emerges that needs pattern documentation  
- Integration between components requires explanation
- Example: Complex user management with multiple services → Create `apps/api/src/app/user/CONTEXT.md`

### When NOT to create new files:
- Small additions (1-2 files) that fit existing documentation scope
- Bug fixes or minor modifications that don't change patterns
- Temporary or experimental code without established patterns
- Simple features that follow existing documented patterns

## Documentation Update Process

### For New Applications or Libraries:
1. **Create new component CONTEXT.md** following existing patterns
2. **Update this overview** to include the new documentation in the appropriate tier
3. **Reference from foundational docs** if it affects system-wide concerns

### For New Features Within Existing Components:
1. **Assess complexity** - does this warrant feature-specific documentation?
2. **Create feature CONTEXT.md** if patterns are distinct and non-trivial
3. **Update parent component docs** if architectural patterns change
4. **Add to this overview** under the appropriate tier

### For Major Architectural Changes:
1. **Update foundational documentation first** (CLAUDE.md, project-structure.md)
2. **Cascade to component documentation** as needed
3. **Create new documentation files** if entirely new architectural areas emerge
4. **Update this overview** to reflect the new documentation structure

## File Content Template for New CONTEXT.md:

```markdown
# [Component/Feature] Documentation

*This file documents [specific area] patterns and implementations within [context].*

## [Area] Architecture
- [Key architectural elements and decisions]

## Implementation Patterns
- [Key patterns used in this area]
- [Coding conventions specific to this component]

## Integration Points
- [How this integrates with other parts of the system]
- [External dependencies and their usage patterns]

## Development Guidelines
- [Component-specific development practices]
- [Testing strategies for this area]

---

*This file was created to document [brief reason] as part of the Motiv-Buy documentation system.*
```

## Current File Inventory

### Foundational Documentation (Tier 1)
- `/CLAUDE.md` - Master AI context and development guidelines
- `/docs/ai-context/project-structure.md` - Complete technology stack and file structure
- `/docs/ai-context/docs-overview.md` - This file, documentation architecture

### Specification Templates
- `/docs/specs/example-app-specification.md` - Application development template  
- `/docs/specs/example-lib-specification.md` - Library development template

### Missing Documentation (Create When Needed)
- Component-level documentation (Tier 2) - Create when applications develop complex patterns
- Feature-specific documentation (Tier 3) - Create when specific areas develop distinct patterns

## Benefits of This System

- **Scalable Growth**: Documentation expands naturally as project complexity increases
- **Focused Context Loading**: AI agents can load only relevant documentation for their tasks  
- **Minimal Maintenance**: Documentation is created only when value is clear
- **Clear Structure**: Hierarchical organization makes it easy to find relevant information
- **Monorepo Optimized**: Reflects the shared nature of applications and libraries

---

*This documentation architecture is designed to grow with the Motiv-Buy project, providing structure when needed while avoiding premature documentation overhead.*