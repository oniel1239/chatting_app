# ChatHub - Real-time Chat Application

## Overview
A feature-rich real-time chat application built with Node.js, Express, and Socket.IO. Supports public chat rooms, private messaging, file sharing, emoji reactions, and dark mode.

## Architecture
- **Runtime**: Node.js
- **Framework**: Express + Socket.IO
- **Storage**: File-based JSON (data/messages.json, data/users.json)
- **File uploads**: Multer (stored in uploads/)
- **Auth**: bcryptjs password hashing

## Project Structure
```
server.js          - Main server (Express + Socket.IO)
public/index.html  - Full frontend (single-page app)
data/              - JSON data files (auto-created)
uploads/           - Uploaded files (auto-created)
package.json       - Node.js dependencies
```

## Running the App
- **Port**: 5000 (bound to 0.0.0.0)
- **Workflow**: "Start application" → `node server.js`
- **Deployment**: VM target (always-on for WebSocket support)

## Key Features
- User registration and login
- Multiple chat rooms (create custom rooms)
- Private messaging between users
- File/image sharing (up to 10MB)
- Emoji reactions on messages
- Dark mode toggle
- Online user list
- Message history (last 100 per room)
