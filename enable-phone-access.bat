@echo off
chcp 65001 >nul
echo ============================================
echo   פתיחת גישה ל-PriceWatch מהטלפון הנייד
echo ============================================
echo.
echo הסקריפט מוסיף חריגה בחומת האש של Windows לפורט 3777
echo (גישה רק מהרשת הביתית שלך - לא מהאינטרנט)
echo.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo ⚠️ יש להריץ כמנהלת מערכת: קליק ימני על הקובץ ^> Run as administrator
  pause
  exit /b
)
netsh advfirewall firewall delete rule name="PriceWatch" >nul 2>&1
netsh advfirewall firewall add rule name="PriceWatch" dir=in action=allow protocol=TCP localport=3777 profile=private
echo.
echo ✅ בוצע! עכשיו אפשר לגלוש מהנייד (באותו WiFi) לכתובת שמופיעה
echo    בהגדרות של PriceWatch או בחלון השרת.
echo.
echo להסרה: netsh advfirewall firewall delete rule name="PriceWatch"
pause
