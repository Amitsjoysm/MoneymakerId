import { describe, expect, it, vi } from 'vitest';
import { alert } from './alert.ts';

// Both senders promise never to throw. alert() must still hold if one of them ever breaks that promise,
// because a lead request must not fail over an alert.
const { sendTelegram, sendEmail } = vi.hoisted(() => ({
  sendTelegram: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock('./telegram.ts', () => ({ sendTelegram }));
vi.mock('./email.ts', () => ({ sendEmail }));

describe('alert when a sender breaks its contract', () => {
  it('reports the channel that rejected as failed and still reports the other', async () => {
    sendTelegram.mockRejectedValueOnce(new Error('unexpected'));
    sendEmail.mockResolvedValueOnce('sent');
    await expect(alert({}, { kind: 'health', summary: ['ok'] })).resolves.toEqual({
      telegram: 'failed',
      email: 'sent',
    });

    sendTelegram.mockResolvedValueOnce('sent');
    sendEmail.mockImplementationOnce(() => Promise.reject(new Error('unexpected')));
    await expect(alert({}, { kind: 'health', summary: ['ok'] })).resolves.toEqual({
      telegram: 'sent',
      email: 'failed',
    });
  });

  it('treats a synchronous throw like a rejection, and the other channel still runs', async () => {
    sendTelegram.mockImplementationOnce(() => {
      throw new Error('unexpected');
    });
    sendEmail.mockResolvedValueOnce('sent');
    await expect(alert({}, { kind: 'health', summary: ['ok'] })).resolves.toEqual({
      telegram: 'failed',
      email: 'sent',
    });
  });
});
