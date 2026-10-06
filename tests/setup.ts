import "dotenv/config";

// Point the app's Prisma client at the test database before anything imports lib/db.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
// Never send real messages from tests.
delete process.env.RESEND_API_KEY;
delete process.env.WHATSAPP_ACCESS_TOKEN;
delete process.env.INNGEST_EVENT_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;
process.env.APP_URL = "http://test.local";
process.env.DISABLE_RATE_LIMIT = "1";
