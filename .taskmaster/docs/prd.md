<rpg-method>
# Repository Planning Graph (RPG) Method - PRD Template

This template teaches you (AI or human) how to create structured, dependency-aware PRDs using the RPG methodology from Microsoft Research. The key insight: separate WHAT (functional) from HOW (structural), then connect them with explicit dependencies.

## Core Principles

1. **Dual-Semantics**: Think functional (capabilities) AND structural (code organization) separately, then map them
2. **Explicit Dependencies**: Never assume - always state what depends on what
3. **Topological Order**: Build foundation first, then layers on top
4. **Progressive Refinement**: Start broad, refine iteratively

## How to Use This Template

- Follow the instructions in each `<instruction>` block
- Look at `<example>` blocks to see good vs bad patterns
- Fill in the content sections with your project details
- The AI reading this will learn the RPG method by following along
- Task Master will parse the resulting PRD into dependency-aware tasks

## Recommended Tools for Creating PRDs

When using this template to **create** a PRD (not parse it), use **code-context-aware AI assistants** for best results:

**Why?** The AI needs to understand your existing codebase to make good architectural decisions about modules, dependencies, and integration points.

**Recommended tools:**
- **Claude Code** (claude-code CLI) - Best for structured reasoning and large contexts
- **Cursor/Windsurf** - IDE integration with full codebase context
- **Gemini CLI** (gemini-cli) - Massive context window for large codebases
- **Codex/Grok CLI** - Strong code generation with context awareness

**Note:** Once your PRD is created, `task-master parse-prd` works with any configured AI model - it just needs to read the PRD text itself, not your codebase.
</rpg-method>

---

<overview>
<instruction>
Start with the problem, not the solution. Be specific about:
- What pain point exists?
- Who experiences it?
- Why existing solutions don't work?
- What success looks like (measurable outcomes)?

Keep this section focused - don't jump into implementation details yet.
</instruction>

## Problem Statement

Professional photographers face inefficient workflows when sharing photos with clients for approval and delivery. Current pain points include:

- Manual photo sharing via email or generic cloud storage lacks professional presentation
- Difficulty tracking which photos clients want edited leads to confusion and rework
- Endless revision cycles with changing client selections cause scope creep
- Complex delivery processes for final edited photos are time-consuming
- Poor mobile experience for client photo review reduces engagement

Existing solutions (email, Dropbox, Google Drive) don't integrate with photographers' Lightroom Classic workflow, require manual organization, and lack deadline enforcement mechanisms that prevent scope creep.

## Target Users

### Photographers
**Profile:** Professional photographers (wedding, portrait, event, commercial)

- **Primary needs:** Efficient client management, Lightroom integration, professional presentation
- **Technical comfort:** Moderate to high
- **Pain points:** Time-consuming client approval processes, manual photo organization
- **Workflows:**
  - Wedding: Upload 500 photos → Multiple clients select → Edit 150 selected → Deliver finals
  - Portrait: Upload 50 photos → Client selects 15 → Edit selected → Deliver high-res
  - Corporate: Upload 200 photos → Multiple stakeholders select → Deliver for marketing

### Clients
**Profile:** Photography clients receiving photos for approval/delivery

- **Primary needs:** Easy photo browsing, simple selection process, mobile accessibility
- **Technical comfort:** Low to moderate
- **Pain points:** Difficult photo review interfaces, confusion about deadlines
- **Workflow:** Access album via link → Browse photos → Select favorites → Submit before deadline

## Success Metrics

- **Photographer time savings:** 50% reduction in client management overhead
- **Client satisfaction:** >90% completion rate for photo selection
- **System reliability:** 99.5% uptime for photo delivery
- **Cost efficiency:** 70% storage cost reduction vs traditional cloud storage
- **Performance:** <2s page load times, <200ms API responses
- **User satisfaction:** >4.5/5 rating from beta users

</overview>

---

<functional-decomposition>
<instruction>
Now think about CAPABILITIES (what the system DOES), not code structure yet.

Step 1: Identify high-level capability domains
- Think: "What major things does this system do?"
- Examples: Data Management, Core Processing, Presentation Layer

Step 2: For each capability, enumerate specific features
- Use explore-exploit strategy:
  * Exploit: What features are REQUIRED for core value?
  * Explore: What features make this domain COMPLETE?

Step 3: For each feature, define:
- Description: What it does in one sentence
- Inputs: What data/context it needs
- Outputs: What it produces/returns
- Behavior: Key logic or transformations
</instruction>

## Capability Tree

### Capability: Authentication & Authorization
Manages user authentication for photographers and secure access control for clients.

#### Feature: Photographer Authentication
- **Description**: Authenticate photographers via email/password (Google OAuth to be added in future version)
- **Inputs**: Email and password credentials
- **Outputs**: JWT access token, user profile data
- **Behavior**: Validate credentials, hash password with bcrypt, generate secure JWT, return session token

#### Feature: Client Access Control
- **Description**: Generate and validate unique access tokens for client album access
- **Inputs**: Album ID, client email, album password
- **Outputs**: Unique access token, token expiration metadata
- **Behavior**: Generate cryptographically secure token, hash album password, enforce expiration

#### Feature: Session Management
- **Description**: Manage photographer sessions and token refresh
- **Inputs**: JWT token, refresh token
- **Outputs**: Validated session, refreshed tokens
- **Behavior**: Verify token signature, check expiration, issue refresh tokens

### Capability: Album Management
Handles creation, configuration, and lifecycle management of photo albums.

#### Feature: Album Creation
- **Description**: Create new photo albums with metadata and settings
- **Inputs**: Title, deadline, password, photographer ID
- **Outputs**: Album record with unique ID, creation timestamp
- **Behavior**: Validate inputs, generate album ID, hash password, set initial status

