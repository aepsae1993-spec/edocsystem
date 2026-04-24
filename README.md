# 📋 E-Document System — ระบบสารบรรณอิเล็กทรอนิกส์

Next.js + Supabase + Google Drive + LINE OA

---

## 🗂️ โครงสร้างระบบ

```
ผู้ใช้ (browser)
    ↕ Next.js on Vercel
        ↕ Supabase (ข้อมูลทั้งหมด + โลโก้)
        ↕ Google Apps Script (อัปโหลด/ดึงไฟล์ ↔ Google Drive)
        ↕ LINE Messaging API (แจ้งเตือน)
```

---

## 🚀 ขั้นตอน Setup ทั้งหมด

### 1. Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com)
2. ไปที่ **SQL Editor** แล้ว run ไฟล์ `supabase/migrations/001_init.sql`
3. ไปที่ **Settings → API** คัดลอก:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

#### อัปโหลดโลโก้โรงเรียน
1. ไปที่ **Storage → school-assets**
2. อัปโหลดไฟล์โลโก้ตั้งชื่อว่า **`logo.png`** เท่านั้น
3. ระบบจะแสดงโลโก้บนหน้า Login อัตโนมัติ

---

### 2. Google Apps Script (Drive Bridge)

1. เปิด [script.google.com](https://script.google.com) → New project
2. วางโค้ดจากไฟล์ `gas/DriveProxy.js` ทั้งหมด
3. ไปที่ **Project Settings (⚙️) → Script Properties** → Add:
   - `SECRET_KEY` = รหัสลับที่คุณตั้งเอง เช่น `my_secret_2568`
   - `DRIVE_FOLDER_ID` = ID ของ Google Drive Folder ที่จะเก็บเอกสาร
     > วิธีหา Folder ID: เปิด folder ใน Drive → URL จะเป็น `https://drive.google.com/drive/folders/XXXXX` → นั่นคือ ID
4. **Deploy → New deployment**:
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. คัดลอก URL ที่ได้ → `GAS_DRIVE_UPLOAD_URL`

---

### 3. LINE OA

1. สร้าง LINE Official Account ที่ [developers.line.biz](https://developers.line.biz)
2. สร้าง **Messaging API channel**
3. คัดลอก **Channel Access Token** → `LINE_CHANNEL_ACCESS_TOKEN`
4. ตั้ง Webhook URL เป็น: `https://your-app.vercel.app/api/line-webhook`
5. เปิด **"Use webhooks"** และปิด **"Auto-reply messages"**

#### เพิ่ม Bot เข้ากลุ่ม LINE
- เชิญ LINE OA Bot เข้ากลุ่มครู → ระบบจะบันทึก Group ID อัตโนมัติ
- พิมพ์ `id` ในแชทกับ Bot เพื่อดู User ID (ใช้ตั้งค่าการแจ้งเตือนส่วนตัว)

---

### 4. Deploy บน Vercel

#### ติดตั้ง Vercel CLI
```bash
npm i -g vercel
```

#### Clone และ Deploy
```bash
git clone <your-repo>
cd edoc-system
npm install
vercel
```

#### ตั้งค่า Environment Variables ใน Vercel Dashboard
ไปที่ Project Settings → Environment Variables แล้วเพิ่ม:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL จาก Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key จาก Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key จาก Supabase |
| `GAS_DRIVE_UPLOAD_URL` | URL จาก Google Apps Script |
| `GAS_SECRET_KEY` | รหัสลับที่ตั้งใน GAS |
| `LINE_CHANNEL_ACCESS_TOKEN` | Token จาก LINE OA |
| `CRON_SECRET` | รหัสลับสำหรับ Cron Job เช่น `cron_secret_xyz` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

#### Deploy production
```bash
vercel --prod
```

---

### 5. LINE Webhook ตั้งค่าหลัง Deploy

อัปเดต Webhook URL ใน LINE Developers Console:
```
https://your-app.vercel.app/api/line-webhook
```

---

## ⚙️ การตั้งค่าระบบใน Supabase

ไปที่ **Table Editor → settings** แล้วแก้ไขค่าต่างๆ:

| Key | ค่าตัวอย่าง | คำอธิบาย |
|-----|------------|----------|
| `SCHOOL_NAME` | `โรงเรียนมัธยมตัวอย่าง` | ชื่อโรงเรียน (แสดงใน header) |
| `DIRECTOR_LINE_USER_ID` | `Uxxxxxxxx` | LINE User ID ของ ผอ. |
| `DIRECTOR_NAME` | `ผอ.สมชาย` | ชื่อผู้อำนวยการ |
| `CLERK_LINE_USER_ID` | `Uxxxxxxxx` | LINE User ID ของธุรการ |
| `CLERK_NAME` | `คุณสมหญิง` | ชื่อธุรการ |

---

## 👥 บทบาทผู้ใช้งาน

| บทบาท | สิทธิ์ |
|--------|--------|
| **แอดมิน** | ดูทุกเอกสาร, จัดการเอกสาร/บุคลากร, ดูสรุป |
| **ธุรการ** | ลงรับเอกสาร, ส่ง ผอ., แจกจ่ายครู, ดูสรุป |
| **ผู้อำนวยการ** | ลงนามอนุมัติเอกสาร, ติดตามสถานะ |
| **ครู/บุคลากร** | ดูเอกสาร, รับทราบ, แจ้งเสร็จสิ้น |

---

## 🔔 ระบบแจ้งเตือน LINE

- **ธุรการส่ง ผอ.** → แจ้งทุกกลุ่ม + แจ้ง ผอ. ส่วนตัว
- **ผอ. อนุมัติ** → แจ้งทุกกลุ่ม + แจ้งธุรการส่วนตัว
- **แจกจ่ายครู** → แจ้งทุกกลุ่ม + แจ้งครูส่วนตัวทุกคน
- **Cron ทุก 6 ชม.** → แจ้งเอกสารค้างเกิน 24 ชม.
- **เอกสารด่วน** → แจ้งซ้ำทุก 2 ชม. จนกว่าครูจะดำเนินการ (ตั้งค่าใน vercel.json)

---

## 🛠️ Development

```bash
npm install
cp .env.local.example .env.local
# แก้ไขค่าใน .env.local
npm run dev
```

เปิดที่ http://localhost:3000

---

## 📦 Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Google Drive (ผ่าน GAS)
- **Logo Storage**: Supabase Storage
- **Notifications**: LINE Messaging API
- **Hosting**: Vercel
- **Canvas/PDF**: Fabric.js + PDF.js + jsPDF
