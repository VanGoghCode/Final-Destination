import { NextResponse } from "next/server";
import { getQueue, addJobToQueue, setQueue, QueuedJob } from "@/lib/db";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET() {
  try {
    const queue = await getQueue();
    return NextResponse.json(queue, { headers: corsHeaders() });
  } catch (error) {
    console.error("Queue GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch queue" },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.companyName || !body.positionTitle || !body.companyUrl || !body.jobDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders() },
      );
    }

    const newJob: QueuedJob = {
      id: body.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyName: body.companyName,
      companyUrl: body.companyUrl,
      positionTitle: body.positionTitle,
      jobDescription: body.jobDescription,
      personalDetails: body.personalDetails || "",
      status: "pending",
      progress: 0,
      addedAt: Date.now(),
      profileId: body.profileId,
      profileName: body.profileName,
      profileColor: body.profileColor,
      companyWebsite: body.companyWebsite,
      includeCoverLetter: body.includeCoverLetter || false,
    };

    const success = await addJobToQueue(newJob);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to add job (duplicate ID?)" },
        { status: 500, headers: corsHeaders() },
      );
    }

    return NextResponse.json({ success: true, job: newJob }, { headers: corsHeaders() });
  } catch (error) {
    console.error("Queue POST error:", error);
    return NextResponse.json(
      { error: "Failed to add job" },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const queue = await getQueue();
      const newQueue = queue.filter((j) => j.id !== id);
      await setQueue(newQueue);
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    } else {
      await setQueue([]);
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }
  } catch (error) {
    console.error("Queue DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete job(s)" },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json(
        { error: "Missing id or updates" },
        { status: 400, headers: corsHeaders() },
      );
    }

    const { updateJobInQueue } = await import("@/lib/db");
    const updatedJob = await updateJobInQueue(id, updates);

    if (!updatedJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ success: true, job: updatedJob }, { headers: corsHeaders() });
  } catch (error) {
    console.error("Queue PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update job" },
      { status: 500, headers: corsHeaders() },
    );
  }
}
