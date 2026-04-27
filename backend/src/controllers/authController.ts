import { Request, Response } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';

const googleClient = new OAuth2Client();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } });
  } catch (error: any) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Missing email or password' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } });
  } catch (error: any) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const loginWithGoogle = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ success: false, error: 'Missing token' });

    const ticket = await googleClient.verifyIdToken({
      idToken,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ success: false, error: 'Invalid Google Token' });

    const { email, name } = payload;
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: { email, name: name || 'Google User', password: '' }
      });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } });
  } catch (error: any) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const loginWithApple = async (req: Request, res: Response) => {
  try {
    const { identityToken, fullName } = req.body;
    if (!identityToken) return res.status(400).json({ success: false, error: 'Missing token' });

    const appleIdTokenClaims = await appleSignin.verifyIdToken(identityToken, {
      ignoreExpiration: true,
    });
    const email = appleIdTokenClaims.email;
    if (!email) return res.status(400).json({ success: false, error: 'Invalid Apple Token' });

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const name = fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : 'Apple User';
      user = await prisma.user.create({
        data: { email, name: name || 'Apple User', password: '' }
      });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } });
  } catch (error: any) {
    console.error('Apple Auth Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
