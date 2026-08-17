# לא חדש. חדש לגמרי.

תיק הפקה לסרטון תדמית של מחשבים מחודשים — **נוצר במלואו ב־AI, בלי מצלמה**.

| | |
|---|---|
| פורמט מאסטר | 9:16 · 1080×1920 |
| אורך | 35.0 שניות |
| שוטים | 18 |
| צילום | אין |
| גרסה | v4.0 · all‑AI |

**מקרא מקורות:** `AI` ג׳נרציה טהורה · `AI + COMP` ג׳נרציה ושכבה בעריכה · `GFX` גרפיקה

**קבצים:** `production-bible.html` — התיק המלא · `storyboard.html` — סטוריבורד ל־18 השוטים · `README.md` — הכל ב־Markdown

---

## עברית בלי מצלמה

מודלי וידאו לא יודעים לכתוב עברית. הם מייצרים צורות שנראות *כמעט* כמו אותיות, והעין הישראלית תופסת את זה בפריים אחד. זו הסיבה היחידה שבגללה מישהו היה ממליץ לצלם.

אבל הבעיה נפתרת בלי מצלמה, כי היא נשענת על עובדה פשוטה: **מודל וידאו לא ממציא מחדש את מה שכבר קיים בתמונת המקור — הוא נושא אותו קדימה.** לכן לא מתקנים את העברית בווידאו. מתקנים אותה בסטיל, ורק אז מנפישים.

| # | שלב |
|---|---|
| 01 | **מייצרים מקלדת ריקה** — בפרומפט: `blank unmarked keycaps, no letters, no symbols`. קל בהרבה להניח אותיות על מקשים חלקים מאשר להילחם באותיות לטיניות שהמודל כבר צייר. |
| 02 | **מניחים עברית אמיתית על הסטיל** — פוטושופ או Photopea (חינם). פונט אמיתי, עיוות פרספקטיבה למישור המקלדת, אטימות 85–92%, מעט טשטוש כדי שיישבו *בתוך* התמונה ולא עליה. |
| 03 | **Image‑to‑video מהסטיל המתוקן** — המודל נושא את האותיות דרך התנועה. בתנועות איטיות, וכולן כאן איטיות, זה מחזיק מצוין. |
| 04 | **ואם בכל זאת נמרח** — בקלוז־אפ של הלייזר לא לוקחים סיכון: מייצרים עם מקש ריק ומניחים את האות כשכבת טקסט ב‑After Effects או DaVinci Fusion עם planar tracking. |

### הבונוס: החריטה תיראה טוב יותר ממה שאפשר לצלם

ברגע שהאותיות הן שכבת טקסט, אפשר לחשוף אותן ב־mask wipe מסונכרן לתנועת ראש הלייזר — כל אות נדלקת בדיוק כשהקרן עוברת עליה. זו בדיוק הדרך שבה בית פוסט היה עושה את השוט הזה גם עם צילום אמיתי, ויש בה שליטה מלאה: אפשר לכוון את הקצב, להוסיף ליטוש חם סביב האות ברגע ההידלקות, ולחזור עד שזה מושלם. בצילום אמיתי מקבלים מה שיצא.

---

## למה אין ידיים בסרטון

אחרי עברית, אצבעות במאקרו הן הדבר השני שמודלי וידאו הכי נוטים לקלקל. אפשר להילחם בזה בעשרות ניסיונות, אבל עדיף לא: **ארבעת השוטים שהיו מבוססי ידיים עוצבו מחדש בלי ידיים**, וכולם יצאו טובים יותר.

| שוט | היה | עכשיו |
|---|---|---|
| 02 | ידיים בכפפות שולפות מהשקית | השקית נפתחת מעצמה, המחשב מחליק החוצה |
| 10 | אצבע לוחצת מקש אחרי מקש | גל אור עובר על המקשים משמאל לימין |
| 16 | אצבע לוחצת על כפתור ההפעלה | הכפתור נדלק מעצמו, המסך מתעורר אחריו |
| 17 | אדם מקליד ליד שולחן | המחשב פתוח על שולחן ריק, אור בוקר, אדי קפה |

> שוט 17 הרוויח הכי הרבה. "חיים" בלי אדם בפריים הוא רמז חזק יותר מאדם גנרי: הצופה ממלא את החסר בעצמו ורואה את עצמו שם.

---

## מאיפה מתחילים

### עכשיו, ב־20 דקות: פיילוט של שוט אחד

