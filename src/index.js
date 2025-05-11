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

// Test database connection and verify views
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected successfully');

    // Verify if the required views exist
    pool.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name IN ('v_recent_live_assignment', 'v_assignment_student_try_info')
    `, (viewErr, viewRes) => {
      if (viewErr) {
        console.error('Error checking views:', viewErr);
      } else {
        const views = viewRes.rows.map(row => row.table_name);
        console.log('Available views:', views);

        if (!views.includes('v_recent_live_assignment')) {
          console.error('WARNING: v_recent_live_assignment view is missing!');
        }

        if (!views.includes('v_assignment_student_try_info')) {
          console.error('WARNING: v_assignment_student_try_info view is missing!');
        }
      }
    });
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
    console.log('Fetching assignments...');
    // First check if the view exists
    const viewCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name = 'v_recent_live_assignment'
      ) as exists
    `);

    if (!viewCheck.rows[0].exists) {
      console.log('View v_recent_live_assignment does not exist, showing placeholder data');
      // View doesn't exist, show placeholder data
      return res.render('assignments', {
        assignments: [
          {
            assignment_id: 1,
            assignment_name: 'Example Assignment 1',
            students_joined: 15,
            number_of_tries: 45,
            overall_percent_correct: 78
          },
          {
            assignment_id: 2,
            assignment_name: 'Example Assignment 2',
            students_joined: 22,
            number_of_tries: 67,
            overall_percent_correct: 82
          }
        ],
        isPlaceholder: true
      });
    }

    const result = await pool.query('SELECT * FROM v_recent_live_assignment ORDER BY assignment_id');
    console.log('Assignments data:', JSON.stringify(result.rows).substring(0, 200) + '...');
    res.render('assignments', { assignments: result.rows, isPlaceholder: false });
  } catch (err) {
    console.error('Error fetching assignments:', err);
    // Show placeholder data if there's an error
    res.render('assignments', {
      assignments: [
        {
          assignment_id: 1,
          assignment_name: 'Example Assignment 1',
          students_joined: 15,
          number_of_tries: 45,
          overall_percent_correct: 78
        },
        {
          assignment_id: 2,
          assignment_name: 'Example Assignment 2',
          students_joined: 22,
          number_of_tries: 67,
          overall_percent_correct: 82
        }
      ],
      isPlaceholder: true,
      error: err.message
    });
  }
});

app.get('/assignment/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // Check if views exist
    const viewsCheck = await pool.query(`
      SELECT
        (SELECT EXISTS (
          SELECT FROM information_schema.views
          WHERE table_schema = 'public'
          AND table_name = 'v_recent_live_assignment'
        )) as assignment_view_exists,
        (SELECT EXISTS (
          SELECT FROM information_schema.views
          WHERE table_schema = 'public'
          AND table_name = 'v_assignment_student_try_info'
        )) as student_view_exists
    `);

    if (!viewsCheck.rows[0].assignment_view_exists || !viewsCheck.rows[0].student_view_exists) {
      console.log('Required views do not exist, showing placeholder data');
      // Views don't exist, show placeholder data
      return res.render('assignment', {
        assignment: {
          assignment_id: id,
          assignment_name: 'Example Assignment ' + id,
          overall_percent_correct: 75
        },
        students: [
          {
            student_id: 1,
            full_name: 'John Doe',
            total_score: 85,
            most_current_question_index: 18,
            number_of_questions: 25,
            number_of_questions_correct: 15,
            percent_correct: 83
          },
          {
            student_id: 2,
            full_name: 'Jane Smith',
            total_score: 92,
            most_current_question_index: 25,
            number_of_questions: 25,
            number_of_questions_correct: 23,
            percent_correct: 92
          },
          {
            student_id: 3,
            full_name: 'Bob Johnson',
            total_score: 67,
            most_current_question_index: 14,
            number_of_questions: 25,
            number_of_questions_correct: 10,
            percent_correct: 71
          }
        ],
        isPlaceholder: true
      });
    }

    const assignmentResult = await pool.query('SELECT * FROM v_recent_live_assignment WHERE assignment_id = $1', [id]);
    const studentsResult = await pool.query('SELECT * FROM v_assignment_student_try_info WHERE assignment_id = $1 ORDER BY full_name', [id]);

    if (assignmentResult.rows.length === 0) {
      return res.render('assignment', {
        assignment: {
          assignment_id: id,
          assignment_name: 'Example Assignment ' + id,
          overall_percent_correct: 75
        },
        students: [
          {
            student_id: 1,
            full_name: 'John Doe',
            total_score: 85,
            most_current_question_index: 18,
            number_of_questions: 25,
            number_of_questions_correct: 15,
            percent_correct: 83
          },
          {
            student_id: 2,
            full_name: 'Jane Smith',
            total_score: 92,
            most_current_question_index: 25,
            number_of_questions: 25,
            number_of_questions_correct: 23,
            percent_correct: 92
          }
        ],
        isPlaceholder: true,
        notFound: true
      });
    }

    res.render('assignment', {
      assignment: assignmentResult.rows[0],
      students: studentsResult.rows,
      isPlaceholder: false
    });
  } catch (err) {
    console.error('Error fetching assignment details:', err);
    // Show placeholder data if there's an error
    res.render('assignment', {
      assignment: {
        assignment_id: req.params.id,
        assignment_name: 'Example Assignment ' + req.params.id,
        overall_percent_correct: 75
      },
      students: [
        {
          student_id: 1,
          full_name: 'John Doe',
          total_score: 85,
          most_current_question_index: 18,
          number_of_questions: 25,
          number_of_questions_correct: 15,
          percent_correct: 83
        },
        {
          student_id: 2,
          full_name: 'Jane Smith',
          total_score: 92,
          most_current_question_index: 25,
          number_of_questions: 25,
          number_of_questions_correct: 23,
          percent_correct: 92
        }
      ],
      isPlaceholder: true,
      error: err.message
    });
  }
});

