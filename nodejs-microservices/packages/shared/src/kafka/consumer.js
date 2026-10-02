import { createKafkaClient } from "./client.js";
import { logger } from "../logger/logger.js";

export async function createConsumer(clientId, groupId) {
  const kafka = createKafkaClient(clientId);

  const consumer = kafka.consumer({ groupId });

  await consumer.connect();

  logger.info({ clientId, groupId }, "kafka consumer connected");

  return consumer;
}

// subscribe to the topic names
// start a poll
// call business handler for every/each message

// runconsumer(consumer, [topic1, topic2, topic3], async({message})=> insert task workflows)

export async function runConsumer(consumer, topics, handler, options) {
  await consumer.subscribe({
    topics,
    fromBeginning: options?.fromBeginning ?? false,
  });

  await consumer.run({
    eachMessage: async (payload) => {
      const { topic, partition, message } = payload;

      logger.info(
        {
          topic,
          partition,
          offset: message.offset,
          key: message?.key?.toString(),
        },
        "Kafka messages received",
      );

      await handler(payload);
    },
  });
}
