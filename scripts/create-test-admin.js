import dotenv from "dotenv";
import mongoose from "mongoose";
import * as argon2 from "argon2";
import { randomBytes, randomInt } from "node:crypto";
import User from "../models/User.js";

dotenv.config({ quiet: true });

try {
  if (!process.env.ALTAS_URI) {
    throw new Error(
      "Set ALTAS_URI in your .env file before creating the test admin.",
    );
  }

  await mongoose.connect(process.env.ALTAS_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  let email = "temp.admin@example.com";
  while (await User.exists({ email })) {
    email = `temp.admin.${randomBytes(4).toString("hex")}@example.com`;
  }

  let id;
  do {
    id = String(randomInt(10000000, 100000000));
  } while (await User.exists({ id }));

  const password = `TestAdmin!${randomBytes(12).toString("base64url")}`;
  const user = await User.create({
    name: "Temporary Test Admin",
    email,
    id,
    password: await argon2.hash(password),
    role: "admin",
    verified: true,
    locked: false,
  });

  console.log("Temporary admin created. Use these credentials to log in:");
  console.log(
    JSON.stringify(
      {
        email: user.email,
        password,
        id: user.id,
        role: user.role,
        verified: user.verified,
        locked: user.locked,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const uri = process.env.ALTAS_URI;
  const message = uri
    ? error.message.split(uri).join("[MongoDB URI redacted]")
    : error.message;
  console.error(`Could not create the test admin: ${message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