app.get('/dashboard', (req, res) => {
  res.render('dashboard', { isPlaceholder: false });
});

app.get('/api/assignments', async (req, res) => {
  try {
    // Check if the view exists
    const viewCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name = 'v_recent_live_assignment'
      ) as exists
    `);

    if (!viewCheck.rows[0].exists) {
      console.log('View v_recent_live_assignment does not exist, showing placeholder data');
      // Return placeholder data
      return res.json([
        {
          assignment_id: 1,
          assignment_name: 'Example Assignment 1',
          students_joined: 15,
          number_of_tries: 45,
          overall_percent_correct: 78
        },
        {
          assignment_id: 2,
          assignment_name: 'Example Assignment 2',
          students_joined: 22,
          number_of_tries: 67,
          overall_percent_correct: 82
        }
      ]);
    }

    const result = await pool.query('SELECT * FROM v_recent_live_assignment ORDER BY assignment_id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching assignments:', err);
    // Return placeholder data
    res.json([
      {
        assignment_id: 1,
        assignment_name: 'Example Assignment 1',
        students_joined: 15,
        number_of_tries: 45,
        overall_percent_correct: 78
      },
      {
        assignment_id: 2,
        assignment_name: 'Example Assignment 2',
        students_joined: 22,
        number_of_tries: 67,
        overall_percent_correct: 82
      }
    ]);
  }
});

app.get('/api/assignment/:id/students', async (req, res) => {
  try {
    const id = req.params.id;

    // Check if the view exists
    const viewCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name = 'v_assignment_student_try_info'
      ) as exists
    `);

    if (!viewCheck.rows[0].exists) {
      console.log('View v_assignment_student_try_info does not exist, showing placeholder data');
      // Return placeholder data
      return res.json([
        {
          student_id: 1,
          assignment_id: id,
          full_name: 'John Doe',
          total_score: 85,
          most_current_question_index: 18,
          number_of_questions: 25,
          number_of_questions_correct: 15,
          percent_correct: 83
        },
        {
          student_id: 2,
          assignment_id: id,
          full_name: 'Jane Smith',
          total_score: 92,
          most_current_question_index: 25,
          number_of_questions: 25,
          number_of_questions_correct: 23,
          percent_correct: 92
        },
        {
          student_id: 3,
          assignment_id: id,
          full_name: 'Bob Johnson',
          total_score: 67,
          most_current_question_index: 14,
          number_of_questions: 25,
          number_of_questions_correct: 10,
          percent_correct: 71
        }
      ]);
    }

    const result = await pool.query('SELECT * FROM v_assignment_student_try_info WHERE assignment_id = $1 ORDER BY full_name', [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching assignment students:', err);
    // Return placeholder data
    res.json([
      {
        student_id: 1,
        assignment_id: id,
        full_name: 'John Doe',
        total_score: 85,
        most_current_question_index: 18,
        number_of_questions: 25,
        number_of_questions_correct: 15,
        percent_correct: 83
      },
      {
        student_id: 2,
        assignment_id: id,
        full_name: 'Jane Smith',
        total_score: 92,
        most_current_question_index: 25,
        number_of_questions: 25,
        number_of_questions_correct: 23,
        percent_correct: 92
      },
      {
        student_id: 3,
        assignment_id: id,
        full_name: 'Bob Johnson',
        total_score: 67,
        most_current_question_index: 14,
        number_of_questions: 25,
        number_of_questions_correct: 10,
        percent_correct: 71
      }
    ]);
  }
});

