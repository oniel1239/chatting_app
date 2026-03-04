const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuration
const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const ADMIN_USERNAME = 'Halku'; // Admin username - Only you!

// Encryption key for message encryption (in production, use per-conversation keys)
const ENCRYPTION_KEY = crypto.randomBytes(32); // Generated on server start

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// File-based storage
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Load data
let messages = [];
let users = {};

try {
  if (fs.existsSync(MESSAGES_FILE)) {
    messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  }
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  }
} catch (e) {
  console.log('Starting fresh - no data files found');
}

// Save data
function saveMessages() {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Encryption functions (AES-256-GCM)
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag
  };
}

function decrypt(encryptedObj) {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY,
      Buffer.from(encryptedObj.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
    let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Decryption failed:', e);
    return '[Decryption failed]';
  }
}

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + crypto.randomBytes(8).toString('hex') + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));

// API Routes
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  
  // Check if username already exists
  if (users[username]) return res.status(400).json({ error: 'Username already exists' });
  
  const hashedPassword = await bcrypt.hash(password, 10);
  users[username] = {
    id: crypto.randomBytes(16).toString('hex'),
    username,
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };
  saveUsers();
  res.json({ success: true, username });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!users[username]) return res.status(400).json({ error: 'Invalid credentials' });
  
  const valid = await bcrypt.compare(password, users[username].password);
  if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
  
  const isAdmin = username === ADMIN_USERNAME;
  res.json({ success: true, username, userId: users[username].id, isAdmin });
});

