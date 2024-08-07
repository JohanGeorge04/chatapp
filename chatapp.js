const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2');
const session = require('express-session');
const bodyParser = require('body-parser');
const socketIoSession = require('socket.io-express-session');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database');
});


app.use(bodyParser.urlencoded({ extended: true }));


const sessionMiddleware = session({
  secret: 'secretKey', 
  resave: false,
  saveUninitialized: true
});
app.use(sessionMiddleware);

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/index');
  } else {
    res.sendFile(__dirname + '/public/login.html');
  }
});


app.get('/index', (req, res) => {
  if (req.session.user) {
    res.sendFile(__dirname + '/public/index.html');
  } else {
    res.redirect('/');
  }
});


app.post('/sign_in', (req, res) => {
  const name = req.body.uname;
  const pass = req.body.pass;

  db.query('SELECT * FROM users WHERE username = ? AND password = ?', [name, pass], (err, result) => {
    if (err) {
      console.error('Database query error:', err);
      return res.redirect('/');
    }
    if (result.length > 0) {
      req.session.user = result[0]; 
      req.session.username = name; 
      res.redirect('/index');
    } else {
      res.redirect('/?logsuccess=false');
    }
  });
});

app.post('/reg', (req, res) => {
  const name = req.body.uname;
  const pass = req.body.pass;
  const pass1 = req.body.pass1;

  if (pass === pass1) {
    db.query('INSERT INTO users (username, password) VALUES (?, ?)', [name, pass], (err, result) => {
      if (err) {
        console.error('Database query error:', err);
        return res.redirect('/?success=true');
      }
      console.log('User successfully registered');
      res.redirect('/?success=true');
    });
  } else {
    console.log('Passwords do not match');
    res.redirect('/?success=false');
  }
});


app.get('/indexg', (req, res) => {
  res.sendFile(__dirname + '/public/indexg.html');
});


app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.redirect('/index');
    }
    res.redirect('/');
  });
});


io.use(socketIoSession(sessionMiddleware));


io.on('connection', (socket) => {
  console.log('A user connected');

  
  db.query('SELECT content, timestamp, uname FROM messages ORDER BY timestamp ASC', (err, results) => {
    if (err) return console.error('Database query error:', err);
    results.forEach(row => {
      socket.emit('chat message', { content: row.content, timestamp: row.timestamp, uname: row.uname });
    });
  });

  socket.on('chat message', (msg) => {
    const username = socket.handshake.session.user.username;
    const query = 'INSERT INTO messages (content, timestamp, uname) VALUES (?, CURRENT_TIMESTAMP, ?)';
    db.query(query, [msg, username], (err) => {
      if (err) return console.error('Database query error:', err);
      io.emit('chat message', { content: msg, timestamp: new Date(), uname: username }); // Emit message with timestamp and username
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});
