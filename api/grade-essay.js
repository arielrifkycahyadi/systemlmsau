import { aiService } from '../services/aiService.js';
import { firebaseService } from '../services/firebaseService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-gemini-key');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

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

  try {
    const evaluation = await aiService.gradeEssay(
      courseName,
      weekNum,
      topic,
      assignmentPrompt,
      studentAnswer,
      rubrics,
      apiKey
    );

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

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ submissionId, ...submissionData });
  } catch (error) {
    console.error(error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: `AI Grading error: ${error.message}` });
  }
}
