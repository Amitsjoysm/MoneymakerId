import { describe, expect, it } from 'vitest';
import { createEmailMessage } from './email-message.ts';

// No mocking here: this proves that `cloudflare:email` resolves in the Workers runtime and that the
// isolated factory builds a real EmailMessage.
describe('createEmailMessage', () => {
  it('builds a real EmailMessage with the envelope addresses', async () => {
    const raw = 'From: a@example.com\r\nTo: b@example.com\r\nSubject: Hi\r\n\r\nBody';
    const message = await createEmailMessage('a@example.com', 'b@example.com', raw);
    expect(message.from).toBe('a@example.com');
    expect(message.to).toBe('b@example.com');
  });
});
