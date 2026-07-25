import { GoogleGenAI } from '@google/genai';

// Initialize AI Client helper
function getAIClient(customKey) {
  const key = customKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Google Gemini API Key is missing. Set GEMINI_API_KEY in server environment or configuration settings.');
  }
  return new GoogleGenAI({ apiKey: key });
}

export const aiService = {
  // --- Curriculum Generator ---
  async generateCurriculum(courseName, rpsText, additionalPrompt = '', customKey = null) {
    const ai = getAIClient(customKey);

    const systemInstruction = `
      You are AU Learning AI, a Senior Instructional Designer.
      Analyze the course syllabus (RPS) text and generate a structured 16-week curriculum.
      
      Requirements:
      1. Map weeks 1 to 16. Week 8 must be the Midterm Exam (UTS) and Week 16 must be the Final Exam (UAS).
      2. Set Bloom Taxonomy levels (C1-Remember, C2-Understand, C3-Apply, C4-Analyze, C5-Evaluate, C6-Create) for each week.
      3. Create Course Learning Outcomes (CPL and CPMK lists).
      4. Auto-generate standard essay rubrics.
      5. Week 8 (UTS) and Week 16 (UAS) must contain comprehensive exam question banks (e.g. multiple-choice questions or structured exam prompts).
      6. Provide a targeted YouTube search query for educational videos in each week.
    `;

    const userPrompt = `
      Course Name: ${courseName}
      Additional Custom Directives: ${additionalPrompt}
      
      Syllabus (RPS) Content:
      ${rpsText}
    `;

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        courseName: { type: 'STRING' },
        cpl: { type: 'ARRAY', items: { type: 'STRING' } },
        cpmk: { type: 'ARRAY', items: { type: 'STRING' } },
        essayRubrics: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              criteriaName: { type: 'STRING' },
              description: { type: 'STRING' },
              maxScore: { type: 'INTEGER' }
            },
            required: ['criteriaName', 'description', 'maxScore']
          }
        },
        weeks: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              weekNum: { type: 'INTEGER' },
              topic: { type: 'STRING' },
              subtopic: { type: 'STRING' },
              learningMethod: { type: 'STRING' },
              bloomTaxonomy: { type: 'STRING' },
              youtubeSearchQuery: { type: 'STRING' },
              assignments: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    type: { type: 'STRING' }, // "quiz" or "essay"
                    prompt: { type: 'STRING' },
                    quizQuestions: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          question: { type: 'STRING' },
                          options: { type: 'ARRAY', items: { type: 'STRING' } },
                          correctOptionIndex: { type: 'INTEGER' }
                        },
                        required: ['question', 'options', 'correctOptionIndex']
                      }
                    }
                  },
                  required: ['type', 'prompt']
                }
              }
            },
            required: ['weekNum', 'topic', 'bloomTaxonomy', 'youtubeSearchQuery', 'assignments']
          }
        }
      },
      required: ['courseName', 'cpl', 'cpmk', 'essayRubrics', 'weeks']
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
      }
    });

    const text = response.text().trim();
    return JSON.parse(text);
  },

  // --- Auto-Grader for Essays ---
  async gradeEssay(courseName, weekNum, topic, prompt, answer, rubrics, customKey = null) {
    const ai = getAIClient(customKey);

    const systemInstruction = `
      You are AU Learning AI Auto-Grader, an expert university professor.
      Assess the student's essay answer against the assignment prompt and grading rubrics.
      Ensure the total 'score' matches the exact sum of all criteria scores awarded.
    `;

    const userPrompt = `
      Course Name: ${courseName}
      Week Number: ${weekNum}
      Topic: ${topic}
      Assignment Prompt: ${prompt}
      
      Student's Submission:
      ${answer}
      
      Grading Rubrics:
      ${JSON.stringify(rubrics)}
    `;

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        score: { type: 'INTEGER' },
        feedback: { type: 'STRING' },
        criteriaGrades: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              criteriaName: { type: 'STRING' },
              maxScore: { type: 'INTEGER' },
              score: { type: 'INTEGER' },
              comment: { type: 'STRING' }
            },
            required: ['criteriaName', 'maxScore', 'score', 'comment']
          }
        },
        cpmkOutcomes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              outcome: { type: 'STRING' },
              attained: { type: 'BOOLEAN' }
            },
            required: ['outcome', 'attained']
          }
        }
      },
      required: ['score', 'feedback', 'criteriaGrades', 'cpmkOutcomes']
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.1,
      }
    });

    const text = response.text().trim();
    return JSON.parse(text);
  }
};
