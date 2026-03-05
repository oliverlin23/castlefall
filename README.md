# Castlefall

A real-time multiplayer word game inspired by Castle of the Devil + Spyfall.

Players join a room, start a round, and are secretly assigned to one of two teams. Each team shares a secret word from a common word list. Communicate to find your teammates — but don't reveal your word!

## Setup

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)

### Supabase Setup
1. Create a Supabase project at https://supabase.com
2. Go to the SQL Editor and run the contents of `supabase/schema.sql`
3. Copy your project URL and anon key from Settings > API

### Local Development
```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

### Build for Production
```bash
npm run build
npm run preview
```

## How to Play

1. Open the app and share the link (with a room name hash, e.g. `/#myroom`) with friends
2. Everyone enters their name and joins the room
3. Any player can start a round when at least 2 players have joined
4. Each player receives the same word list (shuffled differently) with one word highlighted — that's your team's word
5. Communicate to find teammates without revealing your word to the other team
6. Declare victory by naming your teammates or guessing the other team's word
