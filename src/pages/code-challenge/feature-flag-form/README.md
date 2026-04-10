# 🚩 Feature Flag Editor Challenge

ยินดีต้อนรับสู่บททดสอบทักษะ Frontend Developer โจทย์ของคุณคือการสร้าง **Feature Flag Editor** ที่ทรงพลังและใช้งานง่าย โดยอ้างอิงมาตรฐานจาก [GoFeatureFlag](https://gofeatureflag.org/editor)

## 🎯 How we evaluate (เราตรวจงานคุณจากอะไร?)

เราไม่ได้ดูแค่ว่าโปรเจกต์ "รันได้" หรือไม่ แต่เราให้ความสำคัญกับ **คุณภาพของงานวิศวกรรม (Engineering Quality)** ในแง่มุมต่างๆ ดังนี้:

### 1. โครงสร้างโค้ดที่อ่านง่าย (Project Structure)

ถึงแม้เราจะไม่ได้บังคับใช้ Pattern ที่ซับซ้อน แต่เรามองหาการจัดวางไฟล์ที่เป็นระเบียบ:

- **Separation of Concerns:** แยกส่วนของ UI (Components) ออกจาก Logic (Form Logic/Validation) อย่างชัดเจน
- **Scalability:** โครงสร้างที่เอื้อต่อการเพิ่มฟีเจอร์ในอนาคตได้ง่าย ไม่ปนกันมั่วซั่ว

### 2. การจัดการข้อมูลและสถานะ (State Management)

- **Efficient Form:** การใช้ `@tanstack/react-form` อย่างมีประสิทธิภาพ (เช่น การใช้ `Subscribe` เพื่อไม่ให้ Render ทั้งหน้าบ่อยเกินไป)
- **Data Integrity:** การใช้ `Zod` เพื่อควบคุมให้ข้อมูลที่ผู้ใช้กรอก "ถูกต้อง" ตาม Schema ที่เรากำหนดก่อนจะส่งออกเป็น JSON

### 3. ประสบการณ์ผู้ใช้งาน (UI/UX Foundation)

- **Real-time Feedback:** ผู้ใช้ควรเห็นการเปลี่ยนแปลงของ JSON Preview ทันทีที่แก้ไขฟอร์ม
- **Error Communication:** หากกรอกข้อมูลผิด ระบบต้องแจ้งเตือนให้ชัดเจนว่าผิดที่จุดไหนและต้องแก้ไขอย่างไร
- **Consistent Styling:** การเลือกใช้ Tailwind CSS ที่สะอาดตา และมีความสม่ำเสมอของ Spacing/Borders

### 4. ความถูกต้องของ Output

- **Schema Accuracy:** JSON ที่ส่งออกมาต้องมีโครงสร้างตรงตามข้อกำหนด (Requirements) และสามารถนำไปใช้งานต่อได้จริง

## 🛠 Tech Stack Requirements

- **Framework:** React / Next.js
- **Form:** `@tanstack/react-form`
- **Validation:** `Zod`
- **Styling:** Tailwind CSS

## 🚀 Getting Started

1. **Clone** repository นี้ลงในเครื่องของคุณ
2. สร้าง **Repository ใหม่** ของคุณเอง (Public หรือ Private ก็ได้)
3. ลงมือทำโจทย์ให้เต็มที่!
4. เมื่อเสร็จแล้ว ส่ง Link Repository ของคุณกลับมาทางอีเมล

> **Note:** หากคุณมีการตัดสินใจเชิงเทคนิค (Technical Decisions) ที่น่าสนใจ สามารถเขียนอธิบายเพิ่มเติมไว้ในไฟล์ `NOTES.md` ได้ เรายินดีที่จะอ่านวิธีคิดของคุณครับ

**Happy Coding!** ขอให้สนุกกับการแก้โจทย์ครับ ✌️
