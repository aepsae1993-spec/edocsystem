// LINE Messaging API helpers

const LINE_API = 'https://api.line.me/v2/bot/message'
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!

async function linePost(path: string, body: object) {
  if (!TOKEN || TOKEN === 'your_line_channel_access_token') return
  try {
    await fetch(`${LINE_API}${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.error('LINE API error:', e)
  }
}

export async function pushMessage(targetId: string, message: string) {
  await linePost('/push', { to: targetId, messages: [{ type: 'text', text: message }] })
}

export async function replyMessage(replyToken: string, message: string) {
  await linePost('/reply', { replyToken, messages: [{ type: 'text', text: message }] })
}

export async function broadcastToGroups(groupIds: string[], message: string) {
  await Promise.allSettled(groupIds.map(id => pushMessage(id, message)))
}

export async function getGroupName(groupId: string): Promise<string | null> {
  if (!TOKEN) return null
  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    })
    if (res.ok) return (await res.json()).groupName
  } catch {}
  return null
}
