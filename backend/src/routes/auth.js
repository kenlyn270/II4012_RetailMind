import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { queryOne, query } from "../db/database.js";

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "retailmind-secret-key";

/**
 * POST /api/auth/register
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user already exists
    const existingUser = await queryOne("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await queryOne(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    console.error("[AUTH] Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * POST /api/auth/login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await queryOne("SELECT * FROM users WHERE email = $1", [email]);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /api/auth/me
 * Validate token and return current user
 */
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await queryOne("SELECT id, name, email FROM users WHERE id = $1", [decoded.userId]);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
