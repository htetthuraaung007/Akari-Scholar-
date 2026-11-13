import { executeAcademicActionWithCascade } from './geminiService';

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

export async function generatePeerComments(options: PeerCommentOptions): Promise<string> {
  const data = await executeAcademicActionWithCascade({
    action: 'generate_peer_comments',
    payload: {
      classmatePost: options.classmatePost,
      unitTopic: options.unitTopic || 'Unit Topic / Discussion Prompt',
      peerCount: options.peerCount || 3,
    },
  });

  if (typeof data === 'string') return data;
  if (data?.result) return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
  if (data?.text) return data.text;
  return JSON.stringify(data);
}

export async function generateFollowUpReply(options: FollowUpReplyOptions): Promise<string> {
  const data = await executeAcademicActionWithCascade({
    action: 'generate_followup_reply',
    payload: {
      originalPost: options.originalPost,
      interlocutorType: options.interlocutorType,
      questionText: options.questionText,
      seed: options.seed || Date.now(),
    },
  });

  if (typeof data === 'string') return data;
  if (data?.result) return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
  if (data?.text) return data.text;
  return JSON.stringify(data);
}

