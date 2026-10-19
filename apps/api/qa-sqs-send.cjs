const { SQSClient, SendMessageCommand, ListQueuesCommand } = require("@aws-sdk/client-sqs");
const c = new SQSClient({ region: "ap-south-1", endpoint: "http://localhost:4566", credentials: { accessKeyId: "test", secretAccessKey: "test" } });
(async () => {
  console.log((await c.send(new ListQueuesCommand({}))).QueueUrls);
  const [url, topic, payload] = process.argv.slice(2);
  if (url) { const r = await c.send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify({ topic, payload: JSON.parse(payload) }) })); console.log("sent", r.MessageId); }
})();
