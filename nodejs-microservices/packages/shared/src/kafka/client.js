import { Kafka, logLevel } from "kafkajs";

export function createKafkaClient(clientId, config = {}) {
  const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);

  if (brokers.length === 0) {
    throw new Error("KAFKA_BROKERS are empty");
  }

  return new Kafka({
    clientId,
    brokers,
    logLevel: logLevel.ERROR,
    retry: {
      retries: 8,
    },
    ...config,
  });
}
