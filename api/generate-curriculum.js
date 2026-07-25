import { aiService } from '../services/aiService.js';
import { youtubeService } from '../services/youtubeService.js';
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

  const { courseName, courseId, rpsText, additionalPrompt, apiKey, ytApiKey } = req.body;

  try {
    const curriculum = await aiService.generateCurriculum(
      courseName,
      rpsText,
      additionalPrompt,
      apiKey
    );

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

    const record = {
      ...curriculum,
      courseId,
      createdAt: new Date().toISOString()
    };

    await firebaseService.saveCourseData(courseId, record);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(record);
  } catch (error) {
    console.error(error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: `Curriculum generation error: ${error.message}` });
  }
}
