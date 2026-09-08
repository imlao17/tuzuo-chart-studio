import { NextResponse } from "next/server";
import { toAuthError } from "../../../auth-server";
import {
  deleteCloudProject,
  getCloudProject,
  updateCloudProject,
} from "../../../projects-server";

export const runtime = "edge";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const project = await getCloudProject(request, id);
    return NextResponse.json({ project });
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const project = await updateCloudProject(
      request,
      id,
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

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteCloudProject(request, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }
}
