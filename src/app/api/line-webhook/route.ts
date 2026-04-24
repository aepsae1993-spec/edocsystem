import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { replyMessage, getGroupName } from '@/lib/line'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const events = body.events || []
    if (events.length === 0) return NextResponse.json('OK')

    const db = createServiceClient()

    for (const event of events) {
      // Bot เข้ากลุ่ม → บันทึก Group ID อัตโนมัติ
      if (event.type === 'join' && event.source.type === 'group') {
        const groupId = event.source.groupId
        const groupName = (await getGroupName(groupId)) || 'กลุ่มใหม่'
        await db.from('line_groups').upsert(
          { group_id: groupId, group_name: groupName, status: 'active' },
          { onConflict: 'group_id', ignoreDuplicates: true }
        )
        await replyMessage(
          event.replyToken,
          `✅ บอทเข้ากลุ่มเรียบร้อย!\n📋 Group ID: ${groupId}\n📌 ชื่อ: ${groupName}\n\nระบบบันทึกแล้ว พร้อมส่งแจ้งเตือนในกลุ่มนี้`
        )
      }

      // Auto-register จาก message ในกลุ่ม
      if (event.source?.type === 'group') {
        const gId = event.source.groupId
        const { data: existing } = await db.from('line_groups').select('group_id').eq('group_id', gId).single()
        if (!existing) {
          const gName = (await getGroupName(gId)) || 'กลุ่มใหม่ (auto)'
          await db.from('line_groups').insert({ group_id: gId, group_name: gName, status: 'active' })
        }
      }

      // รับข้อความ
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim().toLowerCase()
        const src = event.source

        if (['id', '!id', '!groupid'].includes(text)) {
          let info = '📋 ข้อมูล LINE:\n'
          if (src.type === 'group') info += `🏷 Group ID: ${src.groupId}`
          else if (src.type === 'room') info += `🏷 Room ID: ${src.roomId}`
          else info += `🏷 User ID: ${src.userId}`
          if (src.userId) info += `\n👤 User ID: ${src.userId}`
          await replyMessage(event.replyToken, info)
        }

        if (['help', '!help', 'ช่วยเหลือ'].includes(text)) {
          await replyMessage(
            event.replyToken,
            '📌 คำสั่งที่ใช้ได้:\n━━━━━━━━━━━━━━━━\n🔹 id — ดู Group ID / User ID\n🔹 help — คำสั่งทั้งหมด\n━━━━━━━━━━━━━━━━\n💡 พิมพ์ id ในแชทส่วนตัว = ดู User ID สำหรับแจ้งเตือนส่วนตัว'
          )
        }
      }

      // Follow → แสดง User ID
      if (event.type === 'follow') {
        await replyMessage(
          event.replyToken,
          `👋 สวัสดีครับ!\n\n📋 User ID ของคุณ:\n${event.source.userId}\n\n💡 แจ้ง Admin เพื่อผูก User ID นี้กับชื่อของคุณในระบบ`
        )
      }
    }

    return NextResponse.json('OK')
  } catch (e) {
    console.error('LINE webhook error:', e)
    return NextResponse.json('OK')
  }
}
