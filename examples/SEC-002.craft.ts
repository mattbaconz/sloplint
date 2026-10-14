import express from 'express';
import cors from 'cors';

const app = express();
const allowed = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);
app.use(cors({ origin: allowed, credentials: true }));
app.use(express.json());
