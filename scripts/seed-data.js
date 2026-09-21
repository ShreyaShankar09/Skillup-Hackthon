// scripts/seed-data.js — Raw starter content, extracted verbatim.

const modules = [
  [1,'ic-code','Advanced JavaScript & ES6+','Deep dive into modern JS: async/await, promises, destructuring, modules.','JavaScript','intermediate','5 hrs','https://skillsbuild.org',1,0],
  [2,'ic-zap','React.js Fundamentals','Build dynamic UIs with React: components, state, props, hooks, lifecycle.','Frontend','intermediate','8 hrs','https://skillsbuild.org',1,0],
  [3,'ic-layers','Node.js & Express APIs','Create REST APIs with Node.js and Express: routing, middleware, auth.','Backend','intermediate','7 hrs','https://skillsbuild.org',0,1],
  [4,'ic-file-code','MongoDB & Mongoose','Work with MongoDB: schema design, CRUD, aggregation, indexing.','Database','intermediate','4 hrs','https://skillsbuild.org',0,0],
  [5,'ic-lock','Authentication & Security','JWT tokens, bcrypt hashing, OAuth, and security best practices.','Security','intermediate','4 hrs','https://skillsbuild.org',0,0],
  [6,'ic-git-branch','Full-Stack Project','Build a complete MERN stack app with authentication and deployment.','Projects','intermediate','10 hrs','https://skillsbuild.org',0,0],
];

const onboardItems = [
  ['1','Set up development environment','Setup',1,'Install Node.js, Git, VS Code, clone the repository.','Your dev environment is the set of tools that allows you to write, run, and debug code locally.','A consistent environment prevents "works on my machine" issues.',JSON.stringify(['Install Node.js v18+ from nodejs.org','Install VS Code','Clone the repo with git clone','Run npm install','Copy .env.example to .env']),JSON.stringify(['ENOENT: file missing — run npm install','Port 5000 in use — change PORT in .env'])],
  ['2','Read the README and documentation','Understanding',1,'Understand the project architecture, tech stack, and folder structure.','The README is the entry point — it explains what the project does, how to run it, and how to contribute.','Reading docs first saves hours of confusion.',JSON.stringify(['Open README.md in root directory','Read Architecture section','Review API documentation']),JSON.stringify(['Missing README — ask team lead','Outdated docs — check git log'])],
  ['3','Understand the Git branching strategy','Workflow',0,'Learn the team\'s Git workflow: main/develop/feature branches, commit conventions.','A branching strategy defines how the team uses Git branches to manage features and releases.','Without a strategy, teams end up with merge conflicts and broken main branches.',JSON.stringify(['main = production, develop = staging, feature/* = your work','Create: git checkout -b feature/my-task','Commit: git commit -m "feat: add login"','Push and open a Pull Request']),JSON.stringify(['Never commit directly to main','Use semantic commits: feat/fix/docs/chore'])],
  ['4','Run the project locally end-to-end','Setup',0,'Start both frontend (Vite) and backend (Express) and confirm the app works.','Running locally means both React frontend and Node.js backend are running on your machine.','You need a local environment to develop features and test changes.',JSON.stringify(['Terminal 1: cd server && npm run dev','Terminal 2: cd client && npm run dev','Open http://localhost:5173']),JSON.stringify(['MongoDB error — check MONGODB_URI in .env','Module not found — run npm install'])],
  ['5','Complete your first code review','Contributing',0,'Review an open Pull Request from a teammate. Leave constructive comments.','A code review examines teammate code before it is merged into the main codebase.','Code reviews catch bugs, share knowledge, and maintain code quality.',JSON.stringify(['Go to Pull Requests tab','Open a PR needing review','Read each changed file','Leave comments, approve or request changes']),JSON.stringify(['Be kind — focus on code, not person','Ask "why" rather than demanding'])],
  ['6','Make your first commit to the codebase','Contributing',0,'Fix a small bug, improve docs, or add a comment. Open a Pull Request.','Your first commit is a meaningful contribution — even a small fix counts.','Starting small builds confidence and makes you a contributing member from day one.',JSON.stringify(['Pick a "good first issue"','Create feature branch','Make your change','Commit and open a PR']),JSON.stringify(["Don't overthink — start small",'Ask for help in PR comments'])],
];

