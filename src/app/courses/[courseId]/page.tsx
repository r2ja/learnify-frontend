'use client';

import { useParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { CourseDetail } from '@/components/courses/CourseDetail';
import { ShootingStarsBackground } from '@/components/assessment/ShootingStarsBackground';

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;

  return (
    <MainLayout>
      <div className="relative min-h-screen w-full">
        <ShootingStarsBackground>
          <CourseDetail courseId={courseId} />
        </ShootingStarsBackground>
      </div>
    </MainLayout>
  );
} 