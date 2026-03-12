# ArvyaX Journal — AI Assisted Journaling Prototype

This project was built as part of the **RevoltronX Full Stack Developer Internship assignment** for **Team ArvyaX**.

The idea behind the assignment is simple: after completing a nature session (forest, ocean, mountain etc.), a user writes a short journal entry. The system stores the entry and uses an AI model to understand the emotional tone of the text and generate small insights over time.

The goal here wasn't to build a production-ready journaling platform, but rather to demonstrate:

• API design
• backend architecture
• practical LLM integration
• basic frontend interaction

---

# What the App Does

The app allows a user to:

• write a journal entry after a nature session
• analyze the emotional tone of the entry using an LLM
• see keywords and a short AI summary
• view patterns across entries (top emotion, most used ambience, etc.)

The UI is intentionally simple since the focus of the assignment was the **backend design and AI integration**.

---

# Tech Stack

Frontend
React (Vite)

Backend
Node.js + Express

Database
SQLite (using better-sqlite3)

LLM Provider
Groq API using **Llama-3.3-70B**

Other tools used
Docker
Nginx
Express rate limiting

---

# Core API Endpoints

### Create Journal Entry

Stores a new journal entry in the database.

POST `/api/journal`

Example

```id="ex1"
{
  "userId": "user_001",
  "ambience": "forest",
  "text": "I sat quietly near the trees today and felt surprisingly calm."
}
```

---

### Get Entries

Returns all entries for a user.

GET `/api/journal/:userId`

Entries include any emotion analysis that has already been performed.

---

### Analyze Entry with AI

This endpoint sends the journal text to the LLM and returns structured results.

POST `/api/journal/analyze`

Example request

```id="ex2"
{
  "text": "Listening to the rain made me feel peaceful",
  "entryId": 3
}
```

Example response

```id="ex3"
{
  "emotion": "calm",
  "keywords": ["rain", "peace", "nature"],
  "summary": "The user experienced relaxation and calmness during the session."
}
```

To avoid unnecessary API calls, the system **caches analysis results** using a SHA-256 hash of the text.

If the same text is analyzed again, the cached result is returned instead of calling the LLM again.

---

### Streaming Reflection (Bonus)

There's also a streaming endpoint that generates a longer reflection about the entry.

GET `/api/journal/analyze/stream`

This uses **Server Sent Events (SSE)** to stream the response gradually.

---

### Insights API

Provides aggregated insights from a user's journal history.

GET `/api/journal/insights/:userId`

Example response

```id="ex4"
{
  "totalEntries": 8,
  "topEmotion": "calm",
  "mostUsedAmbience": "forest",
  "recentKeywords": ["nature", "rain", "focus"]
}
```

The endpoint calculates:

• total entries
• most common emotion
• most used ambience
• keyword patterns from recent entries

---

# Project Structure

```id="struct"
arvyax-journal
│
├── backend
│   ├── server.js
│   ├── db/database.js
│   ├── routes/journal.js
│   └── services/llmService.js
│
├── frontend
│   ├── src/App.jsx
│   ├── src/api.js
│   └── src/main.jsx
│
├── docker-compose.yml
├── README.md
└── ARCHITECTURE.md
```

---

# Running the Project Locally

### 1. Clone the repository

```id="run1"
git clone https://github.com/rishi712004/arvyax-journal.git
cd arvyax-journal
```

---

### 2. Start the backend

```id="run2"
cd backend
npm install
```

Create the environment file

```id="run3"
cp .env.example .env
```

Add your Groq API key

```id="run4"
GROQ_API_KEY=your_key_here
```

Run the backend

```id="run5"
npm run dev
```

The backend will run on

```
http://localhost:3001
```

---

### 3. Start the frontend

Open another terminal window

```id="run6"
cd frontend
npm install
npm run dev
```

The frontend will run on

```
http://localhost:5173
```

---

# Notes / Assumptions

Authentication is intentionally simplified for this assignment.

Instead of building a full login system, the app uses a static user id (`user_001`).
In a real system this would be replaced with proper authentication (JWT or session based).

---

# Bonus Features Implemented

Some additional features were added beyond the minimum requirements:

• Streaming AI response using SSE
• Caching of repeated AI analysis results
• Rate limiting for the AI endpoints
• Docker setup for running the full stack easily

---

# Possible Improvements

If this were extended into a real product, I would probably add:

• proper authentication and user accounts
• encryption for sensitive journal data
• charts to visualize emotional trends
• better mobile-friendly UI
• vector search for semantic journal retrieval

---

# Author

Rishikesh Kumar

Submission for **RevoltronX – Full Stack Developer Internship (Team ArvyaX)**

Dream > Innovate > Create
