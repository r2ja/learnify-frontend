'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { CoursesOverview } from '@/components/courses/CoursesOverview';
import { ShootingStarsBackground } from '@/components/assessment/ShootingStarsBackground';

export default function CoursesPage() {
  return (
    <MainLayout>
      <div className="relative min-h-screen w-full">
        <ShootingStarsBackground>
          <CoursesOverview />
        </ShootingStarsBackground>
      </div>
    </MainLayout>
  );
} 