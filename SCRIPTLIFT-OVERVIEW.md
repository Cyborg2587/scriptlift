# ScriptLift — Complete Product Overview & Build Documentation

**Version:** 1.0 Launch
**Deployed:** March 15, 2026
**Live URL:** https://scriptlift.byavila.com
**Built by:** Danny Avila (Danny Avila Agency)

---

## What Is ScriptLift?

ScriptLift is a privacy-first AI transcription web application. It converts audio and video files into text using Whisper AI running directly in the user's browser — meaning no audio data ever leaves the user's device. It also uses AI-powered speaker diarization to automatically identify and label different speakers in a conversation, podcast, interview, or meeting recording.

### The Problem It Solves

Most transcription tools require you to upload your audio to someone else's server. That means your private conversations, meetings, ministry recordings, coaching sessions, and sensitive content pass through third-party infrastructure. ScriptLift eliminates that risk entirely — all transcription processing happens locally in the browser using Whisper AI.

### Who It's For

- Podcasters who need transcripts of episodes
- Ministry leaders who record sermons, teachings, and testimonies
- Coaches and counselors who record sessions
- Content creators who need transcripts for repurposing
- Anyone who values privacy in their transcription workflow

---

## Core Features

### 1. Browser-Based Transcription (Privacy-First)
- Powered by Whisper AI (Xenova/whisper-base.en model)
- Runs entirely in the browser via a Web Worker
- Audio is decoded, downsampled to 16kHz, and processed client-side
- No audio data is ever sent to any server for transcription
- Supports audio and video files (MP3, WAV, MP4, MOV, AVI, MKV, WebM)

### 2. AI Speaker Diarization
- Automatically identifies different speakers in a recording
- Uses Google Gemini 2.5 Flash AI to analyze conversational patterns
- Labels speakers as "Speaker 1", "Speaker 2", etc.
- Users can rename speakers to real names (e.g., "Danny", "Joel")
- Each speaker gets a distinct color for visual identification
- Consecutive segments from the same speaker are merged into paragraphs with time ranges

