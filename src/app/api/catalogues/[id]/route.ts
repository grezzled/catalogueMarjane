import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const catalogue = await prisma.catalogue.findUnique({
      where: { id },
    });

    if (!catalogue) {
      return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
    }

    return NextResponse.json(catalogue);
  } catch (error) {
    console.error("Error fetching catalogue:", error);
    return NextResponse.json(
      { error: "Failed to fetch catalogue" },
      { status: 500 }
    );
  }
}