#### Feature: Client Invitation
- **Description**: Add clients to albums and generate unique access links
- **Inputs**: Album ID, client email, client name
- **Outputs**: Access token, invitation link, client record
- **Behavior**: Generate unique token per client, create client record, send invitation

#### Feature: Album Configuration
- **Description**: Update album settings (deadline, password, status)
- **Inputs**: Album ID, updated settings
- **Outputs**: Updated album record
- **Behavior**: Validate permissions, update fields, maintain audit trail

#### Feature: Client Resubmission Control
- **Description**: Allow photographer to manually enable resubmission for specific clients who have already submitted (requires album status to be OPEN)
- **Inputs**: Album ID, client ID
- **Outputs**: Updated client submission status (hasSubmitted=false, submittedAt=null)
- **Behavior**: Validate album status is OPEN (block if CLOSED). Reset client's hasSubmitted to false and clear submittedAt timestamp, preserve existing selections, allow client to modify and resubmit selections, notify client of resubmission permission. Works before deadline (album already OPEN) or after deadline (album must be reopened to OPEN status first via Album Status Management).

#### Feature: Album Status Management
- **Description**: Open/close album review periods and handle emergency reopening
- **Inputs**: Album ID, target status
- **Outputs**: Updated status, timestamp, auto-submission records (when closing)
- **Behavior**: Enforce business rules, prevent invalid state transitions, log changes. When closing an album (setting status to CLOSED): identify clients with hasSubmitted=false, auto-submit their current selections (even if empty/zero selections), update hasSubmitted=true and set submittedAt timestamp, change album status to CLOSED, notify photographer with list of clients who were unsubmitted, notify each auto-submitted client of their submission. When reopening a CLOSED album, set album status to OPEN. After reopening, photographer must use Client Resubmission Control feature to allow specific clients to resubmit. Clients not allowed to resubmit can view photos in read-only mode but cannot modify selections.

### Capability: Photo Upload & Processing
Handles photo uploads from Lightroom plugin, image processing, and storage management.

#### Feature: Photo Upload
- **Description**: Accept photo uploads from Lightroom plugin with multiple resolutions
- **Inputs**: Album ID, photo files (thumbnail, preview, original), metadata
- **Outputs**: Photo records with storage URLs, upload confirmation
- **Behavior**: Validate file types, process images, upload to storage, create database records

#### Feature: Image Processing
- **Description**: Generate optimized thumbnails (300px) and previews (1200px) from originals
- **Inputs**: Original image file, target dimensions
- **Outputs**: Processed image files (JPEG/WebP)
- **Behavior**: Resize images, optimize compression, convert formats, maintain aspect ratio

#### Feature: Delta Sync Detection
- **Description**: Identify which photos are new or changed since last sync
- **Inputs**: Album ID, list of photo identifiers from plugin
- **Outputs**: List of photos to upload, list of photos already synced
- **Behavior**: Compare plugin state with database, detect new/changed files, return delta

#### Feature: Final Photo Delivery
- **Description**: Upload high-resolution edited final photos for client download
- **Inputs**: Album ID, selected photo IDs, high-res image files
- **Outputs**: Delivery photo records, download URLs
- **Behavior**: Validate selections, upload finals, create delivery records, notify clients

### Capability: Client Photo Selection
Enables clients to browse, select, and submit their favorite photos.

#### Feature: Photo Gallery Display
- **Description**: Display responsive photo gallery with grid and detail views, supports read-only mode when album is CLOSED
- **Inputs**: Access token, album ID
- **Outputs**: Photo list with thumbnails, metadata, selection state, read-only indicator
- **Behavior**: Authenticate token, fetch photos, format for display, handle pagination. When album is CLOSED: display in read-only mode (selections visible but not modifiable). When album is OPEN: allow modifications if hasSubmitted=false or resubmission is allowed via Client Resubmission Control.

#### Feature: Photo Selection Toggle
- **Description**: Allow clients to select/deselect photos with visual feedback, respects album status, deadline and resubmission permissions
- **Inputs**: Access token, photo ID, selection state
- **Outputs**: Updated selection record, selection count, error if blocked
- **Behavior**: Validate token, check album status is OPEN (block if CLOSED), check deadline and resubmission permission (hasSubmitted must be false), update selection, maintain selection count, provide immediate feedback. Block if album is CLOSED regardless of hasSubmitted status. Previous selections remain visible and selected by default when resubmission is allowed.

#### Feature: Selection Submission
- **Description**: Lock client selections with final submission
- **Inputs**: Access token, album ID
- **Outputs**: Submission confirmation, locked status
- **Behavior**: Validate album status is OPEN (block if CLOSED), validate deadline (block if past deadline), set hasSubmitted=true and submittedAt timestamp, lock all selections, prevent further changes, notify photographer. Block if album is CLOSED regardless of deadline or resubmission permission. Resubmissions require album to be OPEN (reopen if CLOSED, then use Client Resubmission Control).

#### Feature: Deadline Enforcement
- **Description**: Prevent selections and submissions after album deadline, allow read-only viewing
- **Inputs**: Access token, current timestamp
- **Outputs**: Access granted/denied, deadline status, view-only mode indicator
- **Behavior**: Check album deadline, compare with current time. If deadline passed: block selection/submission actions, allow gallery viewing in read-only mode. When album is CLOSED after deadline, resubmission requires reopening album to OPEN status first, then using Client Resubmission Control to allow specific clients to resubmit.

#### Feature: Deadline Auto-Submission
- **Description**: Automatically submit all unsubmitted clients when album deadline passes via scheduled job (same auto-submission logic used when manually closing albums)
- **Inputs**: Album ID, deadline timestamp
- **Outputs**: Auto-submission records, notifications sent
- **Behavior**: Scheduled job checks for passed deadlines periodically. For each album with passed deadline: identify clients with hasSubmitted=false, auto-submit their current selections (even if empty/zero selections), update hasSubmitted=true and set submittedAt timestamp, change album status to CLOSED, notify photographer with list of clients who were unsubmitted, notify each auto-submitted client of their submission. This same auto-submission logic is executed when photographer manually closes an album via Album Status Management.

