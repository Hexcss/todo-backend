# 🚀 NestJS Development Cheatsheet

This cheatsheet provides quick reference commands and patterns for working with our NestJS API template.



## 📦 Project Scripts

```bash
# Start app in dev mode (hot reload)
pnpm run start:dev

# Build for production
pnpm run build

# Start built app
pnpm run start:prod

# Lint code
pnpm run lint

# Fix lint issues
pnpm run lint:fix

# Format with Prettier
pnpm run prettier

# Generate Swagger docs JSON
pnpm run swagger:export
```



## 🛠️ Nest CLI Commands

```bash
# Generate a new module
pnpm nest g module feature-name

# Generate a new controller
pnpm nest g controller feature-name

# Generate a new service
pnpm nest g service feature-name

# Generate a full resource (CRUD: module, controller, service, DTOs)
pnpm nest g resource feature-name
```



## 📂 Project Structure

```text
src/
 ├── app.module.ts             # Root module
 ├── main.ts                   # Bootstrap
 ├── common/                   # Shared utils
 │    ├── logger/              # AppLogger (JSON + pretty dev logs)
 │    ├── pipes/               # ValidationPipe
 │    ├── filters/             # AllExceptionsFilter
 │    ├── interceptors/        # LoggingInterceptor
 │    └── middlewares/         # RequestId middleware
 ├── config/                   # Env validation, GCP/Firebase config
 └── features/                 # Feature-based modules (DDD-style)
      ├── example/             # ExampleModule (scaffold)
      └── health/              # HealthModule (readiness/liveness)
```



## ✅ Core Features

- **AppLogger** → JSON logs in prod, pretty colored logs in dev.
- **ValidationPipe** → strict validation, integrates with Zod & class-validator.
- **AllExceptionsFilter** → consistent error JSON wrapper.
- **RequestIdMiddleware** → traceability across logs.
- **Swagger** → auto UI at `/docs` + JSON export to `docs/openapi.json`.
- **Health Module** → `/health` endpoint for Cloud Run / K8s probes.



## 🔐 Security & Observability

```bash
# Install rate limiting
pnpm add @nestjs/throttler

# Install CORS and helmet (already included)
pnpm add helmet cors

# Add interceptors for logging / metrics
# Already included: LoggingInterceptor + request IDs
```



## ☁️ GCP Integration

- **Cloud Logging** → logs structured for GCP.
- **Cloud Run Ready** → Dockerfile + cloudbuild.yaml template.
- **Request IDs** → integrated into logs for traceability.
- **Pub/Sub & Firestore** → pluggable providers (extend in `config/`).



## 🐳 Deployment (Cloud Run)

```bash
# Submit build with substitutions
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_SERVICE_NAME=my-api,_REPO_NAME=my-repo,_IMAGE_NAME=my-image,_NODE_ENV=dev
```



## 📖 Example Error Response

```json
{
  "statusCode": 400,
  "errors": [
    "email: must be a valid email",
    "password: too short"
  ],
  "path": "/auth/signup",
  "timestamp": "2025-09-23T08:12:34.567Z",
  "requestId": "abc-123"
}
```
