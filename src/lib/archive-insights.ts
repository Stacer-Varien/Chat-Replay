import type { Conversation, MessageAttachment, TreeMessage } from "@/lib/chatgpt-import";

export interface ArchiveAttachment extends MessageAttachment {
  conversationId: string;
  conversationTitle: string;
  nodeId: string;
  role: TreeMessage["role"];
  createTime: number | null;
}

export interface ArchiveInsights {
  conversationCount: number;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  attachmentCount: number;
  availableAttachmentCount: number;
  missingAttachmentCount: number;
  imageAttachmentCount: number;
  earliestTime: number | null;
  latestTime: number | null;
  monthlyActivity: Array<{ month: string; messages: number }>;
  longestConversations: Array<{ id: string; title: string; messageCount: number }>;
}

export function archiveAttachments(conversations: Conversation[]): ArchiveAttachment[] {
  return conversations.flatMap((conversation) =>
    Object.values(conversation.nodes).flatMap((node) =>
      node.attachments.map((attachment) => ({
        ...attachment,
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        nodeId: node.id,
        role: node.role,
        createTime: node.createTime ?? conversation.updateTime ?? conversation.createTime,
      })),
    ),
  );
}

export function getArchiveInsights(conversations: Conversation[]): ArchiveInsights {
  const messages = conversations.flatMap((conversation) => Object.values(conversation.nodes));
  const attachments = archiveAttachments(conversations);
  const datedMessages = messages
    .map((message) => message.createTime)
    .filter((time): time is number => time !== null);
  const months = new Map<string, number>();
  for (const time of datedMessages) {
    const month = new Date(time * 1000).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
    months.set(month, (months.get(month) ?? 0) + 1);
  }

  return {
    conversationCount: conversations.length,
    messageCount: messages.length,
    userMessageCount: messages.filter((message) => message.role === "user").length,
    assistantMessageCount: messages.filter((message) => message.role === "assistant").length,
    attachmentCount: attachments.length,
    availableAttachmentCount: attachments.filter((attachment) => attachment.url).length,
    missingAttachmentCount: attachments.filter((attachment) => attachment.unavailableReason).length,
    imageAttachmentCount: attachments.filter((attachment) => attachment.isImage).length,
    earliestTime: datedMessages.length ? Math.min(...datedMessages) : null,
    latestTime: datedMessages.length ? Math.max(...datedMessages) : null,
    monthlyActivity: [...months.entries()]
      .map(([month, messages]) => ({ month, messages }))
      .slice(-12),
    longestConversations: conversations
      .map((conversation) => ({
        id: conversation.id,
        title: conversation.title || "Untitled conversation",
        messageCount: Object.keys(conversation.nodes).length,
      }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 5),
  };
}