### Capability: Selection Synchronization
Syncs client selections back to Lightroom Classic via plugin.

#### Feature: Selection Retrieval
- **Description**: Provide client selections to Lightroom plugin
- **Inputs**: Album ID, photographer authentication
- **Outputs**: List of selected photos with client metadata
- **Behavior**: Authenticate photographer, aggregate selections, format for plugin consumption

#### Feature: Lightroom Collection Creation
- **Description**: Create Lightroom collections from client selections (plugin-side)
- **Inputs**: Selected photo list, album name
- **Outputs**: Lightroom collection with selected photos
- **Behavior**: Group selections, create collection, tag photos with approval metadata

#### Feature: Multi-Client Selection Aggregation
- **Description**: Combine selections from multiple clients per photo
- **Inputs**: Album ID, photo ID
- **Outputs**: Aggregated selection data with client counts
- **Behavior**: Query all client selections, aggregate by photo, count approvals

### Capability: Progress Tracking & Notifications
Monitors client progress and sends automated communications.

#### Feature: Progress Dashboard
- **Description**: Display real-time client submission status and selection counts
- **Inputs**: Album ID, photographer authentication
- **Outputs**: Progress metrics, client status list, selection statistics
- **Behavior**: Query client submissions, calculate completion rates, format for display

#### Feature: Email Notifications
- **Description**: Send notifications for completion, deadline reminders, deadline pass events, manual album closing, and resubmission permissions
- **Inputs**: Event type, recipient email, album context
- **Outputs**: Email delivery confirmation
- **Behavior**: Generate email content, send via email service, track delivery status. Notify photographer when deadline passes with list of clients who were unsubmitted (before auto-submission occurs). Notify photographer when manually closing album with list of clients who were unsubmitted (before auto-submission occurs). Notify clients when: auto-submitted at deadline, auto-submitted during manual closing, manually allowed to resubmit, or album reopened and they are selected for resubmission.

#### Feature: Reminder System
- **Description**: Send automated reminders approaching deadlines
- **Inputs**: Album deadline, client submission status
- **Outputs**: Reminder emails sent
- **Behavior**: Check deadline proximity, identify incomplete clients, send reminders

### Capability: File Storage Management
Manages photo storage in cloud object storage with lifecycle policies.

#### Feature: Storage Organization
- **Description**: Organize photos in hierarchical structure by album and type
- **Inputs**: Album ID, photo type (review/delivery), file
- **Outputs**: Storage path, file URL
- **Behavior**: Generate hierarchical paths, upload to storage, return accessible URLs

#### Feature: Storage Lifecycle Management
- **Description**: Apply retention policies and optimize storage costs
- **Inputs**: Album status, completion date, file age
- **Outputs**: Lifecycle actions (archive, delete)
- **Behavior**: Evaluate retention policies, schedule archival, optimize storage tiers

#### Feature: CDN Integration
- **Description**: Serve photos via global CDN for fast delivery
- **Inputs**: Storage URLs, geographic location
- **Outputs**: CDN-optimized URLs
- **Behavior**: Generate CDN URLs, configure caching, handle edge delivery

</functional-decomposition>

---

<structural-decomposition>
<instruction>
NOW think about code organization. Map capabilities to actual file/folder structure.

Rules:
1. Each capability maps to a module (folder or file)
2. Features within a capability map to functions/classes
3. Use clear module boundaries - each module has ONE responsibility
4. Define what each module exports (public interface)

The goal: Create a clear mapping between "what it does" (functional) and "where it lives" (structural).
</instruction>

## Repository Structure

```
photoflow/
├── backend/
│   ├── src/
│   │   ├── auth/              # Authentication & Authorization
│   │   ├── albums/            # Album Management
│   │   ├── photos/            # Photo Upload & Processing
│   │   ├── selections/        # Client Photo Selection
│   │   ├── sync/              # Selection Synchronization
│   │   ├── notifications/      # Progress Tracking & Notifications
│   │   ├── storage/           # File Storage Management
│   │   ├── db/                # Database models and migrations
│   │   ├── middleware/        # Express middleware
│   │   ├── utils/             # Shared utilities
│   │   └── server.ts          # Express server setup
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js app router
│   │   │   ├── (dashboard)/   # Photographer dashboard routes
│   │   │   ├── client/        # Client photo selection routes
│   │   │   └── api/           # API route handlers
│   │   ├── components/        # React components
│   │   │   ├── dashboard/     # Dashboard components
│   │   │   ├── client/        # Client interface components
│   │   │   └── shared/        # Shared UI components
│   │   ├── lib/               # Client-side utilities
│   │   └── hooks/             # React hooks
│   ├── public/
│   └── package.json
├── lightroom-plugin/
│   ├── src/
│   │   ├── upload.lua         # Photo upload logic
│   │   ├── sync.lua           # Selection sync logic
│   │   ├── api-client.lua     # HTTP client for API
│   │   └── preferences.lua    # Plugin preferences
│   └── Info.lua               # Plugin metadata
└── shared/
    └── types/                  # Shared TypeScript types
```

## Module Definitions

### Module: auth
- **Maps to capability**: Authentication & Authorization
- **Responsibility**: Handle photographer authentication and client access control
- **File structure**:
  ```
  auth/
  ├── photographer-auth.ts      # Photographer authentication
  ├── client-access.ts          # Client access control
  ├── session.ts                # Session management
  ├── middleware.ts             # Auth middleware
  └── index.ts                  # Public exports
  ```