const questions = [
  ['How many years of programming experience do you have?','single',JSON.stringify(['Less than 1 year','1-2 years','2-4 years','4+ years']),1],
  ['How comfortable are you with JavaScript?','single',JSON.stringify(['Never used it','Beginner','Intermediate','Advanced']),2],
  ['How familiar are you with Git and GitHub?','single',JSON.stringify(['Never used','Know the basics','Use regularly','Advanced user']),3],
  ['Which of the following have you built before?','multi',JSON.stringify(['Static websites','REST APIs','Full-stack apps','Mobile apps','Databases','None yet']),4],
  ['How comfortable are you with databases?','single',JSON.stringify(['No experience','Basic SQL','Multiple DBs','Database design']),5],
  ['How familiar are you with React or frontend frameworks?','single',JSON.stringify(['Not familiar','Heard of it','Used it once or twice','Use it regularly']),6],
  ['Do you have experience with backend/server-side development?','single',JSON.stringify(['No experience','Basic knowledge','Intermediate','Advanced']),7],
  ['How would you rate your overall developer confidence?','single',JSON.stringify(['Just starting','Growing','Confident','Very experienced']),8],
];

const kbArticles = [
  [1,'What is the difference between async/await and Promises in JavaScript?','Async/await is syntactic sugar over Promises that makes async code look synchronous. `async` functions always return a Promise. `await` pauses execution inside an async function until the Promise resolves. Both achieve the same result, but async/await is generally more readable for complex chains.','JavaScript',142,38],
  [2,'How do I fix a CORS error in my Express API?','CORS errors happen when your frontend and backend are on different origins. Fix it by installing the `cors` package and adding `app.use(cors({ origin: "http://localhost:5173" }))` to your Express server. For production, specify your actual domain instead of localhost.','Node.js',98,27],
  [3,'What is the difference between useEffect and useLayoutEffect in React?','`useEffect` runs after the browser has painted the screen (async, non-blocking). `useLayoutEffect` runs synchronously after DOM mutations but before the browser paints. Use `useEffect` for most cases (API calls, subscriptions). Use `useLayoutEffect` only when you need to read DOM layout and synchronously re-render.','React',85,22],
  [4,'How do I create and use a Git branch for a new feature?','1. `git checkout -b feature/my-feature` — creates and switches to a new branch\n2. Make your changes and commit: `git commit -m "feat: describe your change"`\n3. Push to remote: `git push origin feature/my-feature`\n4. Open a Pull Request on GitHub to merge into your main/develop branch.','Git',76,31],
  [5,'What is JWT and how does authentication work with it?','JWT (JSON Web Token) is a compact, self-contained token for securely transmitting information. Auth flow: 1) User logs in → server validates credentials → server creates JWT signed with a secret. 2) Client stores JWT in localStorage/cookie. 3) Client sends JWT in `Authorization: Bearer <token>` header on every request. 4) Server verifies the signature and extracts user info.','General',64,19],
];

const notifications = [
  [1,'Badge Earned','You earned the "Fast Learner" badge for completing 3 modules.','achievement',0,'5 min ago'],
  [2,'Keep your streak going',"You haven't logged any activity today. Don't break your 5-day streak!",'reminder',0,'1h ago'],
  [3,'Learning path updated','2 new recommended modules have been added to your path.','info',0,'3h ago'],
  [4,'New module available','Advanced TypeScript Patterns is now available for intermediate developers.','info',1,'1d ago'],
  [5,"You're 1 module away",'Complete one more module to earn the "Learning Champion" badge.','reminder',1,'2d ago'],
];

const teamMembers = [
  ['Dan Martinez','DM','#a371f7','Advanced',92,98,21,'on-track'],
  ['Alice Johnson','AJ','#388bfd','Advanced',78,94,12,'on-track'],
  ['Bob Chen','BC','#e36209','Intermediate',45,87,5,'on-track'],
  ['Eva Wilson','EW','#2da44e','Intermediate',32,72,0,'behind'],
  ['Carol Davis','CD','#f85149','Beginner',15,65,0,'inactive'],
];