פותחים כלי text‑to‑image, מייצרים את הסטיל של **שוט 15** (המחשב הסגור על שחור), מעבירים ל‑image‑to‑video עם הפרומפט של אותו שוט, מייצרים 5 שניות.

אם זה נראה כמו פרסומת — הצינור עובד ואפשר לרוץ על כל ה־18. אם לא — מחליפים מודל ובודקים שוב.

### מה צריך

- **מודל תמונה** — Flux, Midjourney, Imagen או Seedream
- **מודל וידאו I2V** — Kling, Veo, Runway או Sora. אחד מספיק.
- **עורך תמונה** — פוטושופ, או Photopea בחינם בדפדפן
- **עורך וידאו** — DaVinci Resolve, חינם, כולל Fusion לשכבות
- **ElevenLabs** לקריינות · **Suno** או **Artlist** למוזיקה

### סדר העבודה

1. **סטילס** — לייצר את 18 תמונות המקור
2. **עברית** — להניח אותיות על הסטילס של 11, 12, 10
3. **מסכים** — להניח ממשק על הסטילס של 08, 09, 16
4. **אנימציה** — I2V לכל 18, שלוש וריאציות לכל אחד
5. **שכבות** — comp של האותיות בשוט 11 ב‑Fusion
6. **עריכה** — מונטאז׳, קול, מוזיקה, גרייד, נגזרות

### עקביות המוצר — הדבר שהכי קל לפשל בו

18 שוטים שנוצרו בנפרד יראו 18 מחשבים שונים אם לא נזהרים.

- **לנעול seed אחד** למודל התמונה ולעבוד ממנו בכל הסטילס
- **לגזור סטילס מסטילס** — שוטים 13, 14, 15 הם כולם המחשב הסגור. תמונה אחת, שלושה קרופים.
- **לכתוב תיאור מוצר קבוע** ולהדביק בכל פרומפט מילה במילה:
  `dark graphite business laptop, matte finish, thin chamfered edge, no branding`

---

## התסריט, שוט אחרי שוט

כל פרומפט מיועד להדבקה ישירה. השורה `--no` היא פרומפט שלילי. בכל שוט עם מוצר — להדביק גם את תיאור המוצר הקבוע.

### 01 · 00:00.0 · 2.0s · `AI` — הגעה

שחור מוחלט. קרן אור אחת סורקת שקית אנטי־סטטית אטומה; מבעד לניילון מסתמן מתאר של לפטופ סגור.

```
slow lateral light sweep across a sealed anti-static bag containing a
closed laptop, matte black seamless background, single hard key light
raking from frame left, deep shadows, fine plastic texture catching the
light, static camera, shallow depth of field, cinematic, 24fps
--no text, logos, hands, people, watermark
```

### 02 · 00:02.0 · 1.5s · `AI` — השקית נפתחת

השקית נפרמת לאט והמחשב מחליק החוצה על המשטח. בלי ידיים — התנועה נראית כאילו הוא משתחרר בעצמו.

```
an anti-static bag slowly opening on its own, a dark laptop sliding out
smoothly onto a matte surface, no hands, no people, macro, shallow depth
of field, single soft key light from the left, black background,
slow motion, cinematic product film
--no hands, fingers, arms, people, text, logos, watermark
```

> אם המודל מכניס יד בכל זאת — להוסיף `empty frame, object moves by itself` ולהוריד את משך הקליפ ל־3 שניות.

### 03 · 00:03.5 · 1.5s · `AI` — נחיתה על השולחן

טופ־דאון: המחשב מונח על שולחן עבודה מט. חלקיקי אבק עולים ונדלקים בקרן האור.

```
top-down view of a closed dark laptop resting on a matte workbench,
a single hard shaft of light crossing the frame, fine dust particles
drifting and catching the light, volumetric beam, slow motion,
deep shadows, cinematic industrial
--no text, logos, hands, people, clutter, watermark
```

### 04 · 00:05.0 · 1.5s · `AI` — הבורג הראשון

מאקרו קיצוני: מברג דיוק משחרר בורג. הכלי בלבד בפריים, בלי יד.

```
extreme macro of a precision screwdriver tip turning a small screw on a
dark metal panel, only the tool visible, no hands, slow single rotation,
shallow depth of field, cool rim light, black background, cinematic
--no hands, fingers, people, text, logos, watermark
```

### 05 · 00:06.5 · 1.5s · `AI` — הפאנל נפתח