- **Exports**:
  - `authenticatePhotographer()` - Authenticate photographer and return JWT
  - `validateClientToken()` - Validate client access token
  - `refreshSession()` - Refresh photographer session
  - `requireAuth()` - Express middleware for protected routes

### Module: albums
- **Maps to capability**: Album Management
- **Responsibility**: Manage album lifecycle and client invitations
- **File structure**:
  ```
  albums/
  ├── create.ts                # Album creation
  ├── invitations.ts            # Client invitation
  ├── config.ts                # Album configuration
  ├── status.ts                # Status management
  ├── resubmission.ts          # Client resubmission control
  └── index.ts                 # Public exports
  ```
- **Exports**:
  - `createAlbum()` - Create new album
  - `addClient()` - Add client to album
  - `updateAlbumSettings()` - Update album configuration
  - `updateAlbumStatus()` - Change album status (OPEN/CLOSED)
  - `allowClientResubmission()` - Enable resubmission for specific client (requires album status OPEN)

### Module: photos
- **Maps to capability**: Photo Upload & Processing
- **Responsibility**: Handle photo uploads, processing, and storage
- **File structure**:
  ```
  photos/
  ├── upload.ts                # Photo upload handler
  ├── processing.ts            # Image processing
  ├── delta-sync.ts             # Delta sync detection
  ├── delivery.ts              # Final photo delivery
  └── index.ts                 # Public exports
  ```
- **Exports**:
  - `uploadPhotos()` - Upload photos from plugin
  - `processImage()` - Generate thumbnails and previews
  - `getSyncStatus()` - Get delta sync status
  - `uploadFinals()` - Upload final edited photos

### Module: selections
- **Maps to capability**: Client Photo Selection
- **Responsibility**: Handle client photo browsing and selection
- **File structure**:
  ```
  selections/
  ├── gallery.ts                # Photo gallery display
  ├── toggle.ts                # Selection toggle
  ├── submit.ts                # Selection submission
  ├── deadline.ts              # Deadline enforcement
  ├── auto-submit.ts            # Deadline auto-submission
  └── index.ts                 # Public exports
  ```
- **Exports**:
  - `getGalleryPhotos()` - Get photos for client gallery
  - `toggleSelection()` - Toggle photo selection
  - `submitSelections()` - Submit final selections
  - `checkDeadline()` - Validate deadline access
  - `processDeadlineAutoSubmission()` - Auto-submit unsubmitted clients at deadline

### Module: sync
- **Maps to capability**: Selection Synchronization
- **Responsibility**: Sync client selections to Lightroom plugin
- **File structure**:
  ```
  sync/
  ├── retrieve.ts              # Selection retrieval
  ├── aggregate.ts             # Multi-client aggregation
  └── index.ts                 # Public exports
  ```
- **Exports**:
  - `getSelections()` - Get selections for plugin
  - `aggregateSelections()` - Aggregate multi-client selections

### Module: notifications
- **Maps to capability**: Progress Tracking & Notifications
- **Responsibility**: Track progress and send notifications
- **File structure**:
  ```
  notifications/
  ├── progress.ts              # Progress dashboard
  ├── email.ts                 # Email notifications
  ├── reminders.ts             # Reminder system
  └── index.ts                 # Public exports
  ```
- **Exports**:
  - `getProgress()` - Get album progress metrics
  - `sendNotification()` - Send email notification (completion, deadline pass, resubmission permissions)
  - `sendReminders()` - Send deadline reminders
  - `notifyDeadlinePass()` - Notify photographer of unsubmitted clients at deadline
  - `notifyAutoSubmission()` - Notify clients of auto-submission

### Module: storage
- **Maps to capability**: File Storage Management
- **Responsibility**: Manage cloud storage and CDN integration
- **File structure**:
  ```
  storage/
  ├── upload.ts                # File upload to storage
  ├── lifecycle.ts             # Lifecycle management
  ├── cdn.ts                   # CDN integration
  └── index.ts                 # Public exports
  ```
- **Exports**:
  - `uploadFile()` - Upload file to storage
  - `getFileUrl()` - Get CDN-optimized URL
  - `manageLifecycle()` - Apply lifecycle policies

### Module: db
- **Maps to capability**: Database layer (foundation)
- **Responsibility**: Database models, migrations, and queries
- **File structure**:
  ```
  db/
  ├── schema.prisma            # Prisma schema
  ├── migrations/              # Database migrations
  ├── client.ts                # Prisma client
  └── index.ts                 # Public exports
  ```
- **Exports**:
  - `prisma` - Prisma client instance
  - Database models (User, Album, Photo, etc.)

</structural-decomposition>

---

<dependency-graph>
<instruction>
This is THE CRITICAL SECTION for Task Master parsing.

Define explicit dependencies between modules. This creates the topological order for task execution.

Rules:
1. List modules in dependency order (foundation first)
2. For each module, state what it depends on
3. Foundation modules should have NO dependencies
4. Every non-foundation module should depend on at least one other module
5. Think: "What must EXIST before I can build this module?"
</instruction>

## Dependency Chain

### Foundation Layer (Phase 0)
No dependencies - these are built first.

- **db**: Database schema, Prisma client, migrations
- **storage**: Core storage utilities, CDN configuration
- **utils**: Shared utilities (error handling, validation, logging)

### Data & Infrastructure Layer (Phase 1)
Depends on foundation modules.

- **auth**: Depends on [db, utils]
- **photos**: Depends on [db, storage, utils]

### Core Business Logic Layer (Phase 2)
Depends on data layer.

- **albums**: Depends on [db, auth, utils]
- **selections**: Depends on [db, auth, utils]
- **sync**: Depends on [db, albums, selections, utils]

### Application Layer (Phase 3)
Depends on core business logic.

- **notifications**: Depends on [db, albums, selections, utils]

### API & Integration Layer (Phase 4)
Depends on all previous layers.

