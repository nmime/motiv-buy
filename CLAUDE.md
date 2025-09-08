# Motiv-Buy Project - AI Context (claude-master)

## 1. Project Overview

- **Project Name:** Motiv-Buy
- **Development Methodology:** SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) with Claude-Flow
  orchestration
- **Architecture Pattern:** Domain-driven design with modular architecture
- **Development Strategy:** Test-Driven Development with comprehensive testing and documentation

## 2. Domain-Driven Architecture & Monorepo Structure

**⚠️ CRITICAL: AI agents MUST read the [Project Structure documentation](/docs/ai-context/project-structure.md) before
attempting any task to understand the complete technology stack, file tree and project organization.**

### Monorepo Architecture Overview

This is a **Nx-powered TypeScript monorepo** with comprehensive testing, linting, and build orchestration.

**Root Directory**: `/monorepo/` (contains all applications and libraries)

- **Workspace Management**: Nx for task orchestration, dependency management, and build optimization
- **Package Management**: pnpm with workspace support for efficient dependency handling
- **Testing Strategy**: Jest with coverage reporting across all apps and libraries
- **Code Quality**: ESLint, Prettier, and TypeScript strict mode enforcement

### Applications Architecture

**Applications Directory**: `apps/`

- **`apps/api/`** – NestJS HTTP API service
    - Business logic orchestration layer
    - RESTful endpoints with OpenAPI documentation
    - Authentication, authorization, and request validation
    - Fastify adapter for high performance

- **`apps/bot/`** – Telegram Bot Application
    - Grammy framework for bot interactions
    - Event-driven message handling
    - Integration with business domains via service composition

- **`apps/migration/`** – Database Management
    - MikroORM migration scripts
    - Data transformation utilities
    - Schema evolution and rollback capabilities

### Libraries Architecture

**Libraries Directory**: `libs/`

#### Core Infrastructure (`libs/database/`)

- **Database Layer**: MikroORM entities, repositories, and configuration
- **Connection Management**: PostgreSQL with connection pooling
- **Migration System**: Automated schema evolution with rollback support

#### Common Utilities (`libs/common/`)

- **`libs/common/shared/`** – Cross-domain utilities and types
- **`libs/common/exception/`** – Centralized error handling patterns
- **`libs/common/validation/`** – Input validation and sanitization
- **`libs/common/redis/`** – Caching and session management
- **`libs/common/logger/`** – Structured logging with correlation IDs
- **`libs/common/health/`** – Health checks and monitoring
- **`libs/common/response/`** – Standardized API response formats
- **`libs/common/bull/`** – Queue processing and background jobs
- **`libs/common/intl/`** – Internationalization support

#### Business Domains (`libs/feature/`)

Each domain follows the **main/shared** split pattern:

- **`libs/feature/auth/`** – Authentication and authorization
    - `main/` – Core auth business logic, strategies, guards
    - `shared/` – DTOs, interfaces, and reusable auth utilities

- **`libs/feature/user/`** – User management and profiles
    - `main/` – User business logic, profile management
    - `shared/` – User DTOs, validation schemas

- **`libs/feature/balance/`** – Financial balance and transactions
    - `main/` – Balance calculation, transaction processing
    - `shared/` – Financial types and validation

- **`libs/feature/traffic/`** – Traffic source tracking and analytics
    - `main/` – Analytics processing, source attribution
    - `shared/` – Traffic types and tracking schemas

- **`libs/feature/statistic/`** – Metrics and reporting
    - `main/` – Statistical calculations, report generation
    - `shared/` – Metric definitions and report types

### Fundamental Development Principles

#### Domain Organization