גב המחשב מתרומם ונפרד. אור נשפך פנימה — מאווררים, סוללה, כבלי סרט.

```
back panel of a laptop slowly lifting away to reveal internal components,
cooling fan, battery, ribbon cables, cool light spilling into the interior,
macro lens, shallow depth of field, slow smooth vertical camera rise,
matte black background, cinematic industrial product film
--no text, logos, brand names, hands, people, watermark
```

### 06 · 00:08.0 · 1.2s · `AI` — ניקוי

מברשת אנטי־סטטית חולפת על להבי המאוורר. אבק מתפזר לתוך האור.

```
macro shot of an anti-static brush sweeping across cooling fan blades,
only the brush visible, dust particles scattering into a beam of light,
extreme close up, shallow depth of field, slow motion, dark industrial
background, cinematic
--no hands, fingers, faces, people, text, logos, watermark
```

### 07 · 00:09.2 · 1.2s · `AI` — משחה תרמית

טיפה אפורה מבריקה יורדת על ה־CPU ומתפשטת מעט. מאקרו קיצוני.

```
extreme macro of a droplet of grey thermal paste landing on a silicon
processor die and spreading slightly, syringe tip entering from above,
no hands, glossy surface reflections, shallow depth of field,
cool light, dark background, slow motion, cinematic
--no hands, fingers, people, text, logos, watermark
```

### 08 · 00:10.4 · 1.2s · `AI + COMP` — בריאות סוללה

המסך מציג קריאת בריאות סוללה. הממשק מולבש בעריכה, לא מיוצר.

```
a laptop screen glowing softly in a dark room, screen content is a plain
flat dark surface with no text, slight screen glare, macro, shallow depth
of field, cinematic, static camera
--no text, letters, numbers, ui, icons, logos, hands, people
```

> לייצר מסך **ריק** בכוונה, ואז להלביש עליו גרפיקה שאתם בונים ב־Resolve או בפיגמה: מספרים, אחוזים, בר. corner‑pin לארבע פינות המסך. כך המספרים אמיתיים וקריאים במקום ג׳יבריש.

### 09 · 00:11.6 · 1.4s · `AI + COMP` — מטריצת בדיקות

לוחות בדיקה מתחלפים על התצוגה — פאנלים בצבע מלא, מפת פיקסלים, גרפים.

> אותו סטיל של שוט 08, קרופ אחר. הלוחות המתחלפים הם אנימציה פשוטה בעורך — ריבועי צבע וגריד. לוקח עשר דקות ונראה אמיתי לגמרי, כי הוא באמת גרפיקה על מסך.

### 10 · 00:13.0 · 1.0s · `AI + COMP` — גל על המקשים

גל אור עובר על המקלדת משמאל לימין, מדליק שורה אחרי שורה. במקום אצבע שלוחצת — המקלדת עצמה מגיבה.

```
macro side angle of a laptop keyboard with blank unmarked keycaps,
a band of light travelling across the keys from left to right,
each row briefly catching the light, no hands, black background,
shallow depth of field, slow motion, cinematic
--no hands, fingers, text, letters, logos, people, watermark
```

> מקשים ריקים בכוונה — האותיות מולבשות אחר כך יחד עם שוט 12.

### 11 · 00:14.0 · 3.0s · `AI + COMP · הליבה` — החריטה

ראש הלייזר נע מעל מקש ריק. חוט עשן דקיק עולה. האות נדלקת מתחת לקרן.

```
extreme macro of a laser engraving head moving slowly above a single
blank keycap, thin orange beam touching the surface, a fine wisp of smoke
rising, tiny glowing point where the beam meets the key, dark workshop
background, strong side light, 120fps slow motion, cinematic
--no text, letters, symbols, hands, people, logos, watermark
```

> **השוט היחיד עם עבודת שכבות אמיתית.** מייצרים אותו עם מקש ריק לגמרי, ואז ב־Fusion או ב־After Effects: שכבת טקסט עם האות, planar tracking על המקש, ו־mask wipe שמסונכרן לתנועת הקרן כך שהאות נחשפת בדיוק כשהלייזר עובר. להוסיף ליטוש חם קטן שדועך אחרי ההידלקות.

### 12 · 00:17.0 · 3.0s · `AI + COMP · הליבה` — המקלדת נחשפת

נסיגה איטית. המקלדת המלאה מתגלה, כל האותיות תופסות אור.

