# Kannada and Hindi text to review

**Status: not reviewed.** A native speaker has not checked any of this text. It was written by
AI tools, and Claude Code reworded the skill-gap templates to avoid errors such as "कामें".
Do not describe these as verified until a review is recorded here.

Reviewer: mark each row OK or write the correction. Keep `{placeholders}` unchanged.
Placeholders: `{skills}` and `{skill}` are skill names, `{dist}` and `{km}` are distances,
`{n}` is a count, `{pay}` is a rupee amount.

Reviewed by: TODO  |  Date: TODO

## 1. Job match reasons (`backend/tools/job_ranker.py`)

| Key | English | Kannada | Hindi | Review |
|---|---|---|---|---|
| skills_and_near | Matched because you have {skills} experience and it's in your area. | ನಿಮ್ಮ {skills} ಅನುಭವ ಮತ್ತು ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ಇರುವ ಕಾರಣ ಸೂಕ್ತವಾಗಿದೆ. | आपके {skills} अनुभव और यह आपके इलाके में होने के कारण यह काम उपयुक्त है। | |
| skills_and_location | Matched because you have {skills} experience and it's ~{dist} km away. | ನಿಮ್ಮ {skills} ಅನುಭವ ಮತ್ತು ಸರಿಸುಮಾರು {dist} ಕಿಮೀ ದೂರದ ಕಾರಣ ಸೂಕ್ತವಾಗಿದೆ. | आपके {skills} अनुभव और लगभग {dist} किमी दूर होने के कारण यह काम उपयुक्त है। | |
| skills_only | Matched because you have {skills} experience. | ನಿಮ್ಮ {skills} ಅನುಭವದ ಕಾರಣ ಸೂಕ್ತವಾಗಿದೆ. | आपके {skills} अनुभव के कारण यह काम उपयुक्त है। | |
| location_near | Opportunity in your area. | ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ಅವಕಾಶ. | आपके इलाके में अवसर। | |
| location_only | Nearby opportunity — ~{dist} km away. | ಹತ್ತಿರದ ಅವಕಾಶ — ಸರಿಸುಮಾರು {dist} ಕಿಮೀ ದೂರ. | पास में अवसर — लगभग {dist} किमी दूर। | |
| generic | Good match based on your profile. | ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಆಧಾರದ ಮೇಲೆ ಉತ್ತಮ ಹೊಂದಾಣಿಕೆ. | आपकी प्रोफ़ाइल के आधार पर अच्छा मिलान। | |

## 2. Skill-gap explanations (`backend/tools/skill_gap.py`)

| Key | English | Kannada | Hindi | Review |
|---|---|---|---|---|
| with pay uplift | Learning {skill} could unlock {n} more job{pl} near you, paying about ₹{pay} more per month. | {skill} ಕಲಿತರೆ ನಿಮ್ಮ ಹತ್ತಿರ {n} ಹೊಸ ಕೆಲಸದ ಅವಕಾಶ ಸಿಗಬಹುದು, ತಿಂಗಳಿಗೆ ಸುಮಾರು ₹{pay} ಹೆಚ್ಚು ಸಂಪಾದಿಸಬಹುದು. | {skill} सीखने से आपके आस-पास {n} नए काम का मौका मिल सकता है, और महीने में लगभग ₹{pay} ज़्यादा कमाई हो सकती है। | |
| without pay uplift | Learning {skill} could unlock {n} more job{pl} near you. | {skill} ಕಲಿತರೆ ನಿಮ್ಮ ಹತ್ತಿರ {n} ಹೊಸ ಕೆಲಸದ ಅವಕಾಶ ಸಿಗಬಹುದು. | {skill} सीखने से आपके आस-पास {n} नए काम का मौका मिल सकता है। | |

## 3. Follow-up questions (`backend/routers/matches.py`)

