# PriceWatch — תמונת ענן.
# מבוססת על תמונת Playwright הרשמית, שכוללת כבר את Chromium ואת כל
# ספריות המערכת שדפדפן רקע דורש (זה מה שמאפשר לסרוק את KSP, זאף, עולם הקולנוע ואלם).
# הגרסה חייבת להתאים ל-playwright-core שבפרויקט (כרגע 1.62.0),
# אחרת הדפדפן שבתמונה לא יתאים ותתקבל שגיאת "Executable doesn't exist".
FROM mcr.microsoft.com/playwright:v1.62.0-noble

WORKDIR /app

# התקנת התלויות קודם — שכבת Docker נפרדת שנשמרת במטמון בין פריסות
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# קוד האפליקציה
COPY . .

# הדפדפנים כבר מותקנים בתמונה הבסיסית — מפנים אליהם
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production
ENV PRICEWATCH_MODE=hosted
# מסד הנתונים נשמר בדיסק קבוע (volume) כדי שהמוצרים במעקב ישרדו פריסות
ENV PRICEWATCH_DATA_DIR=/data

EXPOSE 3777

CMD ["node", "server.js"]
