# Student Grades Inquiry System

واجهة عربية RTL للاستعلام الفردي عن درجة **Semester Work فقط**. الواجهة ثابتة ويمكن نشرها عبر GitHub Pages، بينما لا تُحمّل بيانات الطلاب إلى المتصفح؛ الاستعلام يتم من خلال Supabase Edge Function باستخدام service role داخل الخادم.

## الحماية

- لا توجد درجات أو أسماء طلاب داخل `index.html` أو JavaScript العام.
- جدول `student_grades` مفعّل عليه RLS ولا توجد سياسة قراءة للزوار.
- Edge Function تتحقق من كلمة المرور، السكشن، الرقم المسلسل، والاسم بعد تطبيع العربية.
- لا يوجد حظر محاولات أو رسالة انتظار زمنية.
- الاستجابة تُرجع اسم الطالب المطابق و`Semester Work` فقط.

## إعداد Supabase

1. طبّق `supabase/migrations/001_student_grades.sql` في SQL Editor.
2. صدّر ورقة Excel إلى CSV (أو استخدم LibreOffice)، ثم شغّل محلياً:

   ```bash
   python tools/import_grades.py input.csv grades-import.sql
   ```

   راجع الملف الناتج ثم نفّذه في SQL Editor. لا ترفع `grades-import.sql` إلى مستودع عام.
3. انشر `supabase/functions/student-result/index.ts` كـ Edge Function.
4. عيّن secret باسم `MASTER_PASSWORD` وقيمته `2323` من إعدادات Edge Function. لا تضع service role key في الواجهة.
5. فعّل GitHub Pages من فرع `main` ومجلد الجذر.

## مراجعة البيانات المرفقة

الملف المرفق حُوّل محلياً إلى 618 سجلاً موزعة على 30 سكشن. الخانات الفارغة في `Semester Work` تتحول إلى صفر عند الاستيراد. الفحص الفعلي للملف وجد 36 خانة فارغة، وليس 32؛ يجب مراجعة هذا الفرق قبل رفع بيانات الإنتاج.
