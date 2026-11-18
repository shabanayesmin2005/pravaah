import { Kafka, logLevel } from 'kafkajs';
import { env } from '../config/env';

export const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: env.KAFKA_BROKERS.split(',').map((b) => b.trim()),
  logLevel: logLevel.NOTHING,
  retry: {
    initialRetryTime: 300,
    retries: 3,
  },
});

export async function checkKafkaHealth(): Promise<boolean> {
  const admin = kafka.admin();
  try {
    await admin.connect();
    await admin.listTopics();
    await admin.disconnect();
    return true;
  } catch {
    return false;
  }
}