const ghActivities = [
  ['commit','ic-git-commit','var(--blue-dim)','var(--blue)','feat: add JWT authentication middleware','This commit implements JWT-based authentication, protecting all private API routes.','Dan Martinez','2 hours ago','badge-blue','Commit'],
  ['pr','ic-git-pull-request','var(--purple-dim)','var(--purple)','PR #47: Add user learning dashboard','This pull request introduces the main learning dashboard with progress tracking.','Alice Johnson','5 hours ago','badge-purple','Pull Request'],
  ['issue','ic-alert-circle','var(--streak-dim)','var(--streak)','Issue #23: MongoDB connection drops under load','Users are experiencing database connection timeouts during peak usage.','Bob Chen','1 day ago','badge-orange','Issue'],
  ['commit','ic-git-commit','var(--blue-dim)','var(--blue)','fix: resolve CORS error for production domain','Updated CORS configuration to allow requests from the production frontend URL.','Eva Wilson','1 day ago','badge-blue','Commit'],
  ['pr','ic-git-pull-request','var(--purple-dim)','var(--purple)','PR #46: Gamification badge system','Implements the complete badge and points system including leaderboard.','Dan Martinez','2 days ago','badge-purple','Pull Request'],
];

const badges = [
  ['ic-star','First Steps','Complete your first onboarding task',50,1,'Jan 15'],
  ['ic-zap','Fast Learner','Complete 3 modules in one day',200,1,'Jan 18'],
  ['ic-code','Code Warrior','Use the AI assistant 10 times',150,1,'Jan 20'],
  ['ic-flame','Streak Starter','Maintain a 3-day streak',100,1,'Jan 21'],
  ['ic-book-open','Explorer','Visit all platform sections',75,0,null],
  ['ic-git-branch','Git Master','Connect a GitHub repository',125,0,null],
  ['ic-users','Team Player','Complete the full onboarding checklist',300,0,null],
  ['ic-trophy','Legend','Reach 5,000 total points',500,0,null],
];

const leaderboard = [
  ['Dan Martinez','DM','#a371f7','Advanced',4850,14,21,0],
  ['Alice Johnson','AJ','#388bfd','Advanced',3920,11,12,0],
  ['Bob Chen','BC','#e36209','Intermediate',2750,8,5,1],
  ['Eva Wilson','EW','#2da44e','Intermediate',2100,6,2,0],
  ['Carol Davis','CD','#f85149','Beginner',1400,4,0,0],
  ['Frank Brown','FB','#0ea5e9','Beginner',850,2,0,0],
];

const fileTree = [
  {
    type: 'folder',
    name: 'SkillUp',
    level: 0,
    open: true,
    children: [

      {
        type: 'folder',
        name: 'controllers',
        level: 1,
        open: false,
        children: [
          {
            type: 'file',
            name: 'auth.controller.js',
            level: 2,
            ext: 'js',
            important: true
          },
          {
            type: 'file',
            name: 'chat.controller.js',
            level: 2,
            ext: 'js',
            important: true
          },
          {
            type: 'file',
            name: 'learning.controller.js',
            level: 2,
            ext: 'js'
          },
          {
            type: 'file',
            name: 'assessment.controller.js',
            level: 2,
            ext: 'js'
          },
          {
            type: 'file',
            name: 'dashboard.controller.js',
            level: 2,
            ext: 'js'
          },
          {
            type: 'file',
            name: 'gamification.controller.js',
            level: 2,
            ext: 'js'
          }
        ]
      },

      {
        type: 'folder',
        name: 'config',
        level: 1,
        open: false,
        children: [
          {
            type: 'file',
            name: 'db.js',
            level: 2,
            ext: 'js',
            important: true
          },
          {
            type: 'file',
            name: 'auth.js',
            level: 2,
            ext: 'js'
          }
        ]
      },

      {
        type: 'folder',
        name: 'middleware',
        level: 1,
        open: false,
        children: [
          {
            type: 'file',
            name: 'requireAuth.js',
            level: 2,
            ext: 'js',
            important: true
          }
        ]
      },

      {
        type: 'folder',
        name: 'routes',
        level: 1,
        open: false,
        children: [
          {
            type: 'file',
            name: 'index.js',
            level: 2,
            ext: 'js',
            important: true
          },
          {
            type: 'file',
            name: 'auth.routes.js',
            level: 2,
            ext: 'js'
          },
          {
            type: 'file',
            name: 'chat.routes.js',
            level: 2,
            ext: 'js'
          },
          {
            type: 'file',
            name: 'learning.routes.js',
            level: 2,
            ext: 'js'
          },
          {
            type: 'file',
            name: 'assessment.routes.js',
            level: 2,
            ext: 'js'
          }
        ]
      },

      {
        type: 'folder',
        name: 'services',
        level: 1,
        open: false,
        children: [
          {
            type: 'file',
            name: 'progress.js',
            level: 2,
            ext: 'js',
            important: true
          }
        ]
      },

      {
        type: 'folder',
        name: 'public',
        level: 1,
        open: false,
        children: [
          {
            type: 'file',
            name: 'index.html',
            level: 2,
            ext: 'html',
            important: true
          }
        ]
      },

      {
        type: 'folder',
        name: 'scripts',
        level: 1,
        open: false,
        children: [
          {
            type: 'file',
            name: 'seed-data.js',
            level: 2,
            ext: 'js'
          }
        ]
      },

      {
        type: 'file',
        name: 'server.js',
        level: 1,
        ext: 'js',
        important: true
      },

      {
        type: 'file',
        name: 'package.json',
        level: 1,
        ext: 'json',
        important: true
      },

      {
        type: 'file',
        name: '.env.example',
        level: 1,
        ext: 'env'
      },

      {
        type: 'file',
        name: 'README.md',
        level: 1,
        ext: 'md'
      }
    ]
  }
];

