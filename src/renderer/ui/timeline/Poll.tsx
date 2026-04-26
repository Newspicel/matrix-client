import { useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { M_POLL_END, M_POLL_RESPONSE, M_POLL_START, RoomEvent } from 'matrix-js-sdk';

interface PollContent {
  'org.matrix.msc3381.poll.start'?: {
    question: { body: string } & Record<string, unknown>;
    kind: string;
    max_selections?: number;
    answers: Array<{ id: string } & Record<string, unknown>>;
  };
}

interface PollRendererProps {
  client: MatrixClient;
  roomId: string;
  startEventId: string;
  content: PollContent;
}

export function PollView({ client, roomId, startEventId, content }: PollRendererProps) {
  const start = content['org.matrix.msc3381.poll.start'];
  const [tally, setTally] = useState<Record<string, number>>({});
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    // Pull relations from the live timeline. Not the most robust approach, but
    // sufficient while we don't yet proxy through a Poll model.
    const room = client.getRoom(roomId);
    if (!room) return;
    const refresh = () => {
      const events = room.getLiveTimeline().getEvents();
      const responses: Record<string, string[]> = {};
      let end = false;
      for (const e of events) {
        const type = e.getType();
        const relates = (e.getContent() as { 'm.relates_to'?: { rel_type?: string; event_id?: string } })[
          'm.relates_to'
        ];
        if (relates?.event_id !== startEventId) continue;

        if (type === M_POLL_RESPONSE.name || type === M_POLL_RESPONSE.altName) {
          const answers = (e.getContent() as { 'org.matrix.msc3381.poll.response'?: { answers?: string[] } })[
            'org.matrix.msc3381.poll.response'
          ]?.answers;
          if (answers && answers.length > 0) {
            responses[e.getSender() ?? ''] = answers;
          }
        } else if (type === M_POLL_END.name || type === M_POLL_END.altName) {
          end = true;
        }
      }
      const counts: Record<string, number> = {};
      for (const [user, answers] of Object.entries(responses)) {
        for (const a of answers) counts[a] = (counts[a] ?? 0) + 1;
        if (user === client.getUserId()) setMyChoice(answers[0]);
      }
      setTally(counts);
      setEnded(end);
    };
    refresh();
    // Poll state is low-frequency; re-read when the room's live timeline changes.
    const onTimeline = () => refresh();
    room.on(RoomEvent.Timeline, onTimeline);
    return () => {
      room.off(RoomEvent.Timeline, onTimeline);
    };
  }, [client, roomId, startEventId]);

  async function vote(answerId: string) {
    if (ended) return;
    setMyChoice(answerId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.sendEvent as any)(roomId, M_POLL_RESPONSE.name, {
      'org.matrix.msc3381.poll.response': { answers: [answerId] },
      'm.relates_to': { rel_type: 'm.reference', event_id: startEventId },
    });
  }

  if (!start) return <em className="text-[var(--color-text-faint)]">[invalid poll]</em>;
  const total = Object.values(tally).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="my-2 border border-[var(--color-divider)] bg-[var(--color-panel)] p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">{start.question.body}</span>
        {ended && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
            Closed
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {start.answers.map((ans) => {
          const answerBody = (ans as { 'org.matrix.msc1767.text'?: string; body?: string })[
            'org.matrix.msc1767.text'
          ] ?? (ans.body as string | undefined) ?? ans.id;
          const count = tally[ans.id] ?? 0;
          const pct = Math.round((count / total) * 100);
          const mine = myChoice === ans.id;
          return (
            <li key={ans.id}>
              <button
                type="button"
                disabled={ended}
                onClick={() => vote(ans.id)}
                className={`relative w-full overflow-hidden border px-3 py-2 text-left text-sm transition-colors disabled:opacity-70 ${
                  mine
                    ? 'border-[var(--color-text-strong)] bg-[var(--color-surface)]'
                    : 'border-[var(--color-divider)] bg-[var(--color-panel-2)] hover:border-[var(--color-text-faint)]'
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--color-hover-overlay)]"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative z-10 flex justify-between">
                  <span>{answerBody}</span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
                    {count} · {pct}%
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function isPollStartType(type: string): boolean {
  return type === M_POLL_START.name || type === M_POLL_START.altName;
}