- **api-routes**: Depends on [auth, albums, photos, selections, sync, notifications]
- **lightroom-plugin**: Depends on [api-routes] (external dependency)

### Frontend Layer (Phase 5)
Depends on API layer.

- **frontend-dashboard**: Depends on [api-routes]
- **frontend-client**: Depends on [api-routes]

</dependency-graph>

---

<implementation-roadmap>
<instruction>
Turn the dependency graph into concrete development phases.

Each phase should:
1. Have clear entry criteria (what must exist before starting)
2. Contain tasks that can be parallelized (no inter-dependencies within phase)
3. Have clear exit criteria (how do we know phase is complete?)
4. Build toward something USABLE (not just infrastructure)

Phase ordering follows topological sort of dependency graph.
</instruction>

## Development Phases

### Phase 0: Foundation Infrastructure
**Goal**: Establish database schema, storage infrastructure, and shared utilities

**Entry Criteria**: Clean repository, Node.js/TypeScript environment configured

**Tasks**:
- [ ] Database schema design and Prisma setup (depends on: none)
  - Acceptance criteria: Prisma schema defines all entities (User, Album, Photo, AlbumClient, PhotoSelection), migrations run successfully
  - Test strategy: Schema validation tests, migration rollback tests

- [ ] Storage service integration (depends on: none)
  - Acceptance criteria: Cloudflare R2 client configured, file upload/download working, CDN URLs generated
  - Test strategy: Integration tests for storage operations, CDN URL generation

- [ ] Shared utilities module (depends on: none)
  - Acceptance criteria: Error handling, validation helpers, logging utilities available
  - Test strategy: Unit tests for all utility functions

**Exit Criteria**: Database migrations run, storage service accessible, utilities importable

**Delivers**: Foundation for all other modules to build upon

---

### Phase 1: Data & Infrastructure Layer
**Goal**: Implement authentication and photo processing infrastructure

**Entry Criteria**: Phase 0 complete (db, storage, utils available)

**Tasks**:
- [ ] Authentication module (depends on: [db, utils])
  - Acceptance criteria: Photographer login/logout working, JWT generation/validation, client token generation
  - Test strategy: Unit tests for auth functions, integration tests for login flow

- [ ] Photo processing module (depends on: [db, storage, utils])
  - Acceptance criteria: Image resizing (300px, 1200px), format conversion (JPEG/WebP), upload to storage
  - Test strategy: Unit tests for image processing, integration tests for upload pipeline

**Exit Criteria**: Photographers can authenticate, photos can be processed and stored

**Delivers**: Core infrastructure for user management and photo handling

---

### Phase 2: Core Business Logic
**Goal**: Implement album management, client selection, and sync capabilities

**Entry Criteria**: Phase 1 complete (auth, photos available)

**Tasks**:
- [ ] Album management module (depends on: [db, auth, utils])
  - Acceptance criteria: Create/update albums, add clients, generate access tokens, manage status (OPEN/CLOSED), client resubmission control (requires OPEN status)
  - Test strategy: Unit tests for album operations, integration tests for client invitation flow, reopening workflow (status change then resubmission control)

- [ ] Client selection module (depends on: [db, auth, utils])
  - Acceptance criteria: Gallery display, selection toggle, submission locking, deadline enforcement, deadline auto-submission, read-only mode after deadline
  - Test strategy: Unit tests for selection logic, integration tests for submission flow, scheduled job tests for auto-submission

- [ ] Selection sync module (depends on: [db, albums, selections, utils])
  - Acceptance criteria: Retrieve selections, aggregate multi-client data, format for plugin
  - Test strategy: Unit tests for aggregation logic, integration tests for sync API

**Exit Criteria**: Albums can be created and managed, clients can select photos, selections can be retrieved

**Delivers**: Complete core workflow from album creation to selection retrieval

---

### Phase 3: Application Features
**Goal**: Add progress tracking and notification system

**Entry Criteria**: Phase 2 complete (albums, selections, sync available)

**Tasks**:
- [ ] Notifications module (depends on: [db, albums, selections, utils])
  - Acceptance criteria: Progress dashboard API, email notifications, reminder scheduling, deadline pass notifications, auto-submission notifications, resubmission permission notifications
  - Test strategy: Unit tests for notification logic, integration tests for email delivery, scheduled job tests

**Exit Criteria**: Progress can be tracked, notifications sent successfully

**Delivers**: Complete visibility into client progress and automated communications

---

### Phase 4: API & Integration Layer
**Goal**: Expose REST API and develop Lightroom plugin

**Entry Criteria**: Phase 3 complete (all core modules available)

**Tasks**:
- [ ] API routes implementation (depends on: [auth, albums, photos, selections, sync, notifications])
  - Acceptance criteria: All endpoints implemented, OpenAPI documentation, error handling
  - Test strategy: Integration tests for all endpoints, E2E tests for complete workflows

- [ ] Lightroom plugin development (depends on: [api-routes])
  - Acceptance criteria: Photo upload from Lightroom, selection sync, collection creation
  - Test strategy: Manual testing in Lightroom, integration tests for plugin API calls

**Exit Criteria**: API fully functional, plugin can upload photos and sync selections

**Delivers**: Complete backend system with Lightroom integration

---

### Phase 5: Frontend Application
**Goal**: Build photographer dashboard and client interface

**Entry Criteria**: Phase 4 complete (API available)

**Tasks**:
- [ ] Photographer dashboard (depends on: [api-routes])
  - Acceptance criteria: Album management UI, progress dashboard, client management
  - Test strategy: E2E tests for dashboard workflows, responsive design testing

- [ ] Client photo selection interface (depends on: [api-routes])
  - Acceptance criteria: Mobile-responsive gallery, selection UI, submission flow
  - Test strategy: E2E tests for client workflow, mobile device testing

**Exit Criteria**: Photographers can manage albums via dashboard, clients can select photos via web interface