| Key | English | Kannada | Hindi | Review |
|---|---|---|---|---|
| no_area | Where in Bengaluru do you live? (e.g. Whitefield, Koramangala, Jayanagar) | ನೀವು ಬೆಂಗಳೂರಿನ ಯಾವ ಭಾಗದಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ? (ಉದಾ: ವೈಟ್‌ಫೀಲ್ಡ್, ಕೋರಮಂಗಲ, ಜಯನಗರ) | आप बेंगलुरु के किस इलाके में रहते हैं? (जैसे व्हाइटफील्ड, कोरमंगला, जयनगर) | |
| no_skills | What kind of work have you done? (e.g. cooking, security, delivery, tailoring) | ನೀವು ಯಾವ ರೀತಿಯ ಕೆಲಸ ಮಾಡಿದ್ದೀರಿ? (ಉದಾ: ಅಡುಗೆ, ಸೆಕ್ಯೂರಿಟಿ, ಡೆಲಿವರಿ, ಹೊಲಿಗೆ) | आपने किस तरह का काम किया है? (जैसे खाना बनाना, सुरक्षा, डिलीवरी, सिलाई) | |

## 4. Screen text (`frontend/src/lib/i18n.ts`)

| Key | English | Kannada | Hindi | Review |
|---|---|---|---|---|
| appName | Kelasa Mitra | ಕೆಲಸ ಮಿತ್ರ | केलस मित्र | |
| tagline | Work Friend — Find jobs near you | ಕೆಲಸದ ಸ್ನೇಹಿತ — ನಿಮ್ಮ ಹತ್ತಿರ ಕೆಲಸ ಹುಡುಕಿ | काम का दोस्त — पास में काम खोजें | |
| tapToSpeak | Tap to Speak | ಮಾತನಾಡಿ | बोलने के लिए टैप करें | |
| orType | or type below | ಅಥವಾ ಕೆಳಗೆ ಟೈಪ್ ಮಾಡಿ | या नीचे टाइप करें | |
| typeHere | Tell us about your work… | ನಿಮ್ಮ ಕೆಲಸದ ಬಗ್ಗೆ ಹೇಳಿ… | अपने काम के बारे में बताएं… | |
| listening | Listening… | ಕೇಳುತ್ತಿದ್ದೇನೆ… | सुन रहा हूँ… | |
| findJobs | Find Jobs for Me → | ಕೆಲಸ ಹುಡುಕಿ → | मेरे लिए काम खोजें → | |
| profileTitle | Your Profile | ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ | आपकी प्रोफ़ाइल | |
| skillsLabel | Skills | ಕೌಶಲ್ಯಗಳು | कौशल | |
| expLabel | Experience | ಅನುಭವ | अनुभव | |
| areaLabel | Location | ಸ್ಥಳ | स्थान | |
| langsLabel | Languages | ಭಾಷೆಗಳು | भाषाएँ | |
| noMicPermission | Microphone access denied. Please type instead. | ಮೈಕ್ ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ. | माइक्रोफ़ोन अनुमति अस्वीकार। कृपया टाइप करें। | |
| micNotSupported | Voice not supported on this browser. Please type instead. | ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ. | इस ब्राउज़र में आवाज़ समर्थित नहीं। कृपया टाइप करें। | |
| followUpHint | Tap the mic and answer, or add it to the text below. | ಮೈಕ್ ಒತ್ತಿ ಉತ್ತರಿಸಿ, ಅಥವಾ ಕೆಳಗಿನ ಪಠ್ಯಕ್ಕೆ ಸೇರಿಸಿ. | माइक दबाकर जवाब दें, या नीचे लिखे पाठ में जोड़ें। | |
| findingJobs | Finding jobs… | ಕೆಲಸ ಹುಡುಕುತ್ತಿದ್ದೇನೆ… | काम खोज रहे हैं… | |
| backToProfile | ← Profile | ← ಪ್ರೊಫೈಲ್ | ← प्रोफ़ाइल | |
| backToProfileAria | Back to profile | ಪ್ರೊಫೈಲ್‌ಗೆ ಹಿಂತಿರುಗಿ | प्रोफ़ाइल पर वापस जाएँ | |
| jobsFound | Jobs found: {n} | ಸಿಕ್ಕ ಕೆಲಸಗಳು: {n} | मिले काम: {n} | |
| nearArea | near {area} | {area} ಹತ್ತಿರ | {area} के पास | |
| savedCount | Saved: {n} | ಉಳಿಸಿದ್ದು: {n} | सहेजे गए: {n} | |
| keyboardHint | ← Arrow to skip · → Arrow to save | ← ಬಾಣದ ಕೀ: ಬಿಡಿ · → ಬಾಣದ ಕೀ: ಉಳಿಸಿ | ← तीर: छोड़ें · → तीर: सहेजें | |
| jobCardsLabel | Job cards | ಕೆಲಸದ ಕಾರ್ಡ್‌ಗಳು | काम के कार्ड | |
| skipHint | ← Skip | ← ಬಿಡಿ | ← छोड़ें | |
| saveHint | Save → | ಉಳಿಸಿ → | सहेजें → | |
| skip | Skip ✕ | ಬಿಡಿ ✕ | छोड़ें ✕ | |
| save | Save ✓ | ಉಳಿಸಿ ✓ | सहेजें ✓ | |
| skipAria | Skip this job | ಈ ಕೆಲಸ ಬಿಡಿ | यह काम छोड़ें | |
| saveAria | Save this job | ಈ ಕೆಲಸ ಉಳಿಸಿ | यह काम सहेजें | |
| allDone | All done | ಎಲ್ಲಾ ಮುಗಿಯಿತು | सब हो गया | |
| savedDoneTitle | Jobs saved: {n} | ಉಳಿಸಿದ ಕೆಲಸಗಳು: {n} | सहेजे गए काम: {n} | |
| savedDoneBody | These are sample jobs, so there is no employer to contact yet. | ಇವು ಮಾದರಿ ಕೆಲಸಗಳು, ಈಗ ಸಂಪರ್ಕಿಸಲು ಯಾವುದೇ ಉದ್ಯೋಗದಾತರಿಲ್ಲ. | ये नमूना काम हैं, इसलिए अभी संपर्क के लिए कोई नियोक्ता नहीं है। | |
| noMoreJobs | No more jobs in your area. | ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ಇನ್ನು ಕೆಲಸಗಳಿಲ್ಲ. | आपके इलाके में और काम नहीं हैं। | |
| searchAgain | Search Again | ಮತ್ತೆ ಹುಡುಕಿ | फिर से खोजें | |
| typeJob | 💼 Job | 💼 ಕೆಲಸ | 💼 काम | |
| typeApprenticeship | 🎓 Apprenticeship | 🎓 ಅಪ್ರೆಂಟಿಸ್‌ಶಿಪ್ | 🎓 अप्रेंटिसशिप | |
| inYourArea | in your area | ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ | आपके इलाके में | |
| aboutKm | ~{km} km | ಸುಮಾರು {km} ಕಿಮೀ | लगभग {km} किमी | |
| perMonth | /mo | /ತಿಂಗಳು | /माह | |
| sampleData | ⚠ Sample data — for demonstration only | ⚠ ಮಾದರಿ ಮಾಹಿತಿ — ಪ್ರದರ್ಶನಕ್ಕಾಗಿ ಮಾತ್ರ | ⚠ नमूना डेटा — केवल प्रदर्शन के लिए | |
| jobCardAria | Job card: {title} at {employer} | ಕೆಲಸದ ಕಾರ್ಡ್: {employer}, {title} | काम का कार्ड: {employer}, {title} | |
| matchScoreAria | Match score: {score}% | ಹೊಂದಾಣಿಕೆ ಅಂಕ: {score}% | मिलान स्कोर: {score}% | |
| skillGapTitle | Grow your skills | ನಿಮ್ಮ ಕೌಶಲ್ಯ ಬೆಳೆಸಿ | अपना कौशल बढ़ाएँ | |
| skillGapIntro | Learning one of these could open more jobs near you. | ಇವುಗಳಲ್ಲಿ ಒಂದನ್ನು ಕಲಿತರೆ ನಿಮ್ಮ ಹತ್ತಿರ ಹೆಚ್ಚು ಕೆಲಸ ಸಿಗಬಹುದು. | इनमें से कोई एक सीखने से आपके आस-पास ज़्यादा काम मिल सकता है। | |
| skillGapLoading | Checking which skills could help… | ಯಾವ ಕೌಶಲ್ಯ ಸಹಾಯಕವಾಗಬಹುದು ಎಂದು ನೋಡುತ್ತಿದ್ದೇನೆ… | देख रहे हैं कि कौन सा कौशल मदद कर सकता है… | |
| skillGapEmpty | No new skills to suggest right now. | ಸದ್ಯಕ್ಕೆ ಸೂಚಿಸಲು ಹೊಸ ಕೌಶಲ್ಯಗಳಿಲ್ಲ. | अभी सुझाने के लिए कोई नया कौशल नहीं है। | |
| skillGapError | Could not load skill suggestions. Your job matches are not affected. | ಕೌಶಲ್ಯ ಸಲಹೆಗಳನ್ನು ತೆರೆಯಲಾಗಲಿಲ್ಲ. ನಿಮ್ಮ ಕೆಲಸದ ಹೊಂದಾಣಿಕೆಗಳಿಗೆ ತೊಂದರೆ ಇಲ್ಲ. | कौशल के सुझाव नहीं खुल सके। आपके काम के मिलान पर इसका असर नहीं है। | |
| skillGapSample | ⚠ Sample data: job counts and pay come from sample jobs. Weeks and costs are rough estimates. | ⚠ ಮಾದರಿ ಮಾಹಿತಿ: ಕೆಲಸಗಳ ಸಂಖ್ಯೆ ಮತ್ತು ಸಂಬಳ ಮಾದರಿ ಕೆಲಸಗಳಿಂದ ಬಂದಿವೆ. ವಾರಗಳು ಮತ್ತು ವೆಚ್ಚ ಅಂದಾಜು ಮಾತ್ರ. | ⚠ नमूना डेटा: काम की संख्या और वेतन नमूना कामों से हैं। हफ़्ते और खर्च केवल अनुमान हैं। | |
| moreJobsBadge | +{n} | +{n} | +{n} | |
| moreJobsUnit | more jobs | ಹೊಸ ಕೆಲಸ | नए काम | |
| payUplift | ~₹{pay} more/month | ತಿಂಗಳಿಗೆ ಸುಮಾರು ₹{pay} ಹೆಚ್ಚು | महीने में लगभग ₹{pay} ज़्यादा | |
| stepLabel | Step {n} | ಹಂತ {n} | चरण {n} | |
| aboutWeeks | ~{n} wk | ಸುಮಾರು {n} ವಾರ | हफ़्ते: लगभग {n} | |
| aboutCost | ~₹{n} | ಸುಮಾರು ₹{n} | लगभग ₹{n} | |
| stepsEnglishOnly |  | ಹಂತಗಳು ಸದ್ಯಕ್ಕೆ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಮಾತ್ರ ಇವೆ. | चरण अभी केवल अंग्रेज़ी में हैं। | |
| showSteps | Show steps | ಹಂತಗಳನ್ನು ತೋರಿಸಿ | चरण दिखाएँ | |
| hideSteps | Hide steps | ಹಂತಗಳನ್ನು ಮರೆಮಾಡಿ | चरण छिपाएँ | |

