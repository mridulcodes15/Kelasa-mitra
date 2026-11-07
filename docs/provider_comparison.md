# Provider comparison

Output of `python backend/scripts/compare_providers.py`, run 2026-11-08.

**This is the rule-based half only.** `GROQ_API_KEY` was not set, so the script's source line reads
`FALLBACK (no key)` and the "Groq skills" column is the rule-based result again. The "0 / 13"
mismatches compares the rules with themselves and says nothing about Groq. To get a real comparison,
set the key in `backend/.env` and run the script again.

```text
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
ID   Description                                Lang Fallback skills                Groq skills                    Match?  
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1    English – hotel helper, two-wheeler, White en   hotel_helper, two_wheeler      hotel_helper, two_wheeler      ✓       
2    Kannada – hotel helper, bike, Whitefield   kn   hotel_helper, two_wheeler      hotel_helper, two_wheeler      ✓       
3    Hindi – driver, car, Electronic City       hi   driver_car                     driver_car                     ✓       
4    English – tailoring, Yelahanka, multilingu en   tailoring                      tailoring                      ✓       
5    Hindi – cook/canteen, Marathahalli         hi   cook                           cook                           ✓       
6    Kannada – security guard, Jayanagar        kn   security_guard                 security_guard                 ✓       
7    GENERATED – Mixed Hinglish, electrician, H hi   electrician                    electrician                    ✓       
8    GENERATED – Kannada + English mix, houseke kn   housekeeping                   housekeeping                   ✓       
9    GENERATED – Spelling variant (whitefeild), en   delivery, two_wheeler          delivery, two_wheeler          ✓       
10   GENERATED – Hindi plumber, Koramangala, wo hi   plumber                        plumber                        ✓       
11   INFLECTION – Kannada ಹೆಲ್ಪರ್ ಇದ್ದೇನೆ (I wa kn   hotel_helper                   hotel_helper                   ✓       
12   INFLECTION – Kannada ಡ್ರೈವರ್ ಆಗಿದ್ದೆ (was  kn   driver_car                     driver_car                     ✓       
13   INFLECTION – Hindi सिलाई करती हूँ (I do st hi   tailoring                      tailoring                      ✓       
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Groq source : FALLBACK (no key)
Mismatches  : 0 / 13
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```
