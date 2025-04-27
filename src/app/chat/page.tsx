'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { CourseChatWindow } from '@/components/learning/CourseChatWindow';
import { useSearchParams } from 'next/navigation';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');
  const chapterId = searchParams.get('chapterId');

  return (
    <MainLayout>
      <div className="h-screen w-full flex-1">
        <CourseChatWindow courseId={courseId || undefined} chapterId={chapterId || undefined} />
      </div>
    </MainLayout>
  );
} 