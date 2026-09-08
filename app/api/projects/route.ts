import { NextResponse } from "next/server";
import { toAuthError } from "../../auth-server";
import {
  createCloudProject,
  listCloudProjects,
} from "../../projects-server";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const projects = await listCloudProjects(request);
    return NextResponse.json({ projects });
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const project = await createCloudProject(
      request,
      await request.json(),
    );
    return NextResponse.json({ project });
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }
}
