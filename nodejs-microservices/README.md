# Node.js Microservices Monorepo

A production-ready microservices application built with **Node.js**, **Express**, and **JavaScript (ES Modules)**. This project features a clean microservices architecture including an API Gateway, JWT authentication, role-based access control (RBAC), file uploads to S3-compatible storage (e.g. AWS S3, Cloudflare R2, MinIO), PostgreSQL integration (supports **Neon PostgreSQL**), and event-driven communication via Apache Kafka — all managed as an npm workspace monorepo.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services](#services)
  - [API Gateway](#api-gateway-port-3000)
  - [Auth Service](#auth-service-port-3001)
  - [Task Service](#task-service-port-3002)
  - [Media Service](#media-service-port-3003)
  - [Workflow Service](#workflow-service-port-3004)
- [Shared Package](#shared-package)
- [Database Schema & Neon PostgreSQL Integration](#database-schema--neon-postgresql-integration)
- [Event-Driven Architecture (Kafka)](#event-driven-architecture-kafka)
- [Security Model](#security-model)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables & `.env` Setup](#environment-variables---env-setup)
- [Getting Started](#getting-started)
- [Running the Services](#running-the-services)
- [API Reference](#api-reference)
- [Database Migrations](#database-migrations)
- [Scripts Reference](#scripts-reference)

---

## Architecture Overview

```
                        +-------------------------------------+
                        |       Client (Browser/App)          |
                        +----------------+--------------------+
                                         |  HTTP
                                         v
                        +-------------------------------------+
                        |       API Gateway (:3000)           |
                        |  - Rate limiting (100 req/15 min)   |
                        |  - Helmet (secure HTTP headers)     |
                        |  - CORS                             |
                        |  - JWT verification                 |
                        |  - RBAC enforcement                 |
                        |  - Request proxying                 |
                        |  - Strips client identity headers   |
                        |  - Injects gateway secret           |
                        +---+----------+----------+-----------+
                            |          |          |
           +----------------+  +-------+---+  +--+-----------+  +-----------------+
           v                   v           v                  v                   v
  +-----------------+  +-------------+  +--------------+  +----------------+
  |  Auth Service   |  |Task Service |  |Media Service |  |Workflow Service|
  |    (:3001)      |  |   (:3002)   |  |   (:3003)    |  |    (:3004)     |
  |  - Register     |  | - CRUD tasks|  | - Upload to  |  | - Kafka        |
  |  - Login        |  | - Role-based|  |   S3/compat. |  |   consumer     |
  |  - Get profile  |  |   filtering |  | - List files |  | - Audit trail  |
  +--------+--------+  +------+------+  +------+-------+  +-------+--------+
           |                  |                |                   |
           +------------------+----------------+                   |
                              |    PostgreSQL DB                   |
                              v                                    |
                    +-----------------+        +-------------------+
                    |   PostgreSQL    |        |  Kafka Topics:
                    | (Neon/Local)    |<-------|    - task.events
                    |  - users        |        |    - media.events
                    |  - tasks        |        +-------------------
                    |  - attachments  |
                    |  - task_workflows|
                    +-----------------+
```

All inter-service communication (client to services) is routed **exclusively** through the API Gateway. Downstream services validate each incoming request using a shared `GATEWAY_SECRET` to prevent direct, unauthorized access.

---

## Services

### API Gateway (Port 3000)

The single entry point for all client traffic:

- **Rate Limiting**: 100 requests per IP per 15-minute window via `express-rate-limit`.
- **Security Headers**: Enforced by `helmet`.
- **CORS**: Enabled for cross-origin requests.
- **JWT Authentication**: Verifies Bearer tokens on all protected routes.
- **RBAC**: Checks role permissions before forwarding any request (`USER`, `ADMIN`).
- **Request Proxying**: Forwards traffic to the correct downstream service using `http-proxy-middleware`.
- **Identity Header Injection**: Strips client-supplied identity headers (`x-user-id`, `x-user-role`), re-injecting them from the verified JWT payload.
- **Gateway Secret**: Attaches `x-gateway-secret` to all proxied requests so downstream services confirm traffic passed through the gateway.

**Routing matrix:**

| Incoming Path (`:3000`)           | Forwarded To                         | Service          |
|-----------------------------------|--------------------------------------|------------------|
| `POST /auth/register`             | `:3001/auth/register`                | Auth Service     |
| `POST /auth/login`                | `:3001/auth/login`                   | Auth Service     |
| `GET /auth/me`                    | `:3001/auth/me`                      | Auth Service     |
| `GET/POST /tasks`                 | `:3002/tasks`                        | Task Service     |
| `GET/DELETE /tasks/:id`           | `:3002/tasks/:id`                    | Task Service     |
| `POST/GET /tasks/:id/attachments` | `:3003/tasks/:id/attachments`        | Media Service    |
| `GET /tasks/:id/workflows`        | `:3004/tasks/:id/workflows`          | Workflow Service |

---

### Auth Service (Port 3001)

Handles user registration, authentication, password hashing, and user profile retrieval.

**Endpoints:**

| Method | Path             | Gateway Auth | Body / Params               | Description                  |
|--------|------------------|--------------|-----------------------------|------------------------------|
| `POST` | `/auth/register` | None         | `{ name, email, password }` | Register a new user (`USER`) |
| `POST` | `/auth/login`    | None         | `{ email, password }`       | Authenticate & return JWT    |
| `GET`  | `/auth/me`       | Bearer JWT   | Header `x-user-id`          | Get user profile             |

- Uses `bcryptjs` for password hashing with 10 salt rounds.
- Generates JWT tokens containing `userId` and `role`.
- `ADMIN` roles are assigned directly in the database.

---

### Task Service (Port 3002)

Manages task creation, retrieval, listing, and deletion with role-aware authorization.

**Endpoints:**

| Method   | Path         | Auth Required      | Description                                     |
|----------|--------------|--------------------|-------------------------------------------------|
| `POST`   | `/tasks`     | `USER`, `ADMIN`    | Create a new task                               |
| `GET`    | `/tasks`     | `USER`, `ADMIN`    | List tasks (Filtered by user role)             |
| `GET`    | `/tasks/:id` | `USER`, `ADMIN`    | Get task by ID (Owner or Admin)                 |
| `DELETE` | `/tasks/:id` | `ADMIN` only       | Delete a task                                   |

- When listing tasks, `USER` role only sees their own tasks; `ADMIN` sees all tasks.
- Publishes a `task.created` event to the `task.events` Kafka topic upon creation.

---

### Media Service (Port 3003)

Handles image file uploads and listing of task attachments. Storage uses S3-compatible providers (AWS S3, Cloudflare R2, MinIO).

**Endpoints:**

| Method | Path                         | Auth Required      | Description                           |
|--------|------------------------------|--------------------|---------------------------------------|
| `POST` | `/tasks/:taskId/attachments` | `USER`, `ADMIN`    | Upload image attachment for a task    |
| `GET`  | `/tasks/:taskId/attachments` | `USER`, `ADMIN`    | List all attachments for a task       |

- File uploads processed via `multer` in memory, then uploaded to S3.
- Accepts image files up to **10 MB**.
- Publishes an `attachment.uploaded` event to the `media.events` Kafka topic.

---

### Workflow Service (Port 3004)

A **Kafka consumer service** that listens to `task.events` and `media.events` topics, writing audit trail entries (`task_workflows`) to the database.

**Endpoints:**

| Method | Path                       | Auth Required      | Description                              |
|--------|----------------------------|--------------------|------------------------------------------|
| `GET`  | `/tasks/:taskId/workflows` | `USER`, `ADMIN`    | List all workflow audit events for task  |

---

## Shared Package

Located at `packages/shared`, this module is consumed across all microservices:

| Export                       | Description                                                              |
|------------------------------|--------------------------------------------------------------------------|
| `getPool` / `closePool`      | PostgreSQL pool connection factory (`pg`)                                |
| `AppError`                   | Standardized operational error class                                     |
| `errorHandler`               | Express global error-handling middleware                                 |
| `logger`                     | Structured logger via `pino`                                             |
| `httpLogger`                 | Request logging middleware via `pino-http`                               |
| `successResponse`            | Standard API response wrapper (`{ success: true, data }`)                |
| `failResponse`               | Standard API error response wrapper                                      |
| `validateBody`               | Zod request body validation middleware                                   |
| `signToken` / `verifyToken`  | JWT signing & verification utilities                                     |
| `requireGatewaySecret`       | Middleware verifying downstream traffic originated from API Gateway      |
| `createProducer`, `publishJsonSafe` | Kafka producer utilities                                          |
| `createConsumer`, `runConsumer`     | Kafka consumer utilities                                          |

---

## Database Schema & Neon PostgreSQL Integration

This project uses PostgreSQL (fully compatible with **Neon PostgreSQL** cloud instances or standard local PostgreSQL installations).

### Tables

1. **`users`**:
   - `id` (UUID, Primary Key)
   - `name`, `email` (Unique), `password_hash`, `role` (`USER`/`ADMIN`), `created_at`
2. **`tasks`**:
   - `id` (UUID, Primary Key)
   - `title`, `status` (`PENDING`/`IN_PROGRESS`/`COMPLETED`), `created_by` (FK -> users.id), `created_at`, `updated_at`
3. **`attachments`**:
   - `id` (UUID, Primary Key)
   - `task_id` (FK -> tasks.id), `image_url`, `public_id`, `uploaded_by` (FK -> users.id), `created_at`
4. **`task_workflows`**:
   - `id` (UUID, Primary Key)
   - `task_id` (FK -> tasks.id), `event_type`, `message`, `created_by` (FK -> users.id), `created_at`

---

## Event-Driven Architecture (Kafka)

Microservices communicate asynchronously via Apache Kafka:

- **`task.events`**: Published when a task is created (`task.created`).
- **`media.events`**: Published when an attachment is uploaded (`attachment.uploaded`).
- **Consumer**: `workflow-service` consumes both topics under group `workflow-service-group` and stores history in `task_workflows`.

---

## Security Model

1. **Public Edge**: API Gateway (`:3000`) is the only port exposed to clients.
2. **Internal Auth**: Downstream microservices enforce `requireGatewaySecret` (`x-gateway-secret`).
3. **Identity Headers**: Gateway strips incoming identity headers from requests and injects trusted `x-user-id` and `x-user-role` headers extracted from verified JWT tokens.
4. **Password Security**: Passwords stored using `bcryptjs` standard hashing.

---

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Language**: JavaScript (ES Modules, `"type": "module"`)
- **Framework**: Express.js
- **Database**: PostgreSQL / Neon PostgreSQL (`pg` driver)
- **Message Broker**: Apache Kafka (`kafkajs`)
- **Validation**: Zod (`zod`)
- **Storage**: AWS SDK v3 S3 (`@aws-sdk/client-s3`)
- **Logging**: Pino (`pino`, `pino-http`)
- **Containerization**: Docker Compose (for local Kafka & Zookeeper)

---

## Project Structure

```
nodejs-microservices/
├── apps/
│   ├── api-gateway/          # Port 3000 (Proxy, JWT, RBAC)
│   ├── auth-service/         # Port 3001 (Users & Authentication)
│   ├── task-service/         # Port 3002 (Task Management & Kafka Events)
│   ├── media-service/        # Port 3003 (S3 Attachment Uploads)
│   └── workflow-service/     # Port 3004 (Kafka Audit Trail Consumer)
├── packages/
│   └── shared/               # Common utilities (DB, Auth, Logger, Errors)
├── docker/
│   └── docker-compose.yml    # Local Kafka & Zookeeper setup
├── scripts/
│   └── db-migrate.js         # PostgreSQL schema migration runner
├── sql/
│   └── schema.sql            # Database DDL statements
├── .env.example              # Environment variables template
├── .env                      # Local environment file (ignored in git)
├── .gitignore                # Git ignore configuration
├── package.json              # Root npm workspace configuration
└── README.md                 # Project Documentation
```

---

## Environment Variables & `.env` Setup

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

### Essential Configuration Options

```ini
# Service Ports
PORT=3000
AUTH_PORT=3001
TASK_PORT=3002
MEDIA_PORT=3003
WORKFLOW_PORT=3004

# Database Connection (Neon PostgreSQL or Local)
DATABASE_URL=postgresql://neondb_owner:password@ep-cool-pool-123456.us-east-2.aws.neon.tech/neondb?sslmode=require

# Authentication Secrets
JWT_SECRET=dev-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d
GATEWAY_SECRET=gateway-shared-internal-secret

# Storage Credentials (Media Service)
AWS_ENDPOINT_URL_S3=https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=auto
STORAGE_BUCKET=microservices-media-bucket

# Kafka Broker
KAFKA_BROKERS=localhost:9092
```

---

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Setup Database**:
   Set `DATABASE_URL` in `.env` (Neon PostgreSQL URL or local Postgres URL), then run migrations:
   ```bash
   npm run db:migrate
   ```

3. **Start Kafka (Optional for event features)**:
   ```bash
   npm run kafka:up
   ```

4. **Run Services**:
   You can start each service in individual terminals:
   ```bash
   # Terminal 1: API Gateway
   npm run dev:gateway

   # Terminal 2: Auth Service
   npm run dev:auth

   # Terminal 3: Task Service
   npm run dev:task

   # Terminal 4: Media Service
   npm run dev:media

   # Terminal 5: Workflow Service
   npm run dev:workflow
   ```

---

## Database Migrations

Run database setup scripts with:
```bash
npm run db:migrate
```
This executes `sql/schema.sql` against the database specified in `DATABASE_URL`.

---

## Scripts Reference

| Script              | Description                                           |
|---------------------|-------------------------------------------------------|
| `npm run dev:gateway`  | Starts API Gateway on port 3000                     |
| `npm run dev:auth`     | Starts Auth Service on port 3001                    |
| `npm run dev:task`     | Starts Task Service on port 3002                    |
| `npm run dev:media`    | Starts Media Service on port 3003                   |
| `npm run dev:workflow` | Starts Workflow Service on port 3004                |
| `npm run db:migrate`   | Executes database migration script (`scripts/db-migrate.js`) |
| `npm run kafka:up`     | Starts local Kafka broker using Docker Compose      |
| `npm run kafka:down`   | Stops local Kafka broker                            |