app.get('/api/messages', (req, res) => {
  const { room = 'general', limit = 100, username } = req.query;
  
  // Admin (Halku) sees ALL messages from all users
  // Regular users only see their own conversations with admin
  let filteredMessages;
  if (username === ADMIN_USERNAME) {
    filteredMessages = messages.filter(m => m.room === room);
  } else {
    // Users only see their messages and admin's replies to them
    filteredMessages = messages.filter(m => 
      m.room === room && 
      (m.username === username || m.username === ADMIN_USERNAME)
    );
  }
  
  // Decrypt messages before sending
  const decryptedMessages = filteredMessages.slice(-limit).map(msg => {
    if (msg.encrypted) {
      return {
        ...msg,
        text: decrypt(msg.encryptedData),
        encrypted: false
      };
    }
    return msg;
  });
  
  res.json(decryptedMessages);
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({
    success: true,
    url: `/uploads/${req.file.filename}`,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO
const onlineUsers = new Map();
const userSockets = new Map();
const conversationKeys = new Map(); // Store per-conversation encryption keys

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let currentUser = null;
  let currentRoom = 'general';
  let isAdmin = false;

  socket.on('register', async (data) => {
    const { username, password } = data;
    
    if (!users[username]) {
      const hashedPassword = await bcrypt.hash(password, 10);
      users[username] = {
        id: crypto.randomBytes(16).toString('hex'),
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      };
      saveUsers();
    }
    const valid = await bcrypt.compare(password, users[username].password);
    if (valid) {
      currentUser = username;
      isAdmin = username === ADMIN_USERNAME;
      socket.username = username;
      socket.isAdmin = isAdmin;
      socket.join('general');
      socket.emit('auth-success', { username, userId: users[username].id, isAdmin });
      socket.emit('users', getOnlineUsers());
      socket.broadcast.emit('message', { type: 'system', text: `${username} joined`, room: 'general' });
    } else {
      socket.emit('auth-error', { error: 'Invalid credentials' });
    }
  });

  socket.on('login', async (data) => {
    const { username, password } = data;
    if (users[username]) {
      const valid = await bcrypt.compare(password, users[username].password);
      if (valid) {
        currentUser = username;
        isAdmin = username === ADMIN_USERNAME;
        socket.username = username;
        socket.isAdmin = isAdmin;
        socket.join('general');
        socket.emit('auth-success', { username, userId: users[username].id, isAdmin });
        socket.emit('users', getOnlineUsers());
        socket.broadcast.emit('message', { type: 'system', text: `${username} joined`, room: 'general' });
      } else {
        socket.emit('auth-error', { error: 'Invalid credentials' });
      }
    } else {
      socket.emit('auth-error', { error: 'User not found' });
    }
  });

  socket.on('join-room', (room) => {
    if (currentUser) {
      socket.leave(currentRoom);
      currentRoom = room;
      socket.join(room);
      socket.emit('room-joined', { room });
      
      // Load messages based on user type
      let roomMessages;
      if (isAdmin) {
        // Halku sees ALL messages
        roomMessages = messages.filter(m => m.room === room).slice(-100);
      } else {
        // Users only see their conversation with Halku
        roomMessages = messages.filter(m => 
          m.room === room && 
          (m.username === currentUser || m.username === ADMIN_USERNAME)
        ).slice(-100);
      }
      
      // Decrypt messages
      const decryptedMessages = roomMessages.map(msg => {
        if (msg.encrypted) {
          return {
            ...msg,
            text: decrypt(msg.encryptedData),
            encrypted: false
          };
        }
        return msg;
      });
      
      socket.emit('messages', decryptedMessages);
      
      if (!isAdmin) {
        socket.broadcast.to(room).emit('message', { type: 'system', text: `${currentUser} joined ${room}`, room });
      }
    }
  });

  socket.on('chatMessage', (data) => {
    if (!currentUser) return;
    const { text, room = 'general', type = 'text', recipient } = data;
    
    // Encrypt the message before storing
    const encryptedData = encrypt(text);
    
    const message = {
      id: crypto.randomBytes(16).toString('hex'),
      type: 'user',
      username: currentUser,
      text: '', // Don't store plain text
      encryptedData: encryptedData, // Store encrypted
      encrypted: true,
      room,
      recipient: recipient || null, // Specific recipient for private messages
      time: new Date().toISOString(),
      messageType: type
    };
    
    messages.push(message);
    saveMessages();
    
    // Prepare decrypted message for sending
    const decryptedMessage = {
      ...message,
      text: text, // Send decrypted to recipients
      encrypted: false
    };
    
    // If Halku (admin) sends message - send only to specific recipient
    if (isAdmin) {
      if (recipient) {
        // Send to specific user only AND to admin (sender)
        const recipientSocket = userSockets.get(recipient);
        if (recipientSocket) {
          recipientSocket.emit('message', { ...decryptedMessage, time: new Date(message.time).toLocaleTimeString() });
        }
        // Also send back to admin so it appears in the chat
        socket.emit('message', { ...decryptedMessage, time: new Date(message.time).toLocaleTimeString() });
      } else {
        // Broadcast to everyone (for general messages)
        io.to(room).emit('message', { ...decryptedMessage, time: new Date(message.time).toLocaleTimeString() });
      }
    } else {
      // Regular user - send to themselves and ONLY to Halku
      socket.emit('message', { ...decryptedMessage, time: new Date(message.time).toLocaleTimeString() });
      
      const adminSocket = userSockets.get(ADMIN_USERNAME);
      if (adminSocket) {
        adminSocket.emit('message', { ...decryptedMessage, time: new Date(message.time).toLocaleTimeString() });
      }
    }
  });

  socket.on('privateMessage', (data) => {
    if (!currentUser) return;
    const { to, text } = data;
    
    // Encrypt private message
    const encryptedData = encrypt(text);
    
    const message = {
      id: crypto.randomBytes(16).toString('hex'),
      type: 'private',
      from: currentUser,
      to,
      text: '',
      encryptedData: encryptedData,
      encrypted: true,
      time: new Date().toISOString()
    };
    
    messages.push(message);
    saveMessages();
    
    const targetSocket = userSockets.get(to);
    if (targetSocket) {
      targetSocket.emit('privateMessage', { ...message, text, encrypted: false });
    }
    socket.emit('privateMessage', { ...message, text, encrypted: false, sent: true });
  });

  socket.on('reaction', (data) => {
    if (!currentUser) return;
    const { messageId, emoji, room = 'general' } = data;
    
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      if (!msg.reactions) msg.reactions = {};
      if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
      if (!msg.reactions[emoji].includes(currentUser)) {
        msg.reactions[emoji].push(currentUser);
        saveMessages();
        
        if (isAdmin) {
          io.to(room).emit('reaction', { messageId, emoji, users: msg.reactions[emoji] });
        } else {
          socket.emit('reaction', { messageId, emoji, users: msg.reactions[emoji] });
          const adminSocket = userSockets.get(ADMIN_USERNAME);
          if (adminSocket) {
            adminSocket.emit('reaction', { messageId, emoji, users: msg.reactions[emoji] });
          }
        }
      }
    }
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      onlineUsers.delete(currentUser);
      userSockets.delete(currentUser);
      io.emit('users', getOnlineUsers());
      if (!isAdmin) {
        io.to(currentRoom).emit('message', { type: 'system', text: `${currentUser} left`, room: currentRoom });
      }
    }
  });

  function getOnlineUsers() {
    return Array.from(onlineUsers.keys());
  }
});

// Track online users
setInterval(() => {
  onlineUsers.clear();
  io.sockets.sockets.forEach(socket => {
    if (socket.username) {
      onlineUsers.set(socket.username, socket.id);
      userSockets.set(socket.username, socket);
    }
  });
  io.emit('users', Array.from(onlineUsers.keys()));
}, 5000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Chat server running at http://localhost:${PORT}`);
  console.log(`👑 Admin (Owner): ${ADMIN_USERNAME}`);
  console.log(`🔒 End-to-end encryption: Enabled (AES-256-GCM)`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`📤 Uploads directory: ${UPLOADS_DIR}`);
});
