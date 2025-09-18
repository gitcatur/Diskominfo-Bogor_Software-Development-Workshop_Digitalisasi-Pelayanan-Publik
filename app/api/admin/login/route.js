import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { Admin, initializeDatabase } from "@/lib/sequelize";

let dbInitialized = false;
const initDB = async () => {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
};

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    await initDB();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: "Username dan password wajib diisi" },
        { status: 400 }
      );
    }

    const normalizedInput = String(username).trim();
    const normalizedLower = normalizedInput.toLowerCase();

    let admin = null;

    if (normalizedInput) {
      admin = await Admin.findOne({
        where: {
          username: normalizedInput,
        },
      });

      if (!admin && normalizedLower !== normalizedInput) {
        admin = await Admin.findOne({
          where: {
            username: normalizedLower,
          },
        });
      }

      if (!admin) {
        admin = await Admin.findOne({
          where: {
            email: normalizedInput,
          },
        });
      }

      if (!admin && normalizedLower !== normalizedInput) {
        admin = await Admin.findOne({
          where: {
            email: normalizedLower,
          },
        });
      }
    }

    if (!admin) {
      return NextResponse.json(
        { message: "Username atau password salah" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      return NextResponse.json(
        { message: "Username atau password salah" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      message: "Login berhasil",
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
      },
    });

    response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate, private, max-age=0, s-maxage=0"
    );

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
