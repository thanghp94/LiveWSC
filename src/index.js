require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Configure PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected successfully');
  }
});

// Set up EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/assignments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_recent_live_assignment ORDER BY assignment_id');
    res.render('assignments', { assignments: result.rows });
  } catch (err) {
    console.error('Error fetching assignments:', err);
    res.status(500).send('Server error');
  }
});

app.get('/assignment/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const assignmentResult = await pool.query('SELECT * FROM v_recent_live_assignment WHERE assignment_id = $1', [id]);
    const studentsResult = await pool.query('SELECT * FROM v_assignment_student_try_info WHERE assignment_id = $1 ORDER BY full_name', [id]);
    
    if (assignmentResult.rows.length === 0) {
      return res.status(404).send('Assignment not found');
    }
    
    res.render('assignment', {
      assignment: assignmentResult.rows[0],
      students: studentsResult.rows
    });
  } catch (err) {
    console.error('Error fetching assignment details:', err);
    res.status(500).send('Server error');
  }
});

app.get('/dashboard', (req, res) => {
  res.render('dashboard');
});

app.get('/api/assignments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_recent_live_assignment ORDER BY assignment_id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching assignments:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/assignment/:id/students', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('SELECT * FROM v_assignment_student_try_info WHERE assignment_id = $1 ORDER BY full_name', [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching assignment students:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Socket.IO connection for real-time updates
io.on('connection', (socket) => {
  console.log('New client connected');
  
  let intervalIds = [];
  
  socket.on('watchAssignment', async (assignmentId) => {
    console.log('Watching assignment:', assignmentId);
    
    // Create an interval to poll the database and emit updates
    const intervalId = setInterval(async () => {
      try {
        const result = await pool.query(
          'SELECT * FROM v_assignment_student_try_info WHERE assignment_id = $1 ORDER BY full_name',
          [assignmentId]
        );
        socket.emit('assignmentUpdate', { assignmentId, students: result.rows });
      } catch (err) {
        console.error('Error fetching assignment updates:', err);
      }
    }, 1000); // Update every second
    
    intervalIds.push(intervalId);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // Clear all intervals when client disconnects
    intervalIds.forEach(id => clearInterval(id));
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});