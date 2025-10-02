/**
 * Test to verify multiple chats per space are persisted correctly
 */

import { WebSocket } from 'ws';

const WS_URL = "ws://localhost:8787/spaces/test-multi-chat-space/ws";

let messageIdCounter = 0;
function generateId(): string {
  return `msg-${++messageIdCounter}`;
}

async function sendMessage(ws: WebSocket, method: string, params?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = generateId();
    const request = { id, method, params };

    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to ${method}`));
    }, 5000);

    const handler = (data: any) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          clearTimeout(timeout);
          ws.removeListener("message", handler);

          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.result);
          }
        }
      } catch (error) {
        // Ignore parsing errors for other messages
      }
    };

    ws.on("message", handler);
    ws.send(JSON.stringify(request));
  });
}

async function runTest() {
  console.log('Testing multiple chats per space...\n');

  const ws = new WebSocket(WS_URL);

  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", (error) => reject(error));
  });

  console.log('✓ Connected to WebSocket\n');

  try {
    // Create the space
    const space = await sendMessage(ws, "getOrCreateSpace", { name: "Multi-Chat Test Space" });
    console.log(`✓ Space created: ${space.name}\n`);

    // Create multiple chats
    const chat1 = await sendMessage(ws, "createChat", { name: "Chat 1", metadata: { order: 1 } });
    console.log(`✓ Created Chat 1: ${chat1.id} - ${chat1.name}`);

    const chat2 = await sendMessage(ws, "createChat", { name: "Chat 2", metadata: { order: 2 } });
    console.log(`✓ Created Chat 2: ${chat2.id} - ${chat2.name}`);

    const chat3 = await sendMessage(ws, "createChat", { name: "Chat 3", metadata: { order: 3 } });
    console.log(`✓ Created Chat 3: ${chat3.id} - ${chat3.name}\n`);

    // Add messages to each chat
    await sendMessage(ws, "addMessage", { chatId: chat1.id, content: "Message in chat 1", role: "user" });
    console.log(`✓ Added message to Chat 1`);

    await sendMessage(ws, "addMessage", { chatId: chat2.id, content: "Message in chat 2", role: "user" });
    console.log(`✓ Added message to Chat 2`);

    await sendMessage(ws, "addMessage", { chatId: chat3.id, content: "Message in chat 3", role: "user" });
    console.log(`✓ Added message to Chat 3\n`);

    // Retrieve all chats
    const allChats = await sendMessage(ws, "getChats");
    console.log(`✓ Retrieved ${allChats.length} chats:`);
    allChats.forEach((chat: any, index: number) => {
      console.log(`  ${index + 1}. ${chat.name} (${chat.id})`);
    });

    if (allChats.length !== 3) {
      throw new Error(`Expected 3 chats, got ${allChats.length}`);
    }

    console.log('\n✓ All chats retrieved correctly\n');

    // Verify messages in each chat
    const messages1 = await sendMessage(ws, "getMessages", { chatId: chat1.id });
    console.log(`✓ Chat 1 has ${messages1.length} message(s)`);

    const messages2 = await sendMessage(ws, "getMessages", { chatId: chat2.id });
    console.log(`✓ Chat 2 has ${messages2.length} message(s)`);

    const messages3 = await sendMessage(ws, "getMessages", { chatId: chat3.id });
    console.log(`✓ Chat 3 has ${messages3.length} message(s)`);

    if (messages1.length !== 1 || messages2.length !== 1 || messages3.length !== 1) {
      throw new Error('Messages not distributed correctly across chats');
    }

    if (messages1[0].content !== "Message in chat 1") {
      throw new Error('Chat 1 message content incorrect');
    }
    if (messages2[0].content !== "Message in chat 2") {
      throw new Error('Chat 2 message content incorrect');
    }
    if (messages3[0].content !== "Message in chat 3") {
      throw new Error('Chat 3 message content incorrect');
    }

    console.log('\n✅ SUCCESS: Multiple chats per space work correctly!');
    console.log('   - 3 chats created and persisted');
    console.log('   - Messages correctly isolated per chat');
    console.log('   - All data retrieved correctly\n');

    ws.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error instanceof Error ? error.message : error);
    ws.close();
    process.exit(1);
  }
}

runTest().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
