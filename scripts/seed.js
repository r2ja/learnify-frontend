const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Seeding database...');

    // Create a test admin user
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    
    const admin = await prisma.user.upsert({
      where: { email: 'admin@learnify.com' },
      update: {},
      create: {
        name: 'Admin User',
        email: 'admin@learnify.com',
        password: hashedPassword,
        role: 'ADMIN'
      }
    });
    
    console.log('Created admin user:', admin.email);

    // Create a test student user
    const student = await prisma.user.upsert({
      where: { email: 'student@learnify.com' },
      update: {},
      create: {
        name: 'Test Student',
        email: 'student@learnify.com',
        password: hashedPassword,
        role: 'STUDENT',
        learningProfile: {
          create: {
            learningStyle: 'Visual Learner',
            preferences: 'Visual learning with diagrams and charts'
          }
        }
      }
    });
    
    console.log('Created student user:', student.email);

    // Create a test course
    const course = await prisma.course.create({
      data: {
        title: 'Introduction to Machine Learning',
        description: 'Learn the fundamentals of machine learning algorithms and applications',
        imageUrl: 'https://placehold.co/600x400?text=Machine+Learning',
        category: 'Computer Science',
        chapters: 8,
        duration: '24 hours',
        level: 'Intermediate',
        syllabus: {
          chapters: [
            {
              title: 'Introduction to ML Concepts',
              content: 'Overview of machine learning types and applications'
            },
            {
              title: 'Supervised Learning',
              content: 'Classification and regression algorithms'
            },
            {
              title: 'Unsupervised Learning',
              content: 'Clustering and dimensionality reduction'
            }
          ]
        },
        students: {
          connect: { id: student.id }
        }
      }
    });
    
    console.log('Created course:', course.title);

    // Create a test assessment
    const assessment = await prisma.assessment.create({
      data: {
        title: 'ML Fundamentals Quiz',
        description: 'Test your knowledge of basic machine learning concepts',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        courseId: course.id,
        students: {
          connect: { id: student.id }
        }
      }
    });
    
    console.log('Created assessment:', assessment.title);

    // Create a test chat with messages
    const chat = await prisma.chat.create({
      data: {
        userId: student.id,
        messages: {
          create: [
            {
              content: 'Hello, I need help understanding neural networks.',
              isUser: true
            },
            {
              content: 'Neural networks are computing systems inspired by the biological neural networks in animal brains. They consist of artificial neurons that can learn from and make decisions or predictions based on data.',
              isUser: false
            }
          ]
        }
      }
    });
    
    console.log('Created chat with messages for user:', student.email);

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 