```
slow pull back from a laptop keyboard with blank unmarked keycaps,
top-down view straightening out, soft light raking across the key surfaces,
matte black background, shallow depth of field becoming deeper,
smooth continuous motion, cinematic product film
--no text, letters, symbols, hands, people, logos, watermark
```

> כאן העברית מולבשת **על הסטיל, לפני האנימציה**: מקלידים את הפריסה בפוטושופ/פוטופיאה, מעוותים בפרספקטיבה, אטימות ‎88%‎, ואז I2V מהתמונה המתוקנת. התנועה איטית ולכן האותיות נישאות יפה. לבדוק פריים־פריים בסוף.

### 13 · 00:20.0 · 1.5s · `AI` — ליטוש

מטלית מיקרופייבר חולפת על המכסה. גל ברק נע אחריה.

```
a microfiber cloth gliding across a brushed aluminum laptop lid on its
own, no hands, a band of specular highlight sweeping across the surface
behind it, macro, matte black background, single soft key light,
slow motion, cinematic product commercial
--no hands, fingers, arms, people, text, logos, watermark
```

### 14 · 00:21.5 · 1.5s · `AI` — סגירה

המכסה נסגר בהילוך איטי. קו התפר נפגש בדיוק מוחלט.

```
laptop lid closing in extreme slow motion, precision seam line meeting,
macro side profile, brushed aluminum chamfered edge, rim light running
along the seam, black background, smooth mechanical motion, cinematic
--no text, logos, hands, people, watermark
```

### 15 · 00:23.0 · 2.0s · `AI` — שוט גיבור

המחשב הסגור מסתובב לאט על שחור. אור מקיף מצייר את הקצוות.

```
closed laptop rotating slowly on a black seamless background, orbiting
rim light tracing the chamfered edges, product commercial lighting,
deep blacks, subtle floor reflection, turntable motion, cinematic
--no text, logos, brand names, people, watermark
```

> שוט הפיילוט. אם הוא יוצא טוב — כל השאר יוצא טוב.

### 16 · 00:25.0 · 2.0s · `AI + COMP` — התעוררות

כפתור ההפעלה נדלק מעצמו. חצי שנייה אחר כך המסך מתעורר.

```
macro of a laptop power button illuminating on its own in a dark room,
soft glow spreading, then the screen waking with a faint even light,
screen content is blank, no hands, shallow depth of field,
slow push in, cinematic
--no hands, fingers, people, text, letters, ui, logos, watermark
```

> מסך האתחול והלוגו שלכם מולבשים בעריכה, כמו בשוטים 08 ו־09.

### 17 · 00:27.0 · 4.0s · `AI` — חיים

המחשב פתוח על שולחן ריק ליד חלון. אור בוקר חם, אדי קפה עולים בצד. אין אף אחד בפריים.

```
an open laptop on a clean wooden desk beside a large window, warm morning
light falling across the desk, a cup of coffee with steam rising slowly,
soft shadows, empty chair, no people, shallow depth of field,
slow gentle push in, warm domestic atmosphere, cinematic
--no people, hands, faces, text, logos, clutter, watermark
```

> הניגוד מול המעבדה הקרה הוא כל הפואנטה של השוט הזה — לכן טמפרטורת הצבע כאן חמה בהרבה מכל מה שלפניו. המקלדת העברית צריכה להיות מזוהה בפריים; אם היא רחוקה מדי, להוסיף קרופ פנימי בעריכה.

### 18 · 00:31.0 · 4.0s · `GFX` — כרטיס סיום

לוגו על שחור. מתחתיו הקו: **לא חדש. חדש לגמרי.** ומתחתיו, קטן יותר: **3 שנות אחריות · 45 יום ניסיון** וכתובת האתר.


---

## כללי אצבע לג׳נרציה

- **תנועה אחת לשוט.** "dolly in" או "orbit left" — לא שניהם.
- **אם המוצר "נמס"** — לייצר 3 שניות ולהאט בעריכה. כל שוט כאן קצר מ־3 שניות ממילא.
- **נגד ריצוד:** לייצר ב־720p ולהעלות ב־Topaz Video AI.
- **לשמור את ה־seed** של כל וריאציה מוצלחת.
- **3 וריאציות לכל שוט** = 54 קליפים. זו הסיבה שהתקציב עלה.

---

## קריינות וטקסט

רוב הצפיות יהיו מושתקות — הטקסט על המסך חייב להעביר את המסר לבדו.

