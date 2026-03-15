# ScriptLift

Privacy-first AI transcription app. Converts audio and video to text using Whisper AI running directly in the browser.

## Features

- Upload audio/video files or record directly in-app
- Client-side transcription via Whisper AI (nothing leaves your browser)
- AI speaker diarization (identifies different speakers)
- Customizable speaker names and color coding
- Export as TXT, PDF, or DOC
- 1GB storage per user
- Dark mode support

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (auth, database, storage, edge functions)
- Whisper AI (browser-based via Web Worker)

## Setup

```bash
npm install
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Database Setup

Run the SQL in `supabase/setup.sql` in your Supabase SQL Editor to create all tables, policies, triggers, and storage buckets.

## Deployment

Deployed on Vercel. Push to `main` to trigger a deploy.

## Built by Danny Avila
