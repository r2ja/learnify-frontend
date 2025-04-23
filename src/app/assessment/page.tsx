'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { ChatbotAssessment } from '@/components/assessment/ChatbotAssessment';
import { ShootingStarsBackground } from '@/components/assessment/ShootingStarsBackground';

export default function AssessmentPage() {
  return (
    <MainLayout showNavbar={true}>
      <div className="relative min-h-screen w-full">
        <ShootingStarsBackground>
          <ChatbotAssessment />
        </ShootingStarsBackground>
      </div>
    </MainLayout>
  );
} 