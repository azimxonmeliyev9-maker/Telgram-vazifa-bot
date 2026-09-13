/**
 * Vercel Serverless Function Route Proxy (/api/bot -> /api/webhook)
 */
import webhookHandler from './webhook.js';

export default async function botHandler(req, res) {
  return await webhookHandler(req, res);
}