const fileExplanations = {
  'server.js': {
    title: 'Main Server',
    explanation:
      'Starts the Express server, loads environment variables, initializes the SQLite database, and connects the application routes.'
  },

  'package.json': {
    title: 'Project Dependencies',
    explanation:
      'Defines the SkillUp project metadata, scripts, and npm dependencies required by the backend and frontend.'
  },

  'db.js': {
    title: 'Database Configuration',
    explanation:
      'Initializes the SQLite database connection and provides the database layer used by the application.'
  },

  'auth.js': {
    title: 'Authentication Configuration',
    explanation:
      'Contains authentication-related configuration used to protect user sessions and access.'
  },

  'requireAuth.js': {
    title: 'Authentication Middleware',
    explanation:
      'Middleware that checks whether a user is authenticated before allowing access to protected API routes.'
  },

  'index.js': {
    title: 'Main Routes',
    explanation:
      'Registers and organizes the API routes used by the SkillUp application.'
  },

  'auth.routes.js': {
    title: 'Authentication Routes',
    explanation:
      'Handles user registration, login, logout, and authentication-related API requests.'
  },

  'chat.routes.js': {
    title: 'AI Chat Routes',
    explanation:
      'Provides API endpoints for the SkillUp AI learning assistant and chat history.'
  },

  'learning.routes.js': {
    title: 'Learning Routes',
    explanation:
      'Provides endpoints for learning modules, module completion, and learning progress.'
  },

  'assessment.routes.js': {
    title: 'Assessment Routes',
    explanation:
      'Handles assessment questions, submitted answers, scoring, and assessment-related learning data.'
  },

  'progress.js': {
    title: 'Progress Service',
    explanation:
      'Contains logic for calculating and updating learner progress, streaks, activity, and related statistics.'
  },

  'auth.controller.js': {
    title: 'Authentication Controller',
    explanation:
      'Contains the server-side logic for user authentication operations such as registration and login.'
  },

  'chat.controller.js': {
    title: 'Chat Controller',
    explanation:
      'Processes AI chat requests, manages chat history, and communicates with the configured AI service.'
  },

  'learning.controller.js': {
    title: 'Learning Controller',
    explanation:
      'Handles learning-related requests and coordinates module data and learner progress.'
  },

  'assessment.controller.js': {
    title: 'Assessment Controller',
    explanation:
      'Processes assessment submissions and calculates results based on the learner responses.'
  },

  'dashboard.controller.js': {
    title: 'Dashboard Controller',
    explanation:
      'Provides the data required to display the learner dashboard and progress information.'
  },

  'gamification.controller.js': {
    title: 'Gamification Controller',
    explanation:
      'Handles points, badges, streaks, and other gamification-related functionality.'
  },

  'index.html': {
    title: 'SkillUp Frontend',
    explanation:
      'Contains the main SkillUp web interface, including navigation, dashboard, learning modules, assessments, AI chat, and the Project Explorer.'
  },

  'seed-data.js': {
    title: 'Seed Data',
    explanation:
      'Provides initial application data used to populate the SkillUp SQLite database during development.'
  }
};

module.exports = { modules, onboardItems, questions, kbArticles, notifications, teamMembers, ghActivities, badges, leaderboard, fileTree, fileExplanations };
