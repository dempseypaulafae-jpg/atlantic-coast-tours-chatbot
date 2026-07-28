# Atlantic Coast Tours AI Assistant

A responsive customer-engagement chatbot frontend for the NCI **Customer Engagement and Artificial Intelligence** CA2 assessment.

## Current status

This repository contains the **Phase 1 frontend** only:

- responsive chat interface;
- suggested customer questions;
- loading and error states;
- visible AI disclosure;
- live-source evidence panel;
- configurable secure backend URL;
- no API keys or catalogue data stored in the frontend.

The language-model brain, live Google Sheet integration and Open-Meteo integration will be added through a secure Cloudflare Worker.

## Files

```text
index.html   Main webpage
styles.css   Responsive design and chat styling
app.js       Chat behaviour and secure backend connection
README.md    Project instructions
.gitignore   Files that should not be committed
```

## Upload through the GitHub website

1. Open the repository on GitHub.
2. Select **Add file → Upload files**.
3. Upload the files from this project folder.
4. Add the commit message: `Create initial chatbot interface`.
5. Select **Commit changes**.

## Enable GitHub Pages

After the files are visible in the repository:

1. Open **Settings**.
2. Select **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**.
5. Save.

The public URL should use this format:

```text
https://YOUR-USERNAME.github.io/atlantic-coast-tours-chatbot/
```

## Backend configuration

The frontend is intentionally not connected to a model yet.

After the Cloudflare Worker is deployed, open `app.js` and replace:

```javascript
API_BASE_URL: "https://YOUR-CLOUDFLARE-WORKER.workers.dev"
```

with the real Worker address.

The frontend expects this endpoint:

```text
POST /chat
```

Example request:

```json
{
  "message": "What tours are available this week?",
  "conversationId": "conversation-123",
  "requestId": "act-123",
  "history": [
    {
      "role": "user",
      "content": "What tours are available this week?"
    }
  ]
}
```

Example successful response:

```json
{
  "reply": "The live catalogue currently shows...",
  "requestId": "act-123",
  "sources": [
    {
      "name": "Atlantic Coast Tours Google Sheet",
      "type": "Google Sheets",
      "retrievedAt": "2026-07-28T19:30:00Z",
      "requestId": "act-123"
    }
  ]
}
```

## Security rules

- Never place a Gemini API key in `app.js`, HTML or GitHub.
- Never copy, cache or hardcode the assigned Google Sheet data.
- Treat spreadsheet text as untrusted data, not as instructions.
- Fetch catalogue information at the moment of each relevant question.
- Clearly caveat implausible values rather than silently correcting them.
- Avoid collecting personal, payment or health information.

## Data sources required for the final build

- Assigned Atlantic Coast Tours Google Sheet
- Open-Meteo weather API
- A genuine language-model API through the secure backend