**Delivers**: Complete user-facing application

---

### Phase 6: Polish & Launch
**Goal**: Performance optimization, security hardening, deployment

**Entry Criteria**: Phase 5 complete (full application working)

**Tasks**:
- [ ] Performance optimization (depends on: [all modules])
  - Acceptance criteria: <200ms API responses, <2s page loads, optimized image delivery
  - Test strategy: Load testing, performance profiling

- [ ] Security hardening (depends on: [all modules])
  - Acceptance criteria: Security audit passed, rate limiting, input validation
  - Test strategy: Security testing, penetration testing

- [ ] Deployment and monitoring (depends on: [all modules])
  - Acceptance criteria: Production deployment, monitoring setup, error tracking
  - Test strategy: Deployment verification, monitoring validation

**Exit Criteria**: Application deployed, monitored, and meeting performance targets

**Delivers**: Production-ready system

</implementation-roadmap>

---

<test-strategy>
<instruction>
Define how testing will be integrated throughout development (TDD approach).

Specify:
1. Test pyramid ratios (unit vs integration vs e2e)
2. Coverage requirements
3. Critical test scenarios
4. Test generation guidelines for Surgical Test Generator

This section guides the AI when generating tests during the RED phase of TDD.
</instruction>

## Test Pyramid

```
        /\
       /E2E\       ← 10% (End-to-end, slow, comprehensive)
      /------\
     /Integration\ ← 30% (Module interactions, API tests)
    /------------\
   /  Unit Tests  \ ← 60% (Fast, isolated, deterministic)
  /----------------\
```

## Coverage Requirements
- Line coverage: 90% minimum
- Branch coverage: 85% minimum
- Function coverage: 90% minimum
- Statement coverage: 90% minimum

## Critical Test Scenarios

### Authentication Module
**Happy path**:
- Photographer logs in with valid credentials
- Expected: JWT token returned, session created

**Edge cases**:
- Invalid credentials, expired tokens, missing tokens
- Expected: Appropriate error responses (401, 403)

**Error cases**:
- Database connection failure, invalid credentials
- Expected: Graceful error handling, user-friendly messages

**Integration points**:
- Auth middleware protecting routes
- Expected: Unauthenticated requests rejected, authenticated requests proceed

### Album Management Module
**Happy path**:
- Create album, add clients, generate access tokens
- Expected: Album created, clients added, tokens generated
- Photographer manually closes album
- Expected: Unsubmitted clients auto-submitted, album status set to CLOSED, photographer and clients notified

**Edge cases**:
- Duplicate client emails, past deadlines, invalid album IDs
- Expected: Validation errors, appropriate error messages
- Closing album with all clients already submitted
- Expected: Album status set to CLOSED, no auto-submission needed, photographer notified

**Error cases**:
- Database constraint violations, storage failures
- Expected: Transaction rollback, error recovery

**Integration points**:
- Album creation triggers client invitation emails
- Expected: Emails sent, client records created

### Photo Upload & Processing Module
**Happy path**:
- Upload photos, process images, store in cloud
- Expected: Photos uploaded, thumbnails/previews generated, URLs returned

**Edge cases**:
- Large files (>10MB), unsupported formats, corrupted images
- Expected: Validation errors, format conversion, error handling

**Error cases**:
- Storage service failures, image processing errors
- Expected: Retry logic, error logging, user notification

**Integration points**:
- Delta sync detects new photos
- Expected: Only new/changed photos uploaded

### Client Selection Module
**Happy path**:
- Client selects photos, submits selections
- Expected: Selections saved, submission locked, photographer notified
- Deadline passes, unsubmitted clients auto-submitted
- Expected: All unsubmitted clients auto-submitted (even with zero selections), album status set to CLOSED, photographer and clients notified
- Photographer manually closes album (before deadline)
- Expected: All unsubmitted clients auto-submitted (even with zero selections), album status set to CLOSED, photographer and clients notified (same behavior as deadline auto-submission)
- Photographer reopens album (sets status to OPEN), then uses Client Resubmission Control to allow specific clients
- Expected: Album status is OPEN, selected clients can modify preserved selections (hasSubmitted reset to false), non-selected clients can view in read-only mode
- Photographer allows specific client to resubmit manually (before deadline, album already OPEN)
- Expected: Client's hasSubmitted reset to false, previous selections preserved and modifiable, client notified, album remains OPEN

**Edge cases**:
- Selection when album is CLOSED (blocked regardless of deadline or hasSubmitted status), duplicate selections, invalid tokens
- Expected: Album status check (OPEN required), deadline enforcement, resubmission permission checks, idempotent operations, token validation
- Client views gallery when album is CLOSED
- Expected: Read-only mode, selections visible but not modifiable
- Attempting Client Resubmission Control when album is CLOSED
- Expected: Operation blocked, album must be reopened first
- Reopening album but not using Client Resubmission Control
- Expected: Album is OPEN, but all clients remain locked (hasSubmitted=true), read-only mode for all

**Error cases**:
- Database failures during submission, concurrent selections, auto-submission job failures
- Expected: Transaction safety, conflict resolution, retry logic for scheduled jobs

**Integration points**:
- Selection submission triggers notification
- Expected: Email sent, progress updated
- Deadline auto-submission triggers notifications
- Expected: Photographer notified of unsubmitted clients, each client notified of auto-submission

### Selection Sync Module
**Happy path**:
- Plugin retrieves selections, creates Lightroom collections
- Expected: Selections returned, collections created

**Edge cases**:
- Multiple clients selecting same photo, no selections
- Expected: Aggregation works, empty state handled

**Error cases**:
- API failures, Lightroom SDK errors
- Expected: Error messages, retry logic

**Integration points**:
- Sync triggers collection creation in Lightroom
- Expected: Collections match selections

