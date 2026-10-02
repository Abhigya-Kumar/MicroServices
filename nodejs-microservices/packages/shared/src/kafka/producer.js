import { createKafkaClient } from "./client.js";
import { logger } from "../logger/logger.js";

export async function createProducer(clientId) {
  const kafka = createKafkaClient(clientId);

  // responsible for sending records/data to the kafka topics
  const producer = kafka.producer();

  await producer.connect();

  logger.info({ clientId }, "kafka producer connected");

  return producer;
}

export async function publishJson(producer, topic, payload, key) {
  const result = await producer.send({
    topic,
    messages: [
      {
        key: key ?? null,
        value: JSON.stringify(payload),
      },
    ],
  });

  logger.info({ topic, payload }, "Kafka event publised");

  return result;
}

export async function publishJsonSafe(producer, topic, payload, key) {
  if (!producer) {
    logger.warn({ topic }, "kafka producer is not ready");
    return;
  }

  try {
    await publishJson(producer, topic, payload, key);
  } catch (err) {
    logger.error({ err, topic }, "kafka publish failed");
  }
}
