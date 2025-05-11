# Student Progress Dashboard

A real-time dashboard to track student progress on assignments using PostgreSQL views.

## Features

- **Assignments List**: View all active assignments with statistics
- **Assignment Detail**: Track individual student progress on each assignment
- **Multi-View Dashboard**: Monitor multiple assignments simultaneously in a 1, 2, or 4-panel layout
- **Real-time Updates**: Live data refresh via WebSockets
- **Visual Progress Tracking**: Color-coded progress bars showing correct (green), incorrect (red), and remaining (gray) questions

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Real-time Updates**: Socket.IO
- **Frontend**: HTML, CSS, JavaScript
- **Templating**: EJS

## Database Views

This application works with two PostgreSQL views:

1. `v_recent_live_assignment` - Contains information about recent assignments
2. `v_assignment_student_try_info` - Contains detailed student progress information

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/student-progress-dashboard.git
cd student-progress-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables in `.env`:
```
DB_HOST=193.42.244.152
DB_PORT=2345
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=psql@2025
PORT=3000
```

4. Start the server:
```bash
npm run dev
```

5. Access the dashboard at http://localhost:3000

## Dashboard Views

- **Home**: `/` - Welcome page with navigation
- **Assignments List**: `/assignments` - View all assignments
- **Assignment Detail**: `/assignment/:id` - View student progress for a specific assignment
- **Multi-View Dashboard**: `/dashboard` - Customizable dashboard to view multiple assignments

## API Endpoints

- `GET /api/assignments` - Get all assignments
- `GET /api/assignment/:id/students` - Get all students for a specific assignment

## License

MIT