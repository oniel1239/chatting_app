# 💬 ChatHub - Modern Real-Time Chat Application

A feature-rich, modern chat application built with Node.js, Express, and Socket.IO.

## ✨ Features

- 🔐 **User Authentication** - Secure login/registration with bcrypt
- 💬 **Real-time Messaging** - Instant message delivery with Socket.IO
- 📁 **Chat Rooms** - Create and join custom rooms
- 📨 **Private Messaging** - Direct messages between users
- 📎 **File Sharing** - Upload and share images and files (up to 10MB)
- 😊 **Emoji Reactions** - React to messages with emojis
- 🌙 **Dark Mode** - Toggle between light and dark themes
- 📱 **Mobile Responsive** - Works perfectly on all devices
- 💾 **Message Persistence** - Messages saved to disk
- 👥 **Online Users** - See who's online in real-time

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Visit `http://localhost:3000` in your browser.

### Deploy to Render

1. Push this code to GitHub
2. Go to [render.com](https://render.com)
3. Create a new Web Service
4. Connect your GitHub repo
5. Deploy!

### Deploy to Railway

1. Push this code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub"
4. Select your repo
5. Railway will auto-detect Node.js and deploy

## 📁 Project Structure

```
chat-app/
├── server.js          # Backend server (Express + Socket.IO)
├── public/
│   └── index.html     # Frontend (HTML + CSS + JS)
├── data/              # Message and user data (auto-created)
├── uploads/           # Uploaded files (auto-created)
├── package.json       # Dependencies
└── README.md          # This file
```

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, Socket.IO
- **Frontend:** Vanilla JS, CSS3
- **Storage:** File-based JSON storage
- **Security:** bcryptjs for password hashing
- **File Uploads:** Multer

## 🔧 Configuration

The app runs on port 3000 by default. Set the `PORT` environment variable to change:

```bash
PORT=8080 npm start
```

## 📝 API Endpoints

- `POST /api/register` - Register new user
- `POST /api/login` - Login user
- `GET /api/messages?room=general&limit=100` - Get messages
- `POST /api/upload` - Upload file

## 🌐 Socket Events

- `register` / `login` - Authentication
- `join-room` - Join a chat room
- `chatMessage` - Send message to room
- `privateMessage` - Send private message
- `reaction` - Add reaction to message

## 📄 License

MIT

---

Built with ❤️ by Hacker
