import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export async function sendToWebhook(article) {
    const url = process.env.WEBHOOK_URL;
    if (!url || url.includes('your-unique-webhook-id')) {
        console.warn('[Webhook] No valid WEBHOOK_URL configured. Skipping send.');
        console.log('[Webhook] Payload would have been:', JSON.stringify(article, null, 2));
        return false;
    }

    try {
        console.log('[Webhook] Sending article to Make.com...');
        const response = await axios.post(url, article);
        return response.status >= 200 && response.status < 300;
    } catch (error) {
        console.error('[Webhook] Error sending to Make.com:', error.message);
        return false;
    }
}
