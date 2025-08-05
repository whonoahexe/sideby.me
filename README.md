# `Watch.With`

A feature-rich, open-source platform for synchronized watch parties. Create rooms, invite friends, & enjoy movies together in real-time.

> _what are you gonna watch btw? very sus 👀_

## What it does

TL;DR:

- Low latency, synced video streams (audio planned)
- Host & guest controls
- Real-time chat (voice & video planned)
- Support for multiple video sources (yt, mp4, hls)
- Upload & sync custom subtitles

https://watch-with.brkn.me/

## Getting Started

### Prerequisites

- [`Node.js 18+`](https://nodejs.org/en)
- [`Docker`](https://www.docker.com/) for Redis

### Running it Locally

**1. Environment Setup**

```bash
# Copy environment template
cp .env.local

# Configure your environment variables
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

**2. Available Scripts**

```bash
# Development with hot reload
npm run dev

# Development with Redis auto-start
npm run dev:redis

# Production build
npm run build
npm start

# Redis management
npm run redis:start    # Start Redis container
npm run redis:stop     # Stop Redis container
npm run redis:logs     # View Redis logs
npm run redis:cli      # Access Redis CLI

# Code quality
npm run lint           # ESLint check
npm run format         # Prettier format
npm run format:check   # Check formatting
```

**3. Development Workflow**

```bash
# Start your development environment
npm run dev:redis      # Starts Redis + dev server

# Optionally, in another terminal, monitor Redis
npm run redis:logs
```

### Project Structure

```
├── app/                   # app router pages
│   ├── create/            # room creation page
│   ├── join/              # room joining page
│   └── room/[roomId]/     # watch room page
├── components/            # react components
│   ├── chat/              # chat system
│   ├── room/              # room management
│   ├── video/             # video player components
│   ├── layout/            # (core) page layout components
│   └── ui/                # (core) reusable shadcn components
├── server/                # backend server
│   ├── redis/             # redis data layer
│   └── socket/            # socket handlers
├── hooks/                 # custom hooks
├── types/                 # type definitions
└── lib/                   # utility functions
```

## Contributing

If you find ways to make improvements (or find one of many bugs), feel free to open an issue or a pull request or you could go touch some (gr)ass..
