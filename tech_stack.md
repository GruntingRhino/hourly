# GoodHours — Tech Stack

## Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7 | Build tool & dev server (port 5173) |
| Tailwind CSS | 4 | Styling |
| React Router | 6 | Client-side routing |
| React Leaflet | 5 | Interactive maps (beneficiary discovery) |
| jsPDF + autotable | 4 / 5 | PDF export of service hour reports |

## Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | — | Runtime |
| Express | 4 | HTTP server (port 3001) |
| TypeScript | 5.7 | Type safety |
| tsx | 4 | TypeScript execution & watch mode in dev |
| Zod | 3 | Request validation & schema parsing |
| Helmet | 8 | HTTP security headers |
| express-rate-limit | 8 | Rate limiting on auth & email endpoints |
| CORS | 2 | Cross-origin request handling |

## Database & ORM
| Technology | Version | Purpose |
|---|---|---|
| Prisma | 6 | ORM & schema management |
| SQLite | — | Local development database |
| PostgreSQL (Neon) | — | Production database (serverless) |
| @neondatabase/serverless | 0.10 | Neon WebSocket driver for Vercel serverless |
| @prisma/adapter-neon | 6 | Prisma adapter for Neon serverless driver |

## Authentication
| Technology | Purpose |
|---|---|
| jsonwebtoken | JWT signing & verification |
| bcryptjs | Password hashing |
| Google OAuth 2.0 | School admin sign-in & registration |

## Email
| Service | Purpose |
|---|---|
| Resend | Transactional email delivery |
| forwardemail.net | `help@goodhours.app` → `abhay.goodhourshelp@gmail.com` forwarding (via DNS MX + TXT records) |

Sending domain: `notifications.goodhours.app`
From address: `GoodHours <noreply@notifications.goodhours.app>`

## Infrastructure & Deployment
| Service | Purpose |
|---|---|
| Vercel | Hosting (frontend + API as serverless functions) |
| Vercel DNS | Domain management for `goodhours.app` |
| GitHub | Source control |

Production URL: `https://goodhours.app`
API entry point: `api/index.ts` (re-exports Express app for Vercel serverless)

## Key Libraries
| Library | Purpose |
|---|---|
| Fuse.js | Fuzzy search for school/beneficiary directory |
| geolib | Distance calculations for nearby beneficiary search |
| zipcodes | ZIP code to lat/lng resolution |
| csv-parse / csv-stringify | CSV import (student bulk upload) and export |
| multer | File upload handling |
| ws | WebSocket support |
| node-fetch | Server-side HTTP requests (Google OAuth token exchange) |

## Dev & Testing
| Tool | Purpose |
|---|---|
| Playwright | End-to-end security test suite |
| ESLint | Linting (frontend) |
| `npx tsc --noEmit` | Type checking (both client and server) |
| Prisma Studio | Visual database browser |

## Local Development
```bash
# Server
cd server && npm run dev       # http://localhost:3001

# Client (proxies /api → :3001)
cd client && npm run dev       # http://localhost:5173

# Database
cd server && npx prisma db push        # apply schema
cd server && npx tsx prisma/seed.ts    # seed test data
```

### Test Accounts (after seeding)
| Role | Email | Password |
|---|---|---|
| Student | john@student.edu | password123 |
| Student | jane@student.edu | password123 |
| Beneficiary | volunteer@greenearth.org | password123 |
| School Admin | admin@lincoln.edu | password123 |