## 5. Skill names in match reasons (`backend/tools/job_ranker.py`)

| Skill | English | Kannada | Hindi | Review |
|---|---|---|---|---|
| hotel_helper | hotel helper | ಹೋಟೆಲ್ ಹೆಲ್ಪರ್ | होटल हेल्पर | |
| cook | cooking | ಅಡುಗೆ | खाना बनाना | |
| housekeeping | housekeeping | ಹೌಸ್‌ಕೀಪಿಂಗ್ | हाउसकीपिंग | |
| security_guard | security guard | ಸೆಕ್ಯೂರಿಟಿ | सुरक्षा | |
| driver_car | car driving | ಕಾರ್ ಚಾಲನೆ | कार चलाना | |
| two_wheeler | bike riding | ಬೈಕ್ ಓಡಿಸುವಿಕೆ | बाइक चलाना | |
| delivery | delivery | ಡೆಲಿವರಿ | डिलीवरी | |
| electrician | electrical work | ವಿದ್ಯುತ್ ಕೆಲಸ | बिजली का काम | |
| plumber | plumbing | ಪ್ಲಂಬಿಂಗ್ | प्लंबिंग | |
| tailoring | tailoring | ಹೊಲಿಗೆ | सिलाई | |
| construction_helper | construction | ನಿರ್ಮಾಣ ಕೆಲಸ | निर्माण काम | |
| mason | masonry | ಗಾರೆ ಕೆಲಸ | राजमिस्त्री | |
| pos_billing | billing/POS | ಬಿಲ್ಲಿಂಗ್ | बिलिंग | |
| retail_sales | retail sales | ಮಾರಾಟ | बिक्री | |
| warehouse | warehouse packing | ಗೋದಾಮು | गोदाम | |
| data_entry | data entry | ಡೇಟಾ ಎಂಟ್ರಿ | डेटा एंट्री | |
| ac_technician | AC repair | ಎಸಿ ರಿಪೇರಿ | एसी रिपेयर | |
| mobile_repair | mobile repair | ಮೊಬೈಲ್ ರಿಪೇರಿ | मोबाइल रिपेयर | |
| painting | painting | ಪೇಂಟಿಂಗ್ | पेंटिंग | |
| welder | welding | ವೆಲ್ಡಿಂಗ್ | वेल्डिंग | |
| carpenter | carpentry | ಮರಗೆಲಸ | बढ़ईगीरी | |
| auto_driver | auto driving | ಆಟೋ ಚಾಲನೆ | ऑटो चलाना | |
| truck_driver | truck driving | ಲಾರಿ ಚಾಲನೆ | ट्रक चलाना | |
| watchman | watchman | ಕಾವಲುಗಾರ | चौकीदार | |
| barber | barbering | ಕ್ಷೌರ | बाल काटना | |
| beautician | beauty services | ಬ್ಯೂಟಿ | ब्यूटी सेवाएं | |
| gardener | gardening | ತೋಟಗಾರಿಕೆ | बागबानी | |
| babysitter | childcare | ಮಕ್ಕಳ ಆರೈಕೆ | बच्चों की देखभाल | |
| elder_care | elder care | ಹಿರಿಯರ ಆರೈಕೆ | बुजुर्ग देखभाल | |
| laundry | laundry | ಲಾಂಡ್ರಿ | कपड़े धोना | |
| factory_worker | factory work | ಕಾರ್ಖಾನೆ | फैक्ट्री काम | |
| sanitation | sanitation | ಸ್ವಚ್ಛತೆ | सफाई | |
| event_helper | event work | ಈವೆಂಟ್ | इवेंट काम | |
| gym_trainer | fitness training | ಫಿಟ್ನೆಸ್ | फिटनेस | |
| basic_english | English skills | ಇಂಗ್ಲಿಷ್ | अंग्रेजी | |
| driving_licence | driving licence | ಡ್ರೈವಿಂಗ್ ಲೈಸೆನ್ಸ್ | ड्राइविंग लाइसेंस | |
| forklift | forklift | ಫೋರ್ಕ್‌ಲಿಫ್ಟ್ | फोर्कलिफ्ट | |
| food_handler | food handling | ಆಹಾರ ಸುರಕ್ಷತೆ | खाद्य सुरक्षा | |
| swimming_pool | pool attendance | ಈಜುಕೊಳ | स्विमिंग पूल | |
| farm_worker | farm work | ಕೃಷಿ | खेती | |
| telecalling | telecalling | ಟೆಲಿಕಾಲಿಂಗ್ | टेलीकालिंग | |

