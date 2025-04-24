import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { userChapterProgressRepository } from "@/lib/models/userChapterProgressRepository";

export async function GET(
  req: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const progress = await userChapterProgressRepository.getProgress(userId, params.courseId);
    
    return NextResponse.json(progress);
  } catch (error) {
    console.error("[COURSE_PROGRESS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 