| TC | קריינות | טקסט על המסך |
|---|---|---|
| 00:04.5 | "לכל מחשב שמגיע אלינו — יש עבר." | לכל מחשב יש עבר |
| 00:08.5 | "אנחנו פותחים אותו. בודקים כל רכיב. מחליפים כל מה שצריך." | בודקים כל רכיב |
| 00:15.0 | *(שקט, ואז חרישית)* "ואז חורטים בו עברית." | עברית. בלייזר. |
| 00:26.5 | "שלוש שנות אחריות. ארבעים וחמישה ימי ניסיון." | 3 שנות אחריות · 45 יום ניסיון |
| 00:31.5 | "לא חדש. חדש לגמרי." | לוגו + לא חדש. חדש לגמרי.<br>3 שנות אחריות · 45 יום ניסיון |

המספרים בקריינות כתובים במילים בכוונה — זה מה שקריין או מנוע TTS צריך לקרוא.

### ההצעה מופיעה פעמיים, וזה מכוון

3 שנות אחריות זו יותר אחריות ממה שרוב המחשבים *החדשים* מגיעים איתה, ו־45 יום ניסיון מסיר את הסיכון. שתי הטענות הן ההוכחה לקו "לא חדש. חדש לגמרי." — בלעדיהן הקו הוא סיסמה, איתן הוא הבטחה מגובה.

לכן הן עולות בשנייה 26.5 כשיש זמן לעכל, וחוזרות קטן יותר מתחת לקו המסר בכרטיס הסיום. שורת ההצעה יושבת **מתחת** לקו ולא מעליו: קודם הרעיון, אחר כך ההוכחה.

### הגדרות ElevenLabs

- Multilingual v2 ומעלה, קול גברי עמוק ורגוע
- Stability 45–55 · Similarity 75 · Style 0–15
- לא להעלות את Style — בעברית זה נשמע מלאכותי מיד
- כל שורה בקובץ נפרד

### טיפוגרפיה עברית · 1080×1920

- Heebo 800 או Assistant 700
- כותרת 92–120px · שורת משנה 48–60px
- ריווח אותיות 0 עד ‎-1%‎ בלבד
- Safe area: 250px מלמעלה, 420px מלמטה, 80px מהצדדים
- **אותו פונט משמש גם לאותיות שמולבשות על המקלדת** — כך הכל עקבי

---

## מוזיקה וסאונד

- **00:00–00:14** — מינימלי. תו בס נמוך מתמשך, פעימות דופק בודדות.
- **00:14–00:20** — כמעט דממה. רק רוורב ואמביינס. *הנפילה הזו היא מה שגורם לחריטה לעבוד.*
- **00:20–00:31** — חזרה מלאה. מלודיה נקייה, בנייה.
- **00:31–00:35** — החזקה ודעיכה על הלוגו.

```
minimal cinematic electronic, deep sustained sub bass, sparse piano
motif, precise mechanical percussion, slow build, full stop at 0:14
leaving only ambient reverb, returns at 0:20 with warm resolving
melody, no vocals, product commercial, 35 seconds, 90 bpm
```

| TC | אפקט |
|---|---|
| 00:02.0 | רשרוש ניילון |
| 00:05.0 | קליק מברג — יבש, מדויק |
| 00:06.5 | פאנל נפרד, חריקה קלה |
| 00:10.4 | ביפ דיאגנוסטיקה נקי |
| 00:13.0 | גל מקשים — צליל עולה, לא קליקים |
| 00:14.0 | הכל נעצר. רק זמזום הלייזר. |
| 00:21.5 | סגירת מכסה, קליק מגנטי |
| 00:25.0 | צליל אתחול |

רישוי: Suno ו־Udio דורשים מסלול בתשלום לשימוש מסחרי. לקמפיין ממומן, Artlist או Epidemic Sound בטוחים יותר.

---

## צבע וקצב

### תיקון צבע

- **בסיס:** שחורים שקועים (lift 2–3%), צללים קרירים בגוון טיל, קונטרסט גבוה, רוויה 80%
- **המהלך:** בין 00:14 ל־00:20 להעלות טמפרטורה ב־300–500K ולתת לכתום הלייזר להיות הצבע הרווי היחיד
- **מ־00:27:** חם ורך, כמו אור בוקר
- **בונוס בגרסת AI:** גרייד אחיד חזק הוא גם מה שמאחד 18 שוטים שנוצרו בנפרד. אל תדלגו עליו.

### קצב העריכה

