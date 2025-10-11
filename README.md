# SmartSchedule – Schedule Management System

SmartSchedule is a web-based system developed using React and Bootstrap for the frontend, Node.js (Express) for the backend, and PostgreSQL as the database. It allows students and staff at King Saud University to efficiently handle schedule management.

Environment Variables
Create a `.env` file inside the server directory with the following values:

DB_USER=postgres
DB_HOST=localhost
DB_NAME=SmartSchedule
DB_PORT=5432
PORT=5000

How to Run Locally
Start the Backend (Server):
cd server
npm install
npm start

Start the Frontend (Client):
cd client
npm install
npm start

Make sure PostgreSQL is running and the database `SmartSchedule` is created before starting.

Demo Credentials
Register: 111@ksu.edu.sa / test123
Student: student1@student.ksu.edu.sa / test123

The staff account uses @ksu.edu.sa, while the student account uses @student.ksu.edu.sa.
