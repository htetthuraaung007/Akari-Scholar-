export interface PeerCommentOptions {
  classmatePost: string;
  unitTopic?: string;
  peerCount?: number; // 1, 2, or 3
}

export interface FollowUpReplyOptions {
  originalPost: string;
  interlocutorType: 'classmate' | 'instructor';
  questionText: string;
  seed?: number;
}

/**
 * Service for generating peer review comments and follow-up replies
 * calling the server proxy endpoint /api/academic/assist.
 */
export async function generatePeerComments(options: PeerCommentOptions): Promise<string> {
  const apiKey = localStorage.getItem('akari_gemini_api_key') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch('/api/academic/assist', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'generate_peer_comments',
      payload: {
        classmatePost: options.classmatePost,
        unitTopic: options.unitTopic || 'Unit Topic / Discussion Prompt',
        peerCount: options.peerCount || 3,
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  if (typeof data === 'string') return data;
  if (data.result) return data.result;
  if (data.text) return data.text;
  return JSON.stringify(data);
}

export async function generateFollowUpReply(options: FollowUpReplyOptions): Promise<string> {
  const apiKey = localStorage.getItem('akari_gemini_api_key') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch('/api/academic/assist', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'generate_followup_reply',
      payload: {
        originalPost: options.originalPost,
        interlocutorType: options.interlocutorType,
        questionText: options.questionText,
        seed: options.seed || Date.now(),
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  if (typeof data === 'string') return data;
  if (data.result) return data.result;
  if (data.text) return data.text;
  return JSON.stringify(data);
}