- **00:00–00:14** — הקאטים מתקצרים, 2.0 ← 1.0 שניות
- **00:14–00:20** — שני שוטים בלבד, 3 שניות כל אחד
- **00:20–00:27** — קצב בינוני, 1.5–2.0
- **00:27–00:35** — שוט ארוך וכרטיס. נחיתה.
- **בלי טרנזישנים.** קאט ישר בלבד.

---

## נגזרות

| גרסה | רזולוציה | אורך | שימוש |
|---|---|---|---|
| **מאסטר** | 1080×1920 | 35 שנ׳ | Reels, TikTok, Stories |
| ווב | 1920×1080 | 35 שנ׳ | אתר הבית, יוטיוב |
| קצר | 1080×1920 | 15 שנ׳ | פרסום ממומן — שוטים 01, 05, 11, 12, 15, 18 |
| באמפר | 1080×1920 | 6 שנ׳ | פרי־רול — שוטים 11, 12, 18 |
| פיד | 1080×1080 | 35 שנ׳ | פיד אינסטגרם ופייסבוק |
| שקטה | כל הגרסאות | — | טקסט צרוב, בלי קריינות |

- H.264, 10–14 Mbps ל־1080p, AAC 320kbps
- לתייג sRGB ולא Rec.709 — פלטפורמות משטיחות את השחורים אחרת
- **ל־16:9:** לייצר את הסטילס פעמיים מאותו seed. קרופ מאנכי לרוחבי מאבד יותר מדי.

---

## לוח זמנים ועלות

| יום | מה עושים | שעות |
|---|---|---|
| 1 | 18 סטילס, כולל הלבשת עברית ומסכים | 5 |
| 2 | I2V לכל השוטים, 3 וריאציות לכל אחד | 5 |
| 3 | שכבות, עריכה, קול, מוזיקה, גרייד, נגזרות | 6 |
| | **סה״כ** | **16** |

| סעיף | עלות |
|---|---|
| מודל תמונה | $10–30 |
| קרדיטים לווידאו — 54 קליפים | $120–250 |
| ElevenLabs, חודש | $5–22 |
| מוזיקה | $10–30 |
| Photopea · DaVinci Resolve | חינם |
| **סה״כ** | **₪550–1,200** |

אין ציוד, אין רקע, אין חצובה. העלות עברה מהעולם הפיזי לקרדיטים.

---

## בקרת איכות לפני פרסום

### טכני

- [ ] **לעבור פריים־פריים על שוטים 10, 11, 12** — כל אות עברית חייבת להיות מהשכבה שלכם, לא מהמודל
- [ ] ספירת מקשים ופריסה תואמות בין שוטים
- [ ] אפס ידיים, אצבעות או אנשים בכל הסרטון
- [ ] אותו מחשב לאורך כל 18 השוטים — צבע, עובי, פינות, יחס מסך
- [ ] אין טקסט או לוגו שהמודל המציא באף פינה
- [ ] הטקסט קריא במצב מושתק
- [ ] שום טקסט לא נופל מתחת לכפתורי הממשק של הפלטפורמה
- [ ] **לצפות בטלפון** בבהירות 50%, לא במסך המחשב

### משפטי

- [ ] אין שימוש בפונט, במוזיקה או בנכס אחר של אפל, ואין רמז לקשר אליה
- [ ] המחשב בסרטון הוא ייצוג גנרי ולא דגם מזוהה של יצרן
- [ ] **3 שנות אחריות ו־45 יום ניסיון** מופיעים ככתבם בתנאי המכירה באתר
- [ ] **המילה "מחודש" מופיעה בבירור.** הצגת מחשב משומש כחדש היא הפרה של חוק הגנת הצרכן.
- [ ] הסרטון מציג המחשה ולא תיעוד. אם משתמשים בו לצד טענות על התהליך — לוודא שהתהליך אכן כזה.

---

## הדבר האחד שעדיין יכול להסגיר

לא איכות התמונה, ולא העברית — היא מטופלת בשכבה. מה שנשאר זה **חוסר עקביות בין שוטים**: מחשב שמשנה גוון, מסך שמשנה יחס, פינה שמתעגלת באמצע הסרטון. הצופה לא ידע להצביע על מה הפריע לו, אבל ירגיש שמשהו לא אמיתי.

שלושת הכללים בסעיף העקביות — seed נעול, סטילס נגזרים זה מזה, ותיאור מוצר קבוע — הם מה שמונע את זה. הם החליפו את יום הצילום בתור החלק שאסור להתרשל בו.