### 3. Speaker Customization
- 6 speaker colors: Purple (#A855F7), Blue (#3B82F6), Green (#22C55E), Orange (#FF8C00), Pink (#EC4899), Teal (#20C997)
- Rename any speaker label to a real name
- Reassign segments to different speakers via dropdown
- Speaker names wrap naturally — no truncation

### 4. In-App Audio Recording
- Record directly in the browser using your microphone
- No external recording app needed
- Recording is immediately available for transcription

### 5. Media Playback & Sync
- Built-in audio/video player
- Click any transcript segment to jump to that timestamp
- Active segment highlights as media plays
- Resizable video preview (small, medium, large)
- Mute/unmute controls

### 6. Export Options
- **TXT** — Plain text export
- **PDF** — Formatted PDF with speaker labels and timestamps
- **DOC** — Word document format
- All exports include: "Generated with ScriptLift by Danny Avila"

### 7. Project Management
- Dashboard showing all uploaded projects
- Project status tracking: Queued, Processing, Completed, Error
- Rename projects inline
- Delete projects (removes file from storage)
- Retry failed transcriptions
- Storage meter showing usage vs. 1GB limit

### 8. Authentication & Accounts
- Email/password signup and login
- Password reset via email
- Auto-profile creation on signup
- Row-level security — users can only access their own data

### 9. Display Options
- Toggle timestamps on/off
- Toggle speaker labels on/off
- Dark mode / light mode toggle
- Responsive layout for desktop and mobile

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + TypeScript | UI framework |
| Build | Vite | Fast dev server and bundler |
| Styling | Tailwind CSS + shadcn/ui | Design system and components |
| Auth & Database | Supabase | Authentication, PostgreSQL database, Edge Functions |
| File Storage | Cloudflare R2 | Media file storage (replaced Supabase storage) |
| Transcription | Whisper AI (Xenova) | Browser-based speech-to-text |
| Speaker ID | Google Gemini 2.5 Flash | AI-powered speaker diarization |
| Hosting | Vercel | Production deployment, auto-deploys from GitHub |
| Source Control | GitHub | Repository: Cyborg2587/scriptlift |

---

## Brand Identity

### App Name & Tagline
- **Name:** ScriptLift
- **Tagline:** "Privacy-first AI transcription"
- **Footer:** "Powered by Whisper AI - Files processed securely in your browser"

### Logo
- Icon: FileText (Lucide React icon library)
- White icon on indigo (#6366F1) rounded square background
- "ScriptLift" text in bold Inter font

### Color Palette

**Primary Brand Color:** Indigo #6366F1
This is the dominant accent color used for buttons, links, focus rings, active states, and the logo background.

**Light Mode:**
| Element | Color | Hex |
|---------|-------|-----|
| Background | Light slate | #F8FAFC |
| Text | Dark slate | #1E293B |
| Cards | White | #FFFFFF |
| Muted text | Slate gray | #64748B |
| Borders | Light slate | #E2E8F0 |
| Primary/Accent | Indigo | #6366F1 |
| Success | Green | #22C55E |
| Warning | Amber | #FBBF24 |
| Error | Red | #EF4444 |

**Dark Mode:**
| Element | Color | Hex |
|---------|-------|-----|
| Background | Very dark slate | #0F172A |
| Text | Light slate | #F1F5F9 |
| Cards | Dark slate | #1A202C |
| Muted text | Medium slate | #94A3B8 |
| Borders | Slate | #475569 |
| Primary/Accent | Indigo | #6366F1 |

### Typography
- **Font:** Inter (Google Fonts)
- **Weights:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Style:** Clean, modern, highly readable

### Design Aesthetic
- Clean, modern, professional
- Indigo/Slate color palette
- 12px border radius throughout
- Smooth 200-300ms transitions
- Glass morphism effects (backdrop blur)
- Full dark mode support

---

## Architecture & How It Works

### Upload Flow
1. User drags/drops or selects an audio/video file (up to 300MB)
2. File is uploaded directly to Cloudflare R2 via presigned URL
3. A project record is created in Supabase with file metadata
4. File is queued for processing

### Transcription Flow
1. File is downloaded from R2 to the browser
2. Audio is decoded using Web Audio API
3. Audio is downmixed to mono and downsampled to 16kHz
4. Whisper AI model loads in a Web Worker (first use downloads ~77MB model, cached after)
5. Audio is transcribed in 30-second chunks with 5-second stride
6. Raw segments are sent to the diarization Edge Function
7. Gemini 2.5 Flash analyzes conversational patterns and assigns speakers
8. Consecutive same-speaker segments are merged into paragraphs
9. Final transcript is saved to Supabase

### Storage Architecture
- **Why Cloudflare R2:** Supabase free tier limits uploads to 50MB per file. R2 has no per-file limit on the free tier with 10GB total free storage.
- **How it works:** A Supabase Edge Function generates presigned URLs. The browser uploads/downloads directly to R2. Credentials never touch the client.
- **Per-user limit:** 1GB of storage
- **Max file size:** 300MB per upload

### Database Schema
- **profiles** — User profiles (auto-created on signup)
- **projects** — Transcription projects with file metadata, transcript data, speaker mappings, and colors
- Both tables have Row Level Security (RLS) — users can only access their own data
- Triggers: auto-update timestamps, auto-create profile on signup, enforce 1GB storage limit

### Edge Functions
1. **diarize** — Sends transcript segments to Gemini 2.5 Flash for speaker identification
2. **r2-presign** — Generates presigned URLs for R2 upload/download/delete operations

---

## The Build Journey — Challenges & Solutions

### Challenge 1: Supabase 50MB Upload Limit
**Problem:** Supabase free tier enforces a hard 50MB per-file upload limit at the platform level, regardless of bucket configuration. Many video files exceed this.
**Solution:** Replaced Supabase storage with Cloudflare R2. Built a custom presigned URL system via Edge Functions. Zero-dependency S3v4 signing implementation (no external modules). Now supports 300MB uploads with no per-file platform restrictions.

### Challenge 2: Deprecated Gemini Model
**Problem:** Speaker diarization stopped working. The Edge Function was calling `gemini-2.0-flash` which Google deprecated for new users — returning 404 errors silently.
**Solution:** Updated to `gemini-2.5-flash`. Tested end-to-end with sample conversations to confirm accurate speaker identification.

### Challenge 3: Edge Function Deployment
**Problem:** The diarize Edge Function existed in the codebase but was never deployed to the Supabase project. Speaker identification appeared to work on the old Lovable-hosted version but failed on the new deployment.
**Solution:** Installed Supabase CLI, linked the project, set the Google API key as a secret, and deployed the function. Also set R2 credentials as secrets for the presigned URL function.

### Challenge 4: Fragmented Transcript Segments
**Problem:** Whisper AI outputs individual segments for nearly every word or short phrase. A speaker talking for 35 seconds would produce 12+ separate lines — making the transcript hard to read.
**Solution:** Built a segment merging system that combines consecutive segments from the same speaker into single paragraphs with time ranges (e.g., "0:00 – 0:34"). Changing a merged group's speaker assignment updates all underlying segments.

### Challenge 5: Missing Speaker Labels
**Problem:** Speaker labels in the UI showed as blank colored tags with no text. Users couldn't tell which speaker was which.
**Solution:** Defaulted speaker name inputs to "Speaker 1", "Speaker 2", etc. Users can overwrite with real names, but the default is always visible.

### Challenge 6: Truncated Speaker Names
**Problem:** Long speaker names were cut off with "..." (ellipsis) due to a 60px max-width with CSS truncation.
**Solution:** Removed truncation, added word wrapping with a 120px max width so names flow to a second line naturally.

### Challenge 7: Domain Migration
**Problem:** ScriptLift was originally deployed on `scriptlift.dannyavila.com`. Needed to move to `scriptlift.byavila.com` — a cleaner domain for app deployment.
**Solution:** Added the new domain in Vercel, created a CNAME record on Bluehost pointing `scriptlift` to Vercel's DNS, verified configuration, and removed the old domain.

### Challenge 8: Missing Vercel Environment Variables
**Problem:** After domain migration, the site loaded as a blank white screen. The Supabase credentials were never added to Vercel's environment variables.
**Solution:** Added `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to Vercel environment variables and redeployed.

### Challenge 9: Database Setup Without CLI
**Problem:** The Supabase database had no tables — the setup SQL had never been executed. No Supabase CLI or psql was installed.
**Solution:** Installed psql via Homebrew's libpq package, connected directly to the Supabase PostgreSQL database, and executed the full setup.sql — creating tables, RLS policies, triggers, functions, and the storage bucket in one shot.

---

## Infrastructure Map

```
User Browser
  |
  |-- [Whisper AI Web Worker] --> Transcription (local, private)
  |
  |-- [Supabase Auth] --> Login / Signup / Password Reset
  |
  |-- [Supabase Database] --> Projects, Profiles, Speaker Data
  |
  |-- [R2 Presign Edge Function] --> Presigned URL
  |       |
  |       +-- [Cloudflare R2] --> File Upload / Download / Delete
  |
  |-- [Diarize Edge Function] --> Speaker Identification
          |
          +-- [Google Gemini 2.5 Flash] --> AI Analysis
```

---

## Deployment Details

| Component | Location |
|-----------|----------|
| Live URL | https://scriptlift.byavila.com |
| GitHub | github.com/Cyborg2587/scriptlift (private) |
| Hosting | Vercel (auto-deploys on push to main) |
| Database | Supabase project: gkloekpohsjsdzjftmil |
| File Storage | Cloudflare R2 bucket: scriptlift-media |
| DNS | Bluehost (CNAME: scriptlift -> d28c4bd3099d309a.vercel-dns-017.com) |

---

## Social Media Announcement Context

**Key messages for the launch post:**
- ScriptLift is live at https://scriptlift.byavila.com
- Privacy-first: your audio never leaves your browser
- AI-powered speaker identification (knows who's talking)
- Supports audio and video files up to 300MB
- Free to use with 1GB storage per account
- Export transcripts as TXT, PDF, or DOC
- Dark mode support
- Built by Danny Avila

**Brand colors for post design:**
- Primary: Indigo #6366F1
- Background light: #F8FAFC
- Background dark: #0F172A
- Text dark: #1E293B
- Accent colors: Purple #A855F7, Blue #3B82F6, Green #22C55E

**Font:** Inter (Google Fonts)

**Logo:** White FileText icon on indigo rounded square

---

*Built with Claude Code. Deployed March 15, 2026.*
