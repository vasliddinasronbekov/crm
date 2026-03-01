#!/bin/bash

# --- SOZLAMALAR ---
HOST="http://127.0.0.1:8000"
# Bu test faqat superuser uchun ishlaydi
USERNAME="admin" 
# DIQQAT: Quyidagi qatorga o'zingizning superuser parolingizni yozing!
PASSWORD="FkmSzZWprJRFkmSzZWprJRqRKNcIFWakXqCFXHFGRWoFkmSzZWprJRqRFkmSzZWprJRqRKNcIFWakXqCFXHFGRWoFkmSzZWprJRqRKNcIFWakXqCFXHFGRWoKNcIFWakXqCFXHFGRWoqRKNcIFWakXqCFXHFGRWoFkmSzZWprJRqRKNcIFWakXqCFXHFGRWo"

echo "========================================="
echo " EDU API - ANALYTICS ENDPOINT TESTI"
echo "========================================="
echo ""

# 1-QADAM: Tizimga kirish va token olish
echo "--> 1/3: '$USERNAME' nomi bilan tizimga kirilmoqda..."

# `curl` orqali login so'rovini yuborib, javobni olamiz
# `python3 -c "..."` - bu JSON javobidan 'access' kalitining qiymatini ajratib olish uchun kichik skript
ACCESS_TOKEN=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}" \
  "$HOST/api/v1/student-profile/login/" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access', ''))")


# 2-QADAM: Token olinganini tekshirish
if [ -z "$ACCESS_TOKEN" ]; then
    echo ""
    echo "XATO: Tizimga kirib bo'lmadi. Login yoki parol noto'g'ri."
    echo "Iltimos, skriptdagi USERNAME va PASSWORD o'zgaruvchilarini tekshiring."
    exit 1
else
    echo "Muvaffaqiyatli! Access token olindi."
fi

echo ""

# 3-QADAM: Token bilan himoyalangan manzilga so'rov yuborish
echo "--> 2/3: Analytics ma'lumotlari so'ralmoqda..."

# `curl` orqali analytics endpoint'iga so'rov yuboramiz
# `-H "Authorization: Bearer $ACCESS_TOKEN"` - bu eng muhim qismi
# `python3 -m json.tool` - JSON javobini chiroyli formatda chiqarish uchun
curl -s -X GET \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$HOST/api/v1/super_user/analytics/" | python3 -m json.tool

echo ""
echo "--> 3/3: Test yakunlandi."
echo ""
