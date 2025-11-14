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



 Render – Deployment Platform
·       
·      Render is a cloud hosting platform used to deploy and run web applications. It provides an easy way to host frontend and backend services without managing servers manually.
·       
·      In short:
·      Used to deploy and host the website online.
·     
·      2. Supabase – Backend as a Service
·       
·      Supabase is an open-source backend platform that offers:
·      • PostgreSQL database
·      • Auto-generated REST and GraphQL APIs
·      • Authentication
·      • File storage
·      • Real-time features
·       
·      In short:
·      Used to store application data, handle authentication, and manage backend operations without building a full custom backend.
·     
·      3. Dashboard Implementation using Chart.js
·       
·      Chart.js is a JavaScript library for building interactive data visualizations such as line charts, bar charts, and pie charts.
·       
·      In short:
·      Used to create a visual, easy-to-read dashboard by displaying data through charts.
·     
·      4. Real-time Collaboration using Yjs
·       
·      Yjs is a real-time collaboration framework based on CRDTs. It synchronizes data between multiple users instantly and handles concurrent edits without conflicts.
·       
·      In short:
·      Used to enable real-time, multi-user collaboration, where users can see updates live as they happen.
 
·       
·      Google Gemini:
To enhance SmartSchedule and reduce manual scheduling effort, we integrated Google Gemini to generate complete academic schedules. Google Gemini is a modern generative AI model capable of understanding complex instructions, analyzing constraints, and producing structured, high-quality outputs. In SmartSchedule, Gemini receives the organized data and generates a clear, conflict-free schedule that aligns with the system’s rules.