## 6. Skill names in skill-gap text (`backend/data/skills.json`)

| Skill | English | Kannada | Hindi | Review |
|---|---|---|---|---|
| hotel_helper | Hotel Helper | ಹೋಟೆಲ್ ಹೆಲ್ಪರ್ | होटल हेल्पर | |
| cook | Cook | ಅಡುಗೆ | रसोइया | |
| housekeeping | Housekeeping | ಹೌಸ್‌ಕೀಪಿಂಗ್ | हाउसकीपिंग | |
| security_guard | Security Guard | ಸೆಕ್ಯೂರಿಟಿ ಗಾರ್ಡ್ | सुरक्षा गार्ड | |
| driver_car | Car Driver | ಕಾರ್ ಡ್ರೈವರ್ | कार ड्राइवर | |
| two_wheeler | Two-Wheeler Rider | ಎರಡು ಚಕ್ರದ ವಾಹನ | दोपहिया वाहन | |
| delivery | Delivery | ಡೆಲಿವರಿ | डिलीवरी | |
| electrician | Electrician | ಎಲೆಕ್ಟ್ರಿಷಿಯನ್ | इलेक्ट्रीशियन | |
| plumber | Plumber | ಪ್ಲಂಬರ್ | प्लंबर | |
| tailoring | Tailoring | ಹೊಲಿಗೆ | सिलाई | |
| construction_helper | Construction Helper | ನಿರ್ಮಾಣ ಕಾರ್ಮಿಕ | निर्माण मजदूर | |
| mason | Mason | ಮೇಸ್ತ್ರಿ | राजमिस्त्री | |
| pos_billing | POS / Billing | ಬಿಲ್ಲಿಂಗ್ | बिलिंग | |
| retail_sales | Retail Sales | ರಿಟೇಲ್ ಮಾರಾಟ | खुदरा बिक्री | |
| warehouse | Warehouse / Packing | ಗೋದಾಮು | गोदाम | |
| data_entry | Data Entry | ಡೇಟಾ ಎಂಟ್ರಿ | डेटा एंट्री | |
| ac_technician | AC Technician | ಎಸಿ ತಂತ್ರಜ್ಞ | एसी तकनीशियन | |
| mobile_repair | Mobile Repair | ಮೊಬೈಲ್ ರಿಪೇರಿ | मोबाइल रिपेयर | |
| painting | Painting | ಪೇಂಟಿಂಗ್ | पेंटिंग | |
| welder | Welder | ವೆಲ್ಡಿಂಗ್ | वेल्डर | |
| carpenter | Carpenter | ಬಡಗಿ | बढ़ई | |
| auto_driver | Auto Driver | ಆಟೋ ಚಾಲಕ | ऑटो चालक | |
| truck_driver | Truck / HMV Driver | ಲಾರಿ ಚಾಲಕ | ट्रक ड्राइवर | |
| watchman | Watchman / Night Guard | ಕಾವಲುಗಾರ | चौकीदार | |
| barber | Barber | ಕ್ಷೌರಿಕ | नाई | |
| beautician | Beautician | ಬ್ಯೂಟಿಷಿಯನ್ | ब्यूटीशियन | |
| gardener | Gardener | ತೋಟಗಾರ | माली | |
| babysitter | Babysitter / Nanny | ಮಕ್ಕಳ ಆರೈಕೆ | आया | |
| elder_care | Elder Care | ಹಿರಿಯರ ಆರೈಕೆ | बुजुर्ग देखभाल | |
| laundry | Laundry / Ironing | ಬಟ್ಟೆ ಒಗೆಯುವಿಕೆ | धोबी | |
| factory_worker | Factory Worker | ಕಾರ್ಖಾನೆ ಕಾರ್ಮಿಕ | कारखाना मजदूर | |
| farm_worker | Farm Worker | ಕೃಷಿ ಕಾರ್ಮಿಕ | खेत मजदूर | |
| telecalling | Telecalling / BPO | ಟೆಲಿಕಾಲಿಂಗ್ | टेलीकालिंग | |
| sanitation | Sanitation / Sweeping | ಸ್ವಚ್ಛತಾ ಕಾರ್ಮಿಕ | सफाई कर्मचारी | |
| event_helper | Event Helper | ಈವೆಂಟ್ ಹೆಲ್ಪರ್ | इवेंट हेल्पर | |
| gym_trainer | Gym Trainer | ಜಿಮ್ ತರಬೇತಿದಾರ | जिम ट्रेनर | |
| basic_english | Basic English | ಮೂಲ ಇಂಗ್ಲಿಷ್ | बेसिक अंग्रेजी | |
| driving_licence | Driving Licence | ಚಾಲನಾ ಪರವಾನಗಿ | ड्राइविंग लाइसेंस | |
| forklift | Forklift Operator | ಫೋರ್ಕ್‌ಲಿಫ್ಟ್ ಆಪರೇಟರ್ | फोर्कलिफ्ट ऑपरेटर | |
| food_handler | Food Handler | ಆಹಾರ ನಿರ್ವಾಹಕ | फूड हैंडलर | |
| swimming_pool | Swimming Pool Attendant | ಈಜುಕೊಳ ಸಹಾಯಕ | स्विमिंग पूल अटेंडेंट | |
