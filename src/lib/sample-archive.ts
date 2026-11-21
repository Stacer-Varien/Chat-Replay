const sampleChats = [
  {
    id: "sample-hike",
    title: "Plan a Saturday hike",
    prompt: "Can you suggest a short hike for Saturday morning?",
    earlierReply: "Try the waterfall trail. Pack water and shoes with good grip.",
    reply: "Try the lookout loop. Start early and bring water, a hat, and a light jacket.",
  },
  {
    id: "sample-dinner",
    title: "Make dinner from the pantry",
    prompt: "I have chickpeas, canned tomatoes, and rice. What can I cook?",
    reply: "Simmer the chickpeas and tomatoes with garlic and cumin, then serve over rice.",
  },
  {
    id: "sample-photo",
    title: "Write a caption for a photo",
    prompt: "Write a short caption for a photo of rain on a window.",
    reply: "Rain on the glass, and a quiet moment indoors.",
  },
];

export function createSampleArchiveFile(): File {
  const conversations = sampleChats.map((chat, index) => {
    const time = Date.UTC(2026, 0, 12 - index, 9) / 1000;
    const message = (role: "user" | "assistant", text: string, create_time: number) => ({
      author: { role },
      content: { content_type: "text", parts: [text] },
      create_time,
    });
    return {
      id: chat.id,
      title: chat.title,
      create_time: time,
      update_time: time + 60,
      current_node: "reply",
      mapping: {
        prompt: {
          parent: null,
          children: chat.earlierReply ? ["earlier-reply", "reply"] : ["reply"],
          message: message("user", chat.prompt, time),
        },
        ...(chat.earlierReply && {
          "earlier-reply": {
            parent: "prompt",
            message: message("assistant", chat.earlierReply, time + 30),
          },
        }),
        reply: { parent: "prompt", message: message("assistant", chat.reply, time + 60) },
      },
    };
  });

  return new File([JSON.stringify(conversations)], "sample-archive.json", {
    type: "application/json",
  });
}