- **`libs/feature`** – This folder holds the business domains
- **`libs/database`** – Database entities, repositories, and services
- Each domain is split into two libraries: **main** and **shared**
    - **main** – The domain's core business code and implementation
    - **shared** – Reusable code (business logic may live here if absolutely necessary, though it's discouraged)

#### Domain Isolation & Communication

- **Domains should avoid depending on one another's business logic**
- If reuse is unavoidable, expose only the minimal surface in the domain's **shared** package
- **Cross-domain communication should be properly abstracted**

#### Application Architecture

- **API Application** (`apps/api/`) – Thin composition root wiring up domain controllers and services
- **Bot Application** (`apps/bot/`) – Telegram bot handlers composing domain business logic
- **Migration Application** (`apps/migration/`) – Database migration utilities and scripts
- **No new code is written inside an app** – apps are just thin composition roots that wire up pre-built controllers and
  services
- Applications are deployment artifacts that compose domain libraries from `libs/`

#### Architecture Layers

**Controller → Service → Repository → Mapper**

- **Controller** – HTTP / message ingress, request validation, DTO mapping
- **Service** – Use-case orchestration, transaction boundaries, domain coordination
- **Repository** – Domain-level abstractions for persistence (interfaces)
- **Mapper** – Concrete data-access code (ORM adapters, SQL/NoSQL mappers) fulfilling repository contracts

#### Data Access Principles

- **Business code never touches the database directly**
- Everything passes through repositories and mappers
- Repositories define domain-level contracts
- Mappers provide concrete implementations

## 3. Coding Standards & AI Instructions

### General Instructions

- Your most important job is to manage your own context. Always read any relevant files BEFORE planning changes.
- When updating documentation, keep updates concise and on point to prevent bloat.
- Write code following KISS, YAGNI, and DRY principles.
- When in doubt follow proven best practices for implementation.
- Do not commit to git without user approval.
- Do not run any servers, rather tell the user to run servers for testing.
- Always consider industry standard libraries/frameworks first over custom implementations.
- Never mock anything. Never use placeholders. Never omit code.
- Apply SOLID principles where relevant. Use modern framework features rather than reinventing solutions.
- Be brutally honest about whether an idea is good or bad.
- Make side effects explicit and minimal.
- Design database schema to be evolution-friendly (avoid breaking changes).

### File Organization & Modularity

- Default to creating multiple small, focused files rather than large monolithic ones
- Each file should have a single responsibility and clear purpose
- Keep files under 700 lines when possible - split larger files by extracting utilities, constants, types, or logical
  components into separate modules
- Separate concerns: utilities, constants, types, components, and business logic into different files
- Prefer composition over inheritance - use inheritance only for true 'is-a' relationships, favor composition for '
  has-a' or behavior mixing
- Follow existing project structure and conventions - place files in appropriate directories. Create new directories and
  move files if deemed appropriate.
- Use well defined sub-directories to keep things organized and scalable
- Structure projects with clear folder hierarchies and consistent naming conventions
- Import/export properly - design for reusability and maintainability
- **Index files**: Every subfolder MUST have an index.ts file using `export * from './filename'` pattern for clean imports

### TypeScript Types (REQUIRED)

- **Always** use TypeScript interfaces and types for all function parameters and return values
- Use strict TypeScript configuration with `strict: true`
- Prefer explicit typing over `any` - use `unknown` when type is truly unknown
- Use DTOs with validation decorators for data validation

### Naming Conventions

- **Classes/Interfaces**: PascalCase (e.g., `UserService`, `ProductModel`)
- **Functions/Methods**: camelCase (e.g., `processOrder`, `getUserData`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`, `API_ENDPOINTS`)
- **Private methods**: Leading underscore (e.g., `_validateInput`)
- **DTOs**: PascalCase with `Dto` suffix (e.g., `CreateUserDto`, `OrderDto`)
- **Enums**: PascalCase (e.g., `UserRole`, `OrderStatus`)
- **Enum keys**: PascalCase (e.g., `Pending`, `Completed`)
- **Enum values**: snake_case (e.g., `pending`, `completed`)
- **Files**: kebab-case (e.g., `user.service.ts`, `order.entity.ts`)
- **Folders/Directories**: **MUST be singular** - use `mapper`, not `mappers`; `type`, not `types`; `service`, not
  `services`; `controller`, not `controllers`

### Documentation Requirements

- Every module needs a JSDoc comment describing its purpose
- Every public function/method needs JSDoc documentation
- Use JSDoc standard with TypeScript types
- Document complex business logic

### Security First

- Never trust external inputs - validate everything at the boundaries
- Keep secrets in environment variables, never in code
- Log security events but never log sensitive data
- Authenticate users at the API gateway level - never trust client-side tokens
- Use Row Level Security (RLS) to enforce data isolation between users
- Design auth to work across all client types consistently
- Use secure authentication patterns for your platform
- Sanitize all user inputs before storing or processing

### Error Handling

- Use specific exceptions over generic ones for business logic validation
- Use generic exceptions only for unexpected errors
- Always log errors with context
- Provide helpful error messages
- Fail securely - errors shouldn't reveal system internals

### Observable Systems & Logging Standards

- Every request needs a correlation ID for debugging
- Structure logs for machines, not humans - use JSON format with consistent fields (timestamp, level, correlation_id,
  event, context) for automated analysis
- Make debugging possible across service boundaries

### State Management

- Have one source of truth for each piece of state
- Make state changes explicit and traceable
- Design for multi-service transaction processing - use correlation IDs for state coordination across services
- Keep transaction state in database with proper audit trails, avoid storing sensitive data in server memory

### API Design Principles

- RESTful design with consistent URL patterns
- Use HTTP status codes correctly
- Version APIs from day one (/api/v1/, /api/v2/)
- Support pagination for list endpoints, prefer cursor-based pagination

## 4. Multi-Agent Workflows & Context Injection

### Automatic Context Injection for Sub-Agents

When using the Task tool to spawn sub-agents, the core project context is automatically injected into their prompts via
the subagent-context-injector hook. This ensures all sub-agents have immediate access to essential project documentation
without manual specification in each Task prompt.

## 5. MCP Server Integrations

### Gemini Consultation Server

**When to use:**

- Complex coding problems requiring deep analysis or multiple approaches
- Code reviews and architecture discussions
- Debugging complex issues across multiple files
- Performance optimization and refactoring guidance
- Detailed explanations of complex implementations
- Highly security relevant tasks

### Context7 Documentation Server

**When to use:**

- Working with external libraries/frameworks
- Need current documentation beyond training cutoff
- Implementing new integrations or features with third-party tools
- Troubleshooting library-specific issues

## 6. Advanced Claude Code Techniques

### 🧠 Think Mode for Complex Problems

**Trigger Extended Reasoning:** Use "think" in your prompts to activate Claude Code's architectural reasoning mode.

**Amateur Approach:**

```
How do I implement user authentication?
```

**Professional Approach:**

```
I need to think through building a secure, scalable user authentication system for our NestJS API with PostgreSQL. Consider JWT vs sessions, password hashing strategies, rate limiting, MFA support, and how this integrates with our existing domain architecture. Analyze security implications and provide architectural trade-offs.
```

### 🔍 Intelligent Code Search & Analysis

**Leverage Claude Code as a code archaeologist** that identifies patterns, relationships, and technical debt across your
entire monorepo.

**Professional Command:**

```
Analyze our entire monorepo and identify all authentication-related logic, including direct implementations, middleware, guards, decorators, and any hardcoded auth checks. Map relationships between different auth implementations, identify inconsistencies in our auth patterns, and flag potential security vulnerabilities or code duplication. Focus on the NestJS app and feature libraries.
```

### ⚡ Natural Language Git Workflows

**Transform Git from manual commands to intelligent automation** that understands context and best practices.

**Professional Workflow:**

```
Create a feature branch for implementing OAuth2 with Google. Implement the complete flow including redirect handling, token management, and user session persistence. Follow our team's commit conventions with descriptive messages for each logical change, then create a pull request with proper documentation and request review from the security team.
```

**Advanced Git Operations:**

```
Analyze our current branch, identify any code that violates our ESLint rules or TypeScript strict mode, fix violations, then rebase commits for clean history. Check if any dependencies need security updates and handle those in separate commits with proper documentation.
```

### 🛡️ Defensive Coding Strategies

**Weaponize Claude Code's paranoia** to build bulletproof systems that anticipate failure.

**Professional Command:**

```
Using TDD principles, write comprehensive tests for our payment processing system that handles network failures, invalid payment data, rate limiting, idempotency, partial payments, and webhook retry logic. Then implement the service to pass all tests. Include proper structured logging, circuit breaker patterns, and graceful degradation strategies.
```

### 🔄 Multi-Repository Refactoring Operations

**Execute architectural changes across multiple files and domains** while maintaining system integrity.

**Professional Refactoring:**

```
Our user management is scattered across the user domain, auth domain, and database layers. Consolidate this into a proper domain-driven design with clear boundaries. Create user aggregates, repositories, and domain services. Update all existing code in apps/api and apps/bot to use the new architecture. Ensure backward compatibility and create migration scripts for any data structure changes.
```

### 📖 Context-Aware Documentation

**Generate documentation that teaches architecture**, not just API signatures.

**Professional Documentation Command:**

```
Analyze our entire authentication system across all domains and create comprehensive documentation that explains architectural decisions, security considerations, data flow between NestJS modules, potential failure points, and integration patterns with our Telegram bot. Include sequence diagrams for the complete auth flow and troubleshooting guides for common issues.
```

### 🎯 Advanced Prompting Framework

**Structure every complex request using this framework:**

```
Context: [Our NestJS/PostgreSQL monorepo with domain-driven architecture]

Constraints: [TypeScript strict mode, security-first, no breaking changes]  

Goal: [Specific, measurable outcome]

Format: [Exactly how you want the response structured]

Examples: [Show what good/bad solutions look like]

Validation: [How to verify the solution works]

Now solve [specific problem] following this framework.
```

### 🔄 Cross-Language Integration

**Preserve business logic while optimizing for each language's strengths.**

**Professional Cross-Language Command:**

```
We need to migrate our user statistics processing from our TypeScript implementation to Go for performance. Analyze our current service in libs/feature/statistic, identify core business logic, then redesign using Go's concurrency patterns. Maintain the same API contracts, improve performance using goroutines, and ensure our NestJS API can seamlessly integrate with the Go service.
```

### 🏗️ Natural Language Architecture Planning

**Use Claude Code for upfront architectural thinking** that prevents disasters before code is written.

**Architectural Planning Command:**

```
I need to architect a real-time messaging system that integrates with our existing user authentication and scales to handle 10K concurrent users. Think through: WebSocket connection management, message persistence strategies, user presence tracking, message ordering guarantees, integration with our PostgreSQL database, caching strategies with Redis, horizontal scaling approaches, and monitoring requirements. Create a comprehensive architecture document with implementation phases.
```

### 🔧 Custom MCP Server Chains

**Chain MCP servers for autonomous development pipelines:**

**Example MCP Configuration:**

```
{
  "mcpServers": {
    "codeAnalysis": {
      "command": "node",
      "args": ["./mcp-servers/monorepo-analyzer.js"]
    },
    "testRunner": {
      "command": "node", 
      "args": ["./mcp-servers/nx-test-runner.js"]
    },
    "securityScanner": {
      "command": "node",
      "args": ["./mcp-servers/security-audit.js"]
    },
    "deploymentPipeline": {
      "command": "node",
      "args": ["./mcp-servers/deploy-orchestrator.js"]
    }
  }
}
```

**One-Shot Automation Command:**

```
Analyze our monorepo for security vulnerabilities, run automated tests on any fixes, update dependencies with security patches, commit changes with proper documentation, deploy to staging with our NX build pipeline, execute security scans on deployed version, and if everything passes, deploy to production with rollback strategies.
```

### 📋 Team Coding Standards Evolution

**Turn Claude Code into an intelligent standards authority** that educates and evolves with your team.

**Standards Authority Setup:**

```
Establish Claude Code as our team's coding standards authority for our NestJS monorepo. Understand our specific patterns: how we structure domain modules, our custom decorators, our error handling with our exception library, our database repository patterns, and our testing strategies with Jest. For every piece of code generated, follow these standards and explain why these patterns exist and when to deviate.
```

**Standards Evolution:**

```
Analyze patterns across our recent commits in the monorepo and identify emerging conventions that aren't documented. Suggest updates to our coding guidelines based on what the team naturally gravitates toward, and highlight inconsistencies where different developers solve similar problems in conflicting ways across our domains.
```

### 🧪 Monorepo Testing & Quality Architecture

**Comprehensive testing setup across all apps and libraries with Jest, TypeScript, and Nx orchestration.**

#### Testing Commands

```bash
# Test all projects
npm run test

# Test specific project types
npm run test:apps      # Test only applications
npm run test:libs      # Test only libraries

# Development testing
npm run test:watch     # Watch mode for development
npm run test:coverage  # Generate coverage reports

# Efficient testing
npm run test:affected  # Test only affected projects
```

#### Quality Assurance Pipeline

```bash
# Full quality check pipeline
npm run build && npm run typecheck && npm run lint && npm run test

# Affected-only pipeline (faster)
npm run build:affected && npm run typecheck:affected && npm run lint:affected && npm run test:affected
```

#### Monorepo Quality Standards

- **Code Coverage**: Individual Jest configs per app/library
- **Type Safety**: TypeScript strict mode across all projects
- **Code Quality**: ESLint with consistent rules across domains
- **Build Verification**: Nx dependency graph validation
- **Integration Testing**: Cross-domain interaction verification

## 7. Post-Task Completion Protocol

After completing any coding task, follow this checklist:

### 1. Monorepo Quality Checks

Run commands based on what was modified:

- **Build Verification**: `npm run build` or `npm run build:affected`
- **Type Checking**: `npm run typecheck` or `npm run typecheck:affected`
- **Linting**: `npm run lint` or `npm run lint:affected`
- **Testing**: `npm run test` or `npm run test:affected`
- **Integration**: Verify cross-domain dependencies still work

### 2. Domain Integrity Verification

- Ensure domain boundaries are respected
- Verify no business logic leaked into shared libraries
- Check that apps remain thin composition layers
- Validate repository contracts are maintained

### 3. Security & Performance

- Run security linting if auth/security code changed
- Verify no secrets in code or config files
- Check that performance-critical paths maintain efficiency
- Ensure proper error handling and logging

---

# Claude Code Configuration - SPARC Development Environment

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:

1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**

- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### 📁 File Organization Rules

**NEVER save to root folder. Use these directories:**

- `/src` - Source code files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## SPARC Project Overview

This project uses SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with Claude-Flow
orchestration for systematic Test-Driven Development.

## SPARC Commands

### Core Commands

- `npx claude-flow sparc modes` - List available modes
- `npx claude-flow sparc run <mode> "<task>"` - Execute specific mode
- `npx claude-flow sparc tdd "<feature>"` - Run complete TDD workflow
- `npx claude-flow sparc info <mode>` - Get mode details

### Batchtools Commands

- `npx claude-flow sparc batch <modes> "<task>"` - Parallel execution
- `npx claude-flow sparc pipeline "<task>"` - Full pipeline processing
- `npx claude-flow sparc concurrent <mode> "<tasks-file>"` - Multi-task processing

### Build Commands

- `npm run build` - Build project
- `npm run test` - Run tests
- `npm run lint` - Linting
- `npm run typecheck` - Type checking

## SPARC Workflow Phases

1. **Specification** - Requirements analysis (`sparc run spec-pseudocode`)
2. **Pseudocode** - Algorithm design (`sparc run spec-pseudocode`)
3. **Architecture** - System design (`sparc run architect`)
4. **Refinement** - TDD implementation (`sparc tdd`)
5. **Completion** - Integration (`sparc run integration`)

## Code Style & Best Practices

- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated

## 🚀 Available Agents (54 Total)

### Core Development

`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Swarm Coordination

`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `collective-intelligence-coordinator`,
`swarm-memory-manager`

### Consensus & Distributed

`byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `consensus-builder`, `crdt-synchronizer`,
`quorum-manager`, `security-manager`

### Performance & Optimization

`perf-analyzer`, `performance-benchmarker`, `task-orchestrator`, `memory-coordinator`, `smart-agent`

### GitHub & Repository

`github-modes`, `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`,
`project-board-sync`, `repo-architect`, `multi-repo-swarm`

### SPARC Methodology

`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

### Specialized Development

`backend-dev`, `mobile-dev`, `ml-developer`, `cicd-engineer`, `api-docs`, `system-architect`, `code-analyzer`,
`base-template-generator`

### Testing & Validation

`tdd-london-swarm`, `production-validator`

### Migration & Planning

`migration-planner`, `swarm-init`

## 🎯 Claude Code vs MCP Tools

### Claude Code Handles ALL:

- File operations (Read, Write, Edit, MultiEdit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work
- Project navigation and analysis
- TodoWrite and task management
- Git operations
- Package management
- Testing and debugging

### MCP Tools ONLY:

- Coordination and planning
- Memory management
- Neural features
- Performance tracking
- Swarm orchestration
- GitHub integration

**KEY**: MCP coordinates, Claude Code executes.

## 🚀 Quick Setup

```bash
# Add Claude Flow MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start
```

## MCP Tool Categories

### Coordination

`swarm_init`, `agent_spawn`, `task_orchestrate`

### Monitoring

`swarm_status`, `agent_list`, `agent_metrics`, `task_status`, `task_results`

### Memory & Neural

`memory_usage`, `neural_status`, `neural_train`, `neural_patterns`

### GitHub Integration

`github_swarm`, `repo_analyze`, `pr_enhance`, `issue_triage`, `code_review`

### System

`benchmark_run`, `features_detect`, `swarm_monitor`

## 📋 Agent Coordination Protocol

### Every Agent MUST:

**1️⃣ BEFORE Work:**

```bash
npx claude-flow@alpha hooks pre-task --description "[task]"
npx claude-flow@alpha hooks session-restore --session-id "swarm-[id]"
```

**2️⃣ DURING Work:**

```bash
npx claude-flow@alpha hooks post-edit --file "[file]" --memory-key "swarm/[agent]/[step]"
npx claude-flow@alpha hooks notify --message "[what was done]"
```

**3️⃣ AFTER Work:**

```bash
npx claude-flow@alpha hooks post-task --task-id "[task]"
npx claude-flow@alpha hooks session-end --export-metrics true
```

## 🎯 Concurrent Execution Examples

### ✅ CORRECT (Single Message):

```javascript
[BatchTool]
:
// Initialize swarm
mcp__claude - flow__swarm_init
{
	topology: "mesh", maxAgents
:
	6
}
mcp__claude - flow__agent_spawn
{
	type: "researcher"
}
mcp__claude - flow__agent_spawn
{
	type: "coder"
}
mcp__claude - flow__agent_spawn
{
	type: "tester"
}

// Spawn agents with Task tool
Task("Research agent: Analyze requirements...")
Task("Coder agent: Implement features...")
Task("Tester agent: Create test suite...")

// Batch todos
TodoWrite
{
	todos: [
		{id: "1", content: "Research", status: "in_progress", priority: "high"},
		{id: "2", content: "Design", status: "pending", priority: "high"},
		{id: "3", content: "Implement", status: "pending", priority: "high"},
		{id: "4", content: "Test", status: "pending", priority: "medium"},
		{id: "5", content: "Document", status: "pending", priority: "low"}
	]
}

// File operations
Bash
"mkdir -p app/{src,tests,docs}"
Write
"app/src/index.js"
Write
"app/tests/index.test.js"
Write
"app/docs/README.md"
```

### ❌ WRONG (Multiple Messages):

```javascript
Message
1
:
mcp__claude - flow__swarm_init
Message
2
:
Task("agent 1")
Message
3
:
TodoWrite
{
	todos: [single todo]
}
Message
4
:
Write
"file.js"
// This breaks parallel coordination!
```

## Performance Benefits

- **84.8% SWE-Bench solve rate**
- **32.3% token reduction**
- **2.8-4.4x speed improvement**
- **27+ neural models**

## Hooks Integration

### Pre-Operation

- Auto-assign agents by file type
- Validate commands for safety
- Prepare resources automatically
- Optimize topology by complexity
- Cache searches

### Post-Operation

- Auto-format code
- Train neural patterns
- Update memory
- Analyze performance
- Track token usage

### Session Management

- Generate summaries
- Persist state
- Track metrics
- Restore context
- Export workflows

## Advanced Features (v2.0.0)

- 🚀 Automatic Topology Selection
- ⚡ Parallel Execution (2.8-4.4x speed)
- 🧠 Neural Training
- 📊 Bottleneck Analysis
- 🤖 Smart Auto-Spawning
- 🛡️ Self-Healing Workflows
- 💾 Cross-Session Memory
- 🔗 GitHub Integration

## Integration Tips

1. Start with basic swarm init
2. Scale agents gradually
3. Use memory for context
4. Monitor progress regularly
5. Train patterns from success
6. Enable hooks automation
7. Use GitHub tools first

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues

---

Remember: **Claude Flow coordinates, Claude Code creates!**

# Important Instruction Reminders

- Do what has been asked; nothing more, nothing less.
- NEVER create files unless they're absolutely necessary for achieving your goal.
- ALWAYS prefer editing an existing file to creating a new one.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly
  requested by the User.
- Never save working files, text/mds and tests to the root folder.