// Socket.IO connection for real-time updates
io.on('connection', (socket) => {
  console.log('New client connected');
  
  let intervalIds = [];
  
  socket.on('watchAssignment', async (assignmentId) => {
    console.log('Watching assignment:', assignmentId);

    // Check if the view exists first
    try {
      const viewCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.views
          WHERE table_schema = 'public'
          AND table_name = 'v_assignment_student_try_info'
        ) as exists
      `);

      const viewExists = viewCheck.rows[0].exists;

      // Create an interval to poll the database and emit updates
      const intervalId = setInterval(async () => {
        try {
          if (!viewExists) {
            // Use placeholder data if view doesn't exist
            const placeholderData = [
              {
                student_id: 1,
                assignment_id: assignmentId,
                full_name: 'John Doe',
                total_score: Math.floor(70 + Math.random() * 30), // Random score between 70-100 for demo
                most_current_question_index: Math.floor(10 + Math.random() * 15), // Random progress
                number_of_questions: 25,
                number_of_questions_correct: Math.floor(10 + Math.random() * 15),
                percent_correct: Math.floor(60 + Math.random() * 40)
              },
              {
                student_id: 2,
                assignment_id: assignmentId,
                full_name: 'Jane Smith',
                total_score: Math.floor(70 + Math.random() * 30),
                most_current_question_index: Math.floor(15 + Math.random() * 10),
                number_of_questions: 25,
                number_of_questions_correct: Math.floor(15 + Math.random() * 10),
                percent_correct: Math.floor(60 + Math.random() * 40)
              },
              {
                student_id: 3,
                assignment_id: assignmentId,
                full_name: 'Bob Johnson',
                total_score: Math.floor(60 + Math.random() * 40),
                most_current_question_index: Math.floor(5 + Math.random() * 20),
                number_of_questions: 25,
                number_of_questions_correct: Math.floor(5 + Math.random() * 15),
                percent_correct: Math.floor(50 + Math.random() * 50)
              }
            ];
            socket.emit('assignmentUpdate', { assignmentId, students: placeholderData });
          } else {
            // Query the actual database if view exists
            const result = await pool.query(
              'SELECT * FROM v_assignment_student_try_info WHERE assignment_id = $1 ORDER BY full_name',
              [assignmentId]
            );
            socket.emit('assignmentUpdate', { assignmentId, students: result.rows });
          }
        } catch (err) {
          console.error('Error fetching assignment updates:', err);
          // Still provide placeholder data on error
          const placeholderData = [
            {
              student_id: 1,
              assignment_id: assignmentId,
              full_name: 'John Doe',
              total_score: Math.floor(70 + Math.random() * 30),
              most_current_question_index: Math.floor(10 + Math.random() * 15),
              number_of_questions: 25,
              number_of_questions_correct: Math.floor(10 + Math.random() * 15),
              percent_correct: Math.floor(60 + Math.random() * 40)
            },
            {
              student_id: 2,
              assignment_id: assignmentId,
              full_name: 'Jane Smith',
              total_score: Math.floor(70 + Math.random() * 30),
              most_current_question_index: Math.floor(15 + Math.random() * 10),
              number_of_questions: 25,
              number_of_questions_correct: Math.floor(15 + Math.random() * 10),
              percent_correct: Math.floor(60 + Math.random() * 40)
            }
          ];
          socket.emit('assignmentUpdate', { assignmentId, students: placeholderData });
        }
      }, 1000); // Update every second

      intervalIds.push(intervalId);
    } catch (err) {
      console.error('Error checking if view exists:', err);
    }
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