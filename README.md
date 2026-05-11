Team:
Shukurov Elshan
Valiyev Farid
Mansurov Akshin
Aliyev Anar

Supervisor: Javid Guliyev


# Smart CV Job Matcher

A smart web application that helps you find the best job opportunities by analyzing your CV and matching it with job postings. The system uses artificial intelligence to understand your skills and experience, then automatically finds suitable jobs for you.

## Features

- **CV Analysis**: Upload your CV in PDF format. The application reads and extracts important information like skills, experience, and qualifications.
- **Smart Job Matching**: Uses advanced AI technology to match your CV with job postings from different sources.
- **Multi-language Support**: Works with English, Azerbaijani, and Russian. Your CV can be in any of these languages.
- **User Account**: Create an account to save your CV, track job matches, and manage your applications.
- **Real-time Updates**: The system regularly searches for new jobs and shows you new opportunities automatically.
- **Job Recommendations**: Get personalized job suggestions based on your profile and skills.

## Project Structure

### Backend
The backend is built with Node.js and TypeScript. It handles all business logic, database operations, and AI processing.

```
backend/
├── src/
│   ├── controllers/     # Request handlers for different features
│   ├── services/        # Business logic (CV analysis, job matching, AI)
│   ├── routes/          # API endpoint definitions
│   ├── middleware/      # Authentication, error handling, validation
│   ├── lib/             # Helper functions and utilities
│   └── cron.ts          # Automatic job search scheduling
├── prisma/              # Database setup and migrations
└── scratch/             # Test and development scripts
```

### Frontend
The frontend is a modern React application built with Vite. It provides the user interface for uploading CVs and viewing job matches.

```
frontend/
├── src/
│   ├── pages/           # Different screens (Login, Dashboard, etc.)
│   ├── components/      # UI components (buttons, cards, etc.)
│   ├── services/        # Functions to call the API
│   ├── contexts/        # Authentication and global state
│   └── types/           # TypeScript type definitions
└── public/              # Static files
```

## Technology Stack

### Backend
- **Framework**: Express.js (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Google Generative AI (Gemini)
- **PDF Processing**: pdf-parse
- **Authentication**: JWT tokens
- **Email**: Resend
- **Web Scraping**: Cheerio and Axios
- **Task Scheduling**: node-cron

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Routing**: React Router
- **Charts**: Recharts
- **Language**: TypeScript

## Getting Started

### Prerequisites
You need to have these installed on your computer:
- Node.js (version 18 or newer)
- npm (comes with Node.js)
- PostgreSQL database

### Installation and Setup

#### 1. Clone the repository
```bash
git clone <your-repository-url>
cd smart-cv-job-matcher
```

#### 2. Setup Backend

Navigate to the backend folder:
```bash
cd backend
```

Install dependencies:
```bash
npm install
```

Create a `.env` file in the backend folder with these settings:
```
DATABASE_URL=postgresql://user:password@localhost:5432/cv_matcher
FRONTEND_URL=http://localhost:5173
PORT=5000
GEMINI_API_KEY=your_google_api_key
RESEND_API_KEY=your_resend_api_key
JWT_SECRET=your_secret_key
```

Setup the database:
```bash
npm run db:migrate
npm run db:generate
```

Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

#### 3. Setup Frontend

In a new terminal, navigate to the frontend folder:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## How to Use

1. **Open the application** in your web browser at `http://localhost:5173`
2. **Create an account** or log in if you already have one
3. **Upload your CV** as a PDF file
4. **View your matches** - the system will analyze your CV and show you matching job opportunities
5. **Apply for jobs** - click on interesting job listings and apply directly

## API Endpoints

### Authentication
- `POST /auth/register` - Create a new account
- `POST /auth/login` - Log in to your account
- `POST /auth/logout` - Log out

### User Profile
- `GET /users/profile` - Get your profile information
- `PUT /users/profile` - Update your profile
- `POST /users/upload-cv` - Upload your CV

### Job Matching
- `GET /analysis/matches` - Get your job matches
- `POST /analysis/analyze` - Analyze your CV
- `GET /analysis/history` - View your analysis history

## Development

### Running Tests
Some test files are available in the `backend/scratch` folder. To run a test:
```bash
npm run dev -- scratch/test_filename.ts
```

### Database Management
View and edit database data using Prisma Studio:
```bash
npm run db:studio
```

### Build for Production

**Backend:**
```bash
npm run build
npm run start
```

**Frontend:**
```bash
npm run build
```

This creates a `dist` folder with optimized files ready for production.

## Project Database

The application uses PostgreSQL database with the following main tables:

- **users**: Stores user account information
- **cvs**: Stores uploaded CV data
- **jobs**: Stores job listings
- **job_matches**: Stores the matching results between CVs and jobs

Database migrations are stored in `backend/prisma/migrations/`

## Troubleshooting

### Backend won't start
- Check if PostgreSQL is running
- Make sure your `.env` file has the correct database URL
- Try running migrations again: `npm run db:migrate`

### Frontend won't load
- Check if the backend is running on port 5000
- Try clearing your browser cache
- Make sure you're using the correct frontend URL in `.env`

### CV upload fails
- Make sure your PDF file is not too large (max 10MB recommended)
- Check if the file is a valid PDF
- Try uploading a different PDF file

## Contributing

We welcome contributions! If you find bugs or want to add new features:

1. Create a new branch for your work
2. Make your changes
3. Test thoroughly
4. Submit a pull request with a description of your changes

## License

This project is private and confidential.

## Support

If you have questions or need help:
- Check the troubleshooting section above
- Review the code comments in relevant files
- Check the database schema in `backend/prisma/schema.prisma`

## Future Plans

- Add more job sources
- Improve CV parsing accuracy
- Add job alerts and notifications
- Expand language support
- Create mobile application
- Add advanced filtering options




