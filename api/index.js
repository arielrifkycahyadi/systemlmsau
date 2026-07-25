import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load Services
import { parserService } from '../services/parserService.js';
import { aiService } from '../services/aiService.js';
import { firebaseService } from '../services/firebaseService.js';
import { youtubeService } from '../services/youtubeService.js';
import { reportService } from '../services/reportService.js';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middlewares
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (such as mobile apps, curl, or local file open)
    if (!origin) return callback(null, true);
    if (
      origin.endsWith('.github.io') || 
      origin.startsWith('http://localhost:') || 
      origin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }
    return callback(new Error('CORS Policy: Access denied for this origin.'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-key']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root Route info
app.get('/api', (req, res) => {
  res.json({
    platform: "AU Learning API Server",
    creator: "Ariel Usman",
    socials: "@arielrcun & @madeai.ariel",
    status: "online",
    dbDriver: firebaseService.isMock() ? "FileSystem JSON Mock" : "Cloud Firestore"
  });
});

// --- 1. Parse Syllabus File ---
app.post('/api/parse-rps', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const text = await parserService.parseDocument(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );
    res.json({
      fileName: req.file.originalname,
      length: text.length,
      text: text
    });
  } catch (err) {
    console.error('Parse RPS Error:', err);
    res.status(500).json({ error: `Parsing syllabus error: ${err.message}` });
  }
});

// --- 2. Generate 16-Week Curriculum ---
app.post('/api/generate-curriculum', async (req, res) => {
  try {
    const { courseName, courseId, rpsText, additionalPrompt, apiKey, ytApiKey } = req.body;
    
    if (!courseName || !courseId || !rpsText) {
      return res.status(400).json({ error: 'Course name, ID, and syllabus text are required.' });
    }

    // Call Gemini API to structure syllabus outline
    const curriculum = await aiService.generateCurriculum(
      courseName,
      rpsText,
      additionalPrompt,
      apiKey
    );

    // Call YouTube search API for each week in parallel
    if (curriculum && curriculum.weeks) {
      await Promise.all(curriculum.weeks.map(async (week) => {
        try {
          const searchQuery = week.youtubeSearchQuery || `${courseName} ${week.topic}`;
          week.youtubeVideos = await youtubeService.fetchVideosForQuery(searchQuery, ytApiKey);
        } catch (ytErr) {
          console.error(`Failed YouTube fetch for Week ${week.weekNum}:`, ytErr.message);
          week.youtubeVideos = youtubeService.getMockVideos(week.topic);
        }
      }));
    }

    // Save generated syllabus back to DB
    const record = {
      ...curriculum,
      courseId,
      createdAt: new Date().toISOString()
    };
    await firebaseService.saveCourseData(courseId, record);

    res.json(record);
  } catch (err) {
    console.error('Generate Syllabus Error:', err);
    res.status(500).json({ error: `Curriculum generation error: ${err.message}` });
  }
});

// --- 3. Auto-Grade Student Essay ---
app.post('/api/grade-essay', async (req, res) => {
  try {
    const {
      studentName,
      studentId,
      email,
      courseId,
      courseName,
      weekNum,
      assignmentIndex,
      topic,
      assignmentPrompt,
      studentAnswer,
      rubrics,
      apiKey
    } = req.body;

    if (!studentAnswer || !assignmentPrompt) {
      return res.status(400).json({ error: 'Assignment prompt and student answer are required.' });
    }

    // AI grading call
    const evaluation = await aiService.gradeEssay(
      courseName || 'LMS Course',
      weekNum || 1,
      topic || 'Essay Assignment',
      assignmentPrompt,
      studentAnswer,
      rubrics || [],
      apiKey
    );

    // Save grading submission
    const submissionId = 'sub_' + Math.random().toString(36).substr(2, 9);
    const submissionData = {
      courseId,
      studentId,
      studentName,
      email,
      weekNum,
      assignmentIndex,
      type: 'essay',
      answers: studentAnswer,
      evaluation
    };
    await firebaseService.saveSubmission(submissionId, submissionData);

    res.json({ submissionId, ...submissionData });
  } catch (err) {
    console.error('Grade Essay Error:', err);
    res.status(500).json({ error: `AI Grading error: ${err.message}` });
  }
});

// --- 4. Export Spreadsheet / PDF report ---
app.post('/api/export-report', async (req, res) => {
  try {
    const { courseName, type, studentData, attendanceLogs } = req.body;

    if (!courseName || !studentData) {
      return res.status(400).json({ error: 'Course name and student data arrays are required.' });
    }

    if (type === 'pdf') {
      const buffer = await reportService.generatePDFBuffer(courseName, studentData, attendanceLogs || []);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Report_${courseName.replace(/\s+/g, '_')}.pdf"`);
      res.send(buffer);
    } else {
      const buffer = await reportService.generateExcelBuffer(courseName, studentData, attendanceLogs || []);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Report_${courseName.replace(/\s+/g, '_')}.xlsx"`);
      res.send(buffer);
    }
  } catch (err) {
    console.error('Export report error:', err);
    res.status(500).json({ error: `Reporting compilation error: ${err.message}` });
  }
});

// --- Local Runner Hook ---
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`AU Learning Express backend running locally!`);
    console.log(`Port: http://localhost:${PORT}`);
    console.log(`Database Fallback: ${firebaseService.isMock() ? "FileSystem JSON" : "Cloud Firestore"}`);
    console.log(`====================================================`);
  });
}

export default app;
