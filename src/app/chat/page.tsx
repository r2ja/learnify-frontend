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
      <div className="w-full flex-1 flex overflow-hidden">
        <CourseChatWindow courseId={courseId || undefined} chapterId={chapterId || undefined} />
      </div>
    </MainLayout>
  );
} 