## Test Generation Guidelines

1. **Follow TDD workflow**: Write tests (RED) → Implement (GREEN) → Refactor
2. **Test naming**: Use descriptive names like `should return JWT token when credentials are valid`
3. **Arrange-Act-Assert pattern**: Clear setup, action, verification
4. **Mock external dependencies**: Storage, email service, Lightroom SDK
5. **Test data factories**: Use factories for creating test entities
6. **Integration test isolation**: Each test cleans up after itself
7. **E2E test scenarios**: Cover complete user journeys (create album → upload photos → client selects → deliver)
8. **Performance tests**: Include load testing for photo upload and gallery loading
9. **Security tests**: Test authentication, authorization, input validation
10. **Accessibility tests**: Verify WCAG compliance for client interface

</test-strategy>

---

<architecture>
<instruction>
Describe technical architecture, data models, and key design decisions.

Keep this section AFTER functional/structural decomposition - implementation details come after understanding structure.
</instruction>

## System Components

### Backend Server
- **Technology**: Node.js + Express + TypeScript
- **Responsibility**: RESTful API, business logic, database access
- **Deployment**: Railway/Render hosting

### Frontend Application
- **Technology**: Next.js + TypeScript + Tailwind CSS + shadcn/ui
- **Responsibility**: Photographer dashboard, client photo selection interface
- **Deployment**: Vercel hosting

### Database
- **Technology**: PostgreSQL + Prisma ORM
- **Responsibility**: Data persistence, relationships, migrations
- **Deployment**: Managed PostgreSQL with automated backups

### Object Storage
- **Technology**: Cloudflare R2
- **Responsibility**: Photo file storage, CDN delivery
- **Deployment**: Cloudflare R2 with global CDN

### Lightroom Plugin
- **Technology**: Lua + Lightroom Classic SDK
- **Responsibility**: Photo upload, selection sync, collection creation
- **Deployment**: Local installation via plugin manager

## Data Models

### Database Schema

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  passwordHash  String?
  googleId      String?  @unique
  createdAt     DateTime @default(now())
  albums        Album[]
}

model Album {
  id            String        @id @default(cuid())
  photographerId String
  photographer  User          @relation(fields: [photographerId], references: [id])
  title         String
  passwordHash  String
  deadline      DateTime
  status        AlbumStatus   @default(OPEN)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  photos        Photo[]
  clients       AlbumClient[]
}

model Photo {
  id           String   @id @default(cuid())
  albumId      String
  album        Album    @relation(fields: [albumId], references: [id])
  filename     String
  thumbnailUrl String
  previewUrl   String
  originalUrl  String?
  metadata     Json?
  uploadedAt   DateTime @default(now())
  selections   PhotoSelection[]
}

model AlbumClient {
  id           String   @id @default(cuid())
  albumId      String
  album        Album    @relation(fields: [albumId], references: [id])
  email        String
  name         String
  accessToken  String   @unique
  hasSubmitted Boolean  @default(false)
  submittedAt  DateTime?
  createdAt    DateTime @default(now())
  selections   PhotoSelection[]
}

model PhotoSelection {
  id         String      @id @default(cuid())
  photoId    String
  photo      Photo       @relation(fields: [photoId], references: [id])
  clientId   String
  client     AlbumClient @relation(fields: [clientId], references: [id])
  selected   Boolean     @default(false)
  selectedAt DateTime?
  createdAt  DateTime    @default(now())
  
  @@unique([photoId, clientId])
}

enum AlbumStatus {
  OPEN
  CLOSED
  COMPLETED
}
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Storage**: Cloudflare R2
- **Image Processing**: Sharp
- **Authentication**: JWT, bcrypt (Google OAuth planned for future version)
- **Scheduled Jobs**: Background job processing for deadline auto-submission (e.g., node-cron, Bull, or similar)

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **State Management**: React hooks, React Query (if needed)

### Lightroom Plugin
- **Language**: Lua
- **SDK**: Lightroom Classic SDK
- **HTTP Client**: LrHttp module (built-in SDK module for HTTP/HTTPS requests)

**Decision: Next.js App Router**
- **Rationale**: Modern React patterns, server components for performance, built-in API routes
- **Trade-offs**: Learning curve, less mature than Pages Router
- **Alternatives considered**: Pages Router (more stable), Remix (different paradigm)

**Decision: Prisma ORM**
- **Rationale**: Type-safe database access, migration management, excellent TypeScript support
- **Trade-offs**: Slightly heavier than raw SQL, learning curve
- **Alternatives considered**: TypeORM (less type-safe), raw SQL (more verbose)

**Decision: Cloudflare R2**
- **Rationale**: S3-compatible API, global CDN, cost-effective storage
- **Trade-offs**: Vendor lock-in, less mature than AWS S3
- **Alternatives considered**: AWS S3 (more expensive), Google Cloud Storage (more complex)

**Decision: Sharp for Image Processing**
- **Rationale**: Fast, efficient, supports WebP, good TypeScript support
- **Trade-offs**: Native dependency, larger bundle size
- **Alternatives considered**: Jimp (slower), ImageMagick (more complex)

</architecture>

---

<risks>
<instruction>
Identify risks that could derail development and how to mitigate them.

Categories:
- Technical risks (complexity, unknowns)
- Dependency risks (blocking issues)
- Scope risks (creep, underestimation)
</instruction>

## Technical Risks

**Risk**: Lightroom SDK limitations and complexity
- **Impact**: High - Core feature depends on plugin functionality
- **Likelihood**: Medium
- **Mitigation**: Early prototype development, Adobe developer consultation, extensive testing across Lightroom versions
- **Fallback**: Manual upload workflow as temporary solution, focus on web interface first

**Risk**: Large file upload handling and performance
- **Impact**: High - Photo uploads are core functionality
- **Likelihood**: Medium
- **Mitigation**: Chunked upload implementation, progress tracking, background processing, CDN optimization
- **Fallback**: Reduce image quality temporarily, implement queuing system

**Risk**: Database performance with large photo counts (100,000+ photos)
- **Impact**: Medium - Scalability concern
- **Likelihood**: Low (initially)
- **Mitigation**: Query optimization, proper indexing, pagination, database connection pooling
- **Fallback**: Implement caching layer, consider read replicas

**Risk**: Image processing performance bottlenecks
- **Impact**: Medium - Slow uploads affect user experience
- **Likelihood**: Medium
- **Mitigation**: Background job processing, parallel processing, optimized Sharp settings
- **Fallback**: Reduce image quality, implement queuing system

## Dependency Risks

**Risk**: Cloudflare R2 service outages or API changes
- **Impact**: High - Core storage dependency
- **Likelihood**: Low
- **Mitigation**: Abstract storage layer, implement retry logic, monitor service status
- **Fallback**: Switch to alternative S3-compatible storage (AWS S3, Backblaze B2)

**Risk**: Lightroom Classic SDK version compatibility
- **Impact**: High - Plugin must work across Lightroom versions
- **Likelihood**: Medium
- **Mitigation**: Test across multiple Lightroom versions, version detection, graceful degradation
- **Fallback**: Support only latest Lightroom version initially

**Risk**: Third-party email service reliability
- **Impact**: Medium - Notifications are important but not critical
- **Likelihood**: Low
- **Mitigation**: Use reliable provider (SendGrid, Resend), implement retry logic, queue failed emails
- **Fallback**: Log notifications for manual sending, implement in-app notifications

## Scope Risks

**Risk**: Feature creep during development
- **Impact**: Medium - Timeline delays, complexity increase
- **Likelihood**: High
- **Mitigation**: Strict PRD adherence, feature freeze after Phase 5, document future enhancements
- **Fallback**: Defer non-critical features to v2.0

**Risk**: Underestimation of Lightroom plugin complexity
- **Impact**: High - Core differentiator feature
- **Likelihood**: Medium
- **Mitigation**: Allocate extra time in Phase 4, early prototyping, consult Adobe documentation
- **Fallback**: Extend timeline, prioritize web interface features

**Risk**: Photographer adoption challenges
- **Impact**: High - Business success depends on adoption
- **Likelihood**: Medium
- **Mitigation**: Extensive user testing, onboarding optimization, clear documentation, video tutorials
- **Fallback**: Focus on client experience first, simplify photographer workflow

**Risk**: Storage cost escalation with scale
- **Impact**: Medium - Affects profitability
- **Likelihood**: Medium
- **Mitigation**: Tiered storage strategy, lifecycle management, usage monitoring, cost alerts
- **Fallback**: Implement storage limits, optimize image compression further

</risks>

---

<appendix>
## References

- Adobe Lightroom Classic SDK Documentation
- Prisma Documentation: https://www.prisma.io/docs
- Next.js App Router Documentation: https://nextjs.org/docs
- Cloudflare R2 Documentation: https://developers.cloudflare.com/r2
- Sharp Image Processing: https://sharp.pixelplumbing.com
- shadcn/ui Components: https://ui.shadcn.com

## Glossary

- **Album**: A collection of photos shared with clients for review
- **Access Token**: Unique, secure token granting client access to an album
- **Delta Sync**: Process of detecting and uploading only new/changed photos
- **Selection**: A client's choice to include a photo in their final set
- **Submission**: Final locking of client selections, preventing further changes
- **Auto-Submission**: Automatic submission of unsubmitted clients when album deadline passes
- **Resubmission**: Process of allowing a client who has already submitted to modify and resubmit their selections
- **Review Photos**: Thumbnails and previews shared for client selection
- **Final Photos**: High-resolution edited photos delivered after selection
- **Lightroom Collection**: A grouping of photos within Lightroom Classic

## Open Questions

1. Should we support batch photo deletion from albums?
2. What is the maximum number of clients per album?
3. Should we implement photo commenting/review features in v1.0?
4. How long should access tokens remain valid after album completion?
5. Should we support custom branding for photographer dashboards?
6. What file size limits should we enforce for photo uploads?
7. Should we implement automatic album archival after a certain period?
8. How should we handle duplicate photo uploads (same file, different album)?

</appendix>

---

<task-master-integration>
# How Task Master Uses This PRD

When you run `task-master parse-prd <file>.md`, the parser:

1. **Extracts capabilities** → Main tasks
   - Each `### Capability:` becomes a top-level task

2. **Extracts features** → Subtasks
   - Each `#### Feature:` becomes a subtask under its capability

3. **Parses dependencies** → Task dependencies
   - `Depends on: [X, Y]` sets task.dependencies = ["X", "Y"]

4. **Orders by phases** → Task priorities
   - Phase 0 tasks = highest priority
   - Phase N tasks = lower priority, properly sequenced

5. **Uses test strategy** → Test generation context
   - Feeds test scenarios to Surgical Test Generator during implementation

**Result**: A dependency-aware task graph that can be executed in topological order.

## Why RPG Structure Matters

Traditional flat PRDs lead to:
- ❌ Unclear task dependencies
- ❌ Arbitrary task ordering
- ❌ Circular dependencies discovered late
- ❌ Poorly scoped tasks

RPG-structured PRDs provide:
- ✅ Explicit dependency chains
- ✅ Topological execution order
- ✅ Clear module boundaries
- ✅ Validated task graph before implementation

## Tips for Best Results

1. **Spend time on dependency graph** - This is the most valuable section for Task Master
2. **Keep features atomic** - Each feature should be independently testable
3. **Progressive refinement** - Start broad, use `task-master expand` to break down complex tasks
4. **Use research mode** - `task-master parse-prd --research` leverages AI for better task generation
</task-master-integration>
