const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.local' });

// Create a PostgreSQL pool with explicit configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'frontend_app_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function main() {
  let client = null;

  try {
    console.log('Seeding database with test data...');
    console.log('Database configuration:', {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'frontend_app_db'
    });

    client = await pool.connect();

    // Start transaction
    await client.query('BEGIN');

    // --- Clean Slate (Optional but Recommended for Idempotency) ---
    // Delete in reverse order of dependency
    console.log('Clearing existing test data...');
    await client.query('DELETE FROM public."ChapterChatSession"');
    await client.query('DELETE FROM public."GeneralQueryChatSession"');
    await client.query('DELETE FROM public."QuizResponse"');
    await client.query('DELETE FROM public."QuizInstance"');
    await client.query('DELETE FROM public."ChapterPrompt"');
    await client.query('DELETE FROM public."Chapter"');
    await client.query('DELETE FROM public."CourseEnrollment"');
    await client.query('DELETE FROM public."LearningProfile"');
    // Be cautious deleting all users/courses if seed-courses runs separately
    // If this script *depends* on seed-courses, don't delete users/courses here.
    // If this script is standalone for *test* data, deleting is fine.
    // Assuming standalone test data setup for now:
    await client.query('DELETE FROM public."User"');
    await client.query('DELETE FROM public."Course"');
    console.log('Existing test data cleared.');

    // --- Create Test User ---
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const userId = uuidv4(); // text ID
    const now = new Date();

    const userResult = await client.query(
      `INSERT INTO public."User" (id, name, email, password, image, language, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE
       SET name = $2, image = $5, language = $6, "updatedAt" = $8
       RETURNING id, email`,
      [
        userId,
        'Test Student',
        'student@learnify.com',
        hashedPassword,
        null, // image
        'english', // language (default)
        now,
        now
      ]
    );
    const studentId = userResult.rows[0].id;
    console.log('Created student user:', userResult.rows[0].email);

    // --- Create Learning Profile ---
    // Using studentId as the LearningProfile ID for one-to-one mapping
    await client.query(
      `INSERT INTO public."LearningProfile" (id, "userId", "processingStyle", "perceptionStyle", "inputStyle", "understandingStyle", "assessmentDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ("userId") DO UPDATE
       SET "processingStyle" = $3, "perceptionStyle" = $4, "inputStyle" = $5, "understandingStyle" = $6, "assessmentDate" = $7, "updatedAt" = $9`,
      [
        studentId, // Use userId as profileId
        studentId,
        'Active', 'Intuitive', 'Visual', 'Sequential', // Default styles from previous version
        now, // assessmentDate
        now, // createdAt
        now // updatedAt
      ]
    );
    console.log(`Created/Updated learning profile for user: ${studentId}`);

    // --- Create a Test Course ---
    const courseId = uuidv4(); // text ID
    const courseSyllabusData = {
      chapters: [
        { title: 'Introduction to ML Concepts', content: 'Overview of machine learning types...', readings: [], exercises: 3 },
        { title: 'Supervised Learning', content: 'Classification and regression algorithms...', readings: [], exercises: 5 },
        { title: 'Unsupervised Learning', content: 'Clustering and dimensionality reduction...', readings: [], exercises: 4 }
      ]
    };

    const courseResult = await client.query(
      `INSERT INTO public."Course" (id, title, description, "imageUrl", category, chapters, level, syllabus, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, title`,
      [
        courseId,
        'Introduction to Machine Learning',
        'Learn the fundamentals of machine learning algorithms and applications.',
        'https://placehold.co/600x400?text=Machine+Learning',
        'Computer Science',
        courseSyllabusData.chapters.length, // Chapter count
        'Intermediate',
        JSON.stringify(courseSyllabusData), // Overview syllabus
        now,
        now
      ]
    );
    console.log('Created course:', courseResult.rows[0].title);

    // --- Create Chapters for the Test Course ---
    const chapterIds = [];
    for (const chapterData of courseSyllabusData.chapters) {
      const chapterId = uuidv4(); // text ID
      chapterIds.push(chapterId);
      const chapterContentJson = JSON.stringify(chapterData); // Store full details

      await client.query(
        `INSERT INTO public."Chapter" (id, "courseId", name, description, content, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          chapterId,
          courseId,
          chapterData.title, // name
          chapterData.content, // description
          chapterContentJson, // content (JSONB)
          now,
          now
        ]
      );
    }
    console.log(`Created ${chapterIds.length} chapters for course: ${courseResult.rows[0].title}`);
    const firstChapterId = chapterIds[0]; // Keep track of the first chapter ID for quiz/chat

    // --- Enroll Student in Course ---
    console.log(`Enrolling student (${studentId}) in course (${courseId})...`);
    await client.query(
      `INSERT INTO public."CourseEnrollment" ("courseId", "userId")
       VALUES ($1, $2)
       ON CONFLICT ("courseId", "userId") DO NOTHING`,
      [courseId, studentId]
    );
    console.log('Enrollment complete.');

    // --- Create a Test Quiz Instance for the First Chapter ---
    const quizInstanceId = uuidv4(); // text ID
    const quizContext = JSON.stringify({ instructions: 'Answer all questions to the best of your ability.' });
    const quizPayload = JSON.stringify([
      { question: 'What is Machine Learning?', type: 'mcq', options: ['A', 'B', 'C'], answer: 'A' },
      { question: 'What is supervised learning?', type: 'text' }
    ]);

    await client.query(
      `INSERT INTO public."QuizInstance" (id, "userId", "courseId", "chapterId", context, quiz_payload, status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        quizInstanceId,
        studentId,
        courseId,
        firstChapterId, // Link to the first chapter
        quizContext,
        quizPayload,
        'pending', // status
        now
      ]
    );
    console.log(`Created Quiz Instance for chapter ${firstChapterId}`);

    // --- Create a Test Quiz Response ---
    const quizResponseId = uuidv4(); // text ID
    const quizAnswers = JSON.stringify({ q1: 'A', q2: 'It involves learning from labeled data.' });

    await client.query(
      `INSERT INTO public."QuizResponse" (id, "quizInstanceId", "userId", answers, score, "submittedAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        quizResponseId,
        quizInstanceId,
        studentId,
        quizAnswers,
        null, // score (optional)
        now // submittedAt
      ]
    );
    console.log(`Created Quiz Response for instance ${quizInstanceId}`);

    // --- Create Test Chat Sessions ---
    const generalChatId = uuidv4();
    const chapterChatId = uuidv4();
    const sampleInputPayload = JSON.stringify({ text: 'Tell me more about ML applications.'});
    const sampleOutputPayload = JSON.stringify({ response: 'ML is used in image recognition, NLP, recommendation systems...', assets: [] });

    // General Query Chat Session
    await client.query(
      `INSERT INTO public."GeneralQueryChatSession" (id, "userId", "courseId", prompt, input_type, input_payload, output_payload, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
       [
         generalChatId,
         studentId,
         courseId,
         'What are the main applications of ML?', // prompt
         'text', // input_type
         sampleInputPayload, // input_payload
         sampleOutputPayload, // output_payload
         now
       ]
    );
    console.log(`Created General Query Chat Session: ${generalChatId}`);

    // Chapter Specific Chat Session
    await client.query(
      `INSERT INTO public."ChapterChatSession" (id, "userId", "chapterId", prompt, input_type, input_payload, output_payload, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
       [
         chapterChatId,
         studentId,
         firstChapterId,
         'Explain the first concept in more detail.', // prompt
         'text', // input_type
         sampleInputPayload, // input_payload (reused sample)
         sampleOutputPayload, // output_payload (reused sample)
         now
       ]
    );
    console.log(`Created Chapter Chat Session: ${chapterChatId} for chapter ${firstChapterId}`);

    // --- Commit Transaction ---
    await client.query('COMMIT');

    console.log('Database seeding completed successfully!');
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log('Transaction rolled back due to error.');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }
    console.error('Error seeding database:', error);
    throw error; // Re-throw error after attempting rollback
  } finally {
    if (client) {
      client.release();
      console.log('Database client released.');
    }
    await pool.end();
    console.log('Database pool closed.');
  }
}

main().catch((e) => {
    console.error("Unhandled error during seeding execution:", e);
    process.exit(1);
}); 