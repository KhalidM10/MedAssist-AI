"""
MedAssist AI — Rule-Based Triage Engine v1.0

Processing pipeline (top-down, first match wins at each escalation point):
  1. Validate & normalise inputs
  2. Pre-existing condition escalation
  3. Red flag detection  → URGENT
  4. Age-specific escalation
  5. Moderate combination rules → MODERATE
  6. Moderate single-symptom rules → MODERATE
  7. Mild classification → MILD
  8. Calculate confidence score
  9. Build structured recommendations
 10. Suggest clinic specialisations

Conservative design principle: when in doubt, escalate.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

DISCLAIMER = (
    "This is not a medical diagnosis. "
    "Please consult a qualified healthcare professional before taking any medical action. "
    "In an emergency call 999 or go to your nearest emergency room."
)

# ── Red flag rules ────────────────────────────────────────────────────────────
# (keyword_variations, human-readable condition label)
RED_FLAG_RULES: List[Tuple[List[str], str]] = [
    (
        ["chest pain", "chest tightness", "chest pressure", "chest discomfort",
         "heart pain", "pain in chest"],
        "Possible cardiac emergency",
    ),
    (
        ["difficulty breathing", "shortness of breath", "cant breathe", "can't breathe",
         "unable to breathe", "breathlessness", "laboured breathing", "breathing difficulty"],
        "Respiratory distress",
    ),
    (
        ["severe headache", "worst headache", "thunderclap headache",
         "sudden severe headache", "excruciating headache", "head feels like exploding"],
        "Possible intracranial emergency",
    ),
    (
        ["sudden vision loss", "loss of vision", "vision loss", "went blind",
         "cant see", "can't see", "blinded", "sudden blindness"],
        "Sudden vision loss — possible neurological emergency",
    ),
    (
        ["facial drooping", "face drooping", "one side face dropping",
         "face weak one side", "drooping face"],
        "Facial drooping — FAST stroke sign",
    ),
    (
        ["arm weakness", "sudden arm weakness", "arm numb suddenly",
         "one arm weak", "arm paralysis"],
        "Arm weakness — FAST stroke sign",
    ),
    (
        ["slurred speech", "speech problems", "cant speak", "can't speak",
         "difficulty speaking", "words not coming out", "speech garbled"],
        "Speech difficulty — FAST stroke sign",
    ),
    (
        ["loss of consciousness", "unconscious", "passed out", "fainted",
         "unresponsive", "collapsed", "found unconscious", "blacked out"],
        "Loss of consciousness",
    ),
    (
        ["seizure", "convulsions", "fitting", "fits", "epileptic fit",
         "shaking uncontrollably", "jerking movements"],
        "Seizure activity",
    ),
    (
        ["severe allergic reaction", "anaphylaxis", "throat swelling",
         "throat closing", "tongue swelling", "allergic shock"],
        "Anaphylaxis / severe allergic reaction",
    ),
    (
        ["coughing blood", "blood in cough", "haemoptysis", "hemoptysis",
         "coughing up blood", "blood when coughing"],
        "Haemoptysis — requires immediate evaluation",
    ),
    (
        ["vomiting blood", "blood in vomit", "throwing up blood",
         "coffee ground vomit", "haematemesis"],
        "Haematemesis — requires immediate evaluation",
    ),
    (
        ["severe abdominal pain", "excruciating stomach pain",
         "abdomen rigid", "board like abdomen", "peritonitis",
         "sudden severe stomach pain"],
        "Possible acute abdomen",
    ),
    (
        ["stiff neck with fever", "neck stiffness fever",
         "neck pain fever", "meningism", "meningitis"],
        "Possible meningitis — URGENT",
    ),
    (
        ["fever above 39.5", "temperature above 39.5", "40 degree fever",
         "41 degree fever", "42 degree fever", "hyperpyrexia",
         "very high fever 40", "temperature of 40"],
        "Hyperpyrexia — dangerously high fever",
    ),
    (
        ["severe dehydration", "no urine for hours", "not urinating",
         "sunken eyes dehydration", "deeply dehydrated"],
        "Severe dehydration",
    ),
    (
        ["stroke", "heart attack", "cardiac arrest",
         "myocardial infarction", "mi ", "ami"],
        "Cardiac / neurological emergency",
    ),
    (
        ["suicidal", "want to die", "self harm", "self-harm",
         "overdose", "harming myself"],
        "Mental health emergency — immediate support needed",
    ),
    (
        ["poisoning", "poison ingested", "toxic substance ingested",
         "overdosed on medication", "accidental poisoning"],
        "Poisoning / overdose",
    ),
    (
        ["severe burns", "burns over large area", "chemical burn",
         "electrical burn"],
        "Severe burns — emergency care required",
    ),
    (
        ["severe bleeding", "uncontrolled bleeding", "bleeding wont stop",
         "blood pouring", "haemorrhage"],
        "Uncontrolled haemorrhage",
    ),
]

# ── Moderate combination rules ────────────────────────────────────────────────
# Both group_a AND group_b must contain at least one match.
MODERATE_COMBO_RULES: List[Tuple[List[str], List[str], str]] = [
    (
        ["fever", "high temperature", "temperature", "febrile"],
        ["body aches", "muscle aches", "bodyache", "myalgia", "fatigue",
         "weakness", "chills", "sweating", "rigors"],
        "Possible influenza / viral illness",
    ),
    (
        ["fever", "high temperature", "febrile"],
        ["confusion", "confused", "disoriented", "altered consciousness",
         "not making sense", "delirious", "delirium"],
        "Fever with altered mental status — possible meningitis or sepsis",
    ),
    (
        ["cough", "persistent cough", "coughing", "dry cough", "wet cough"],
        ["fever", "high temperature", "chills", "night sweats",
         "weight loss", "blood"],
        "Possible respiratory infection — needs evaluation",
    ),
    (
        ["abdominal pain", "stomach pain", "belly pain", "tummy pain",
         "cramping", "abdominal cramps"],
        ["nausea", "vomiting", "diarrhea", "diarrhoea", "loose stool",
         "watery stool", "bloody stool", "blood in stool"],
        "Possible gastroenteritis / GI illness",
    ),
    (
        ["headache", "head pain"],
        ["light sensitivity", "photophobia", "sensitivity to light",
         "neck stiffness", "nausea vomiting", "vomiting with headache",
         "noise sensitivity"],
        "Possible migraine or meningism — monitor closely",
    ),
    (
        ["urinary pain", "burning urination", "pain urinating",
         "dysuria", "painful urination", "burning when urinating"],
        ["urinary frequency", "frequent urination", "urge to urinate",
         "blood in urine", "cloudy urine", "dark urine", "smelly urine"],
        "Possible urinary tract infection (UTI)",
    ),
    (
        ["infected wound", "wound not healing", "wound smells",
         "pus from wound", "wound red swollen", "infected cut",
         "infected sore", "wound discharge"],
        ["redness", "swelling", "pus", "fever", "warmth around wound",
         "red streaks", "smell from wound"],
        "Possible wound infection / cellulitis",
    ),
    (
        ["sore throat", "throat pain", "difficulty swallowing",
         "painful swallowing", "throat very sore"],
        ["fever", "swollen glands", "white patches throat",
         "tonsil swelling", "swollen lymph nodes"],
        "Possible streptococcal / tonsil infection",
    ),
    (
        ["rash", "skin rash", "hives", "red spots", "blistering rash"],
        ["fever", "joint pain", "fatigue", "headache", "spreading rash"],
        "Systemic illness with rash — requires evaluation",
    ),
    (
        ["ear pain", "earache", "ear ache", "pain in ear"],
        ["fever", "discharge from ear", "reduced hearing",
         "fluid from ear", "ear ringing"],
        "Possible ear infection (otitis)",
    ),
    (
        ["eye pain", "eye redness", "red eye", "sore eye"],
        ["vision changes", "discharge from eye", "light sensitivity",
         "headache", "reduced vision"],
        "Possible eye condition requiring evaluation",
    ),
    (
        ["back pain", "lower back pain", "flank pain", "loin pain"],
        ["fever", "urinary symptoms", "blood in urine",
         "painful urination", "nausea vomiting"],
        "Possible kidney infection (pyelonephritis)",
    ),
    (
        ["fever", "high temperature", "chills", "sweating", "rigors"],
        ["headache", "body aches", "fatigue", "loss of appetite",
         "joint pain", "nausea"],
        "Possible malaria or systemic infection",
    ),
    (
        ["joint pain", "joint swelling", "swollen joint",
         "arthritis", "arthralgia"],
        ["fever", "rash", "fatigue", "muscle aches"],
        "Possible infectious arthritis / rheumatic illness",
    ),
    (
        ["chest tightness", "wheezing", "wheeze"],
        ["shortness of breath", "cough", "breathlessness"],
        "Possible asthma exacerbation",
    ),
    (
        ["vaginal discharge", "abnormal discharge"],
        ["pain", "odour", "itching", "burning", "fever"],
        "Possible gynaecological infection — needs evaluation",
    ),
    (
        ["toothache", "tooth pain", "dental pain"],
        ["swelling face", "fever", "swollen jaw", "difficulty opening mouth"],
        "Possible dental abscess requiring prompt care",
    ),
]

# ── Moderate single-symptom rules ─────────────────────────────────────────────
MODERATE_SINGLE_RULES: List[Tuple[List[str], str]] = [
    (
        ["high fever", "fever above 38", "fever above 39", "temperature above 38",
         "temperature above 39", "38 degree fever", "39 degree fever"],
        "High fever requiring monitoring",
    ),
    (
        ["bloody diarrhea", "blood in stool", "bloody stool", "rectal bleeding",
         "blood when passing stool"],
        "Bloody diarrhoea / rectal bleeding",
    ),
    (
        ["jaundice", "yellow skin", "yellow eyes", "yellowing eyes",
         "yellowing skin", "skin turned yellow"],
        "Jaundice — possible hepatic / haemolytic condition",
    ),
    (
        ["suspected malaria", "malaria symptoms", "possible malaria",
         "malaria test", "dengue", "typhoid"],
        "Possible tropical infection",
    ),
    (
        ["persistent cough", "cough for weeks", "cough for months",
         "chronic cough", "cough not going away"],
        "Persistent cough — requires evaluation",
    ),
    (
        ["difficulty swallowing", "cant swallow", "can't swallow",
         "food getting stuck", "dysphagia"],
        "Dysphagia — warrants clinical evaluation",
    ),
    (
        ["blood in urine", "haematuria", "pink urine", "red urine"],
        "Haematuria — requires investigation",
    ),
    (
        ["chest infection", "pneumonia", "bronchitis",
         "lower respiratory tract infection"],
        "Lower respiratory tract infection",
    ),
    (
        ["pregnancy bleeding", "vaginal bleeding pregnancy",
         "bleeding while pregnant"],
        "Antepartum haemorrhage — urgent obstetric review",
    ),
    (
        ["extreme weight loss", "rapid weight loss", "losing weight fast",
         "unexplained weight loss", "significant weight loss"],
        "Unexplained weight loss — requires investigation",
    ),
    (
        ["palpitations", "heart racing", "heart pounding", "irregular heartbeat",
         "heart fluttering", "skipped beats"],
        "Palpitations — cardiac rhythm assessment needed",
    ),
]

# ── Pre-existing condition escalators ────────────────────────────────────────
# If patient has condition X AND any symptom from the list → escalate to URGENT
PREEXISTING_ESCALATORS: dict[str, Tuple[List[str], str]] = {
    "hypertension": (
        ["severe headache", "vision changes", "chest pain", "shortness of breath",
         "confusion", "nausea vomiting severe"],
        "Hypertension + symptoms — possible hypertensive emergency",
    ),
    "heart disease": (
        ["chest pain", "shortness of breath", "fatigue sudden",
         "leg swelling", "palpitations"],
        "Cardiac history + symptoms — possible cardiac event",
    ),
    "diabetes": (
        ["chest pain", "wound not healing", "vision changes",
         "extreme thirst", "confused", "loss of consciousness",
         "very high blood sugar", "very low blood sugar"],
        "Diabetes + symptoms — possible diabetic emergency",
    ),
    "asthma": (
        ["shortness of breath", "difficulty breathing", "chest tightness",
         "wheezing", "cant breathe", "can't breathe"],
        "Asthma + breathing difficulty — possible severe exacerbation",
    ),
    "copd": (
        ["shortness of breath", "difficulty breathing", "chest tightness",
         "increased sputum", "blue lips"],
        "COPD + symptoms — possible acute exacerbation",
    ),
    "pregnancy": (
        ["severe headache", "vision changes", "abdominal pain", "bleeding",
         "chest pain", "severe swelling", "fits", "seizure"],
        "Pregnancy + symptoms — possible obstetric emergency (pre-eclampsia / abruption)",
    ),
    "hiv": (
        ["fever", "infection", "severe weight loss", "cough", "confusion"],
        "HIV/immunocompromised + symptoms — opportunistic infection risk",
    ),
    "immunocompromised": (
        ["fever", "infection", "wound", "cough"],
        "Immunocompromised + symptoms — requires prompt evaluation",
    ),
    "sickle cell": (
        ["severe pain", "chest pain", "fever", "shortness of breath",
         "stroke symptoms"],
        "Sickle cell + symptoms — possible vaso-occlusive or acute chest crisis",
    ),
    "epilepsy": (
        ["seizure", "convulsions", "fitting"],
        "Epilepsy + active seizure — requires immediate management",
    ),
    "kidney disease": (
        ["swelling legs", "shortness of breath", "confusion",
         "reduced urine", "no urine"],
        "Kidney disease + symptoms — possible acute decompensation",
    ),
}

# ── Kenyan high malaria-risk counties ─────────────────────────────────────────
HIGH_MALARIA_RISK_COUNTIES = {
    "kisumu", "homa bay", "migori", "siaya", "nyamira",
    "mombasa", "kilifi", "kwale", "tana river", "lamu",
    "busia", "bungoma", "kakamega", "vihiga", "nyanza",
}

# ── Condition → clinic specialisations ───────────────────────────────────────
CONDITION_SPECIALIZATIONS: dict[str, List[str]] = {
    "cardiac":              ["Cardiology", "Emergency Medicine"],
    "respiratory":          ["Pulmonology", "General Practice"],
    "neurological":         ["Neurology", "Emergency Medicine"],
    "stroke":               ["Neurology", "Emergency Medicine"],
    "flu":                  ["General Practice"],
    "malaria":              ["General Practice", "Infectious Disease"],
    "uti":                  ["General Practice", "Urology"],
    "gastroenteritis":      ["Gastroenterology", "General Practice"],
    "wound infection":      ["General Practice", "Surgery"],
    "ear infection":        ["ENT", "General Practice"],
    "eye condition":        ["Ophthalmology", "General Practice"],
    "kidney infection":     ["Urology", "Internal Medicine"],
    "gynaecological":       ["Obstetrics & Gynaecology"],
    "obstetric":            ["Obstetrics & Gynaecology"],
    "paediatric":           ["Pediatrics"],
    "skin":                 ["Dermatology", "General Practice"],
    "mental health":        ["Psychiatry", "General Practice"],
    "dental":               ["Dentistry"],
    "rheumatic":            ["Rheumatology", "General Practice"],
    "weight loss":          ["Internal Medicine", "General Practice"],
    "default":              ["General Practice"],
}

# ── Recommendation templates ──────────────────────────────────────────────────
def _urgent_recs(primary_condition: str) -> dict:
    condition_lower = primary_condition.lower()

    if any(k in condition_lower for k in ["cardiac", "heart", "chest"]):
        action = (
            "Call emergency services (999) immediately or have someone drive you to the "
            "nearest emergency room. Chew an aspirin tablet (300mg) if available and not allergic."
        )
    elif any(k in condition_lower for k in ["stroke", "fast", "facial", "arm weakness", "speech"]):
        action = (
            "ACT FAST — Face drooping, Arm weakness, Speech difficulty, Time to call 999. "
            "Do not give food or water. Lay the person on their side."
        )
    elif any(k in condition_lower for k in ["respiratory", "breathing", "breathe"]):
        action = (
            "Sit upright and loosen any tight clothing. Call 999 immediately. "
            "If prescribed, use your reliever inhaler (salbutamol)."
        )
    elif any(k in condition_lower for k in ["anaphylaxis", "allergic"]):
        action = (
            "Administer adrenaline (EpiPen) if available. Call 999 immediately. "
            "Lay the person flat with legs raised unless breathing is difficult."
        )
    elif any(k in condition_lower for k in ["mental health", "suicidal"]):
        action = (
            "Stay with the person. Call the Befrienders Kenya helpline: 0800 723 253 (toll-free). "
            "If immediate danger, call 999."
        )
    elif "meningitis" in condition_lower:
        action = (
            "Go to the emergency room immediately — do not wait. "
            "Bacterial meningitis is life-threatening and requires IV antibiotics urgently."
        )
    elif "poisoning" in condition_lower or "overdose" in condition_lower:
        action = (
            "Call Poison Control or go to the emergency room now. "
            "Bring the container/substance with you. Do NOT induce vomiting unless advised."
        )
    else:
        action = (
            "Seek emergency medical care immediately. Call 999 or go to the nearest "
            "emergency room. Do not drive yourself — call for help."
        )

    return {
        "immediate_action": action,
        "home_care": [],
        "when_to_escalate": "NOW — do not delay seeking emergency care.",
        "should_book_appointment": False,
        "emergency": True,
    }


def _moderate_recs(matched_conditions: List[str]) -> dict:
    joined = " ".join(matched_conditions).lower()

    if any(k in joined for k in ["malaria", "tropical", "dengue", "typhoid"]):
        home_care = [
            "Do NOT self-medicate with anti-malarials without a confirmed Rapid Diagnostic Test (RDT).",
            "Stay well hydrated — water and oral rehydration salts (ORS sachets from chemist).",
            "Take Panadol (paracetamol) for fever — do NOT take aspirin.",
            "Rest and avoid strenuous activity.",
            "Use a mosquito net to prevent re-infection.",
        ]
        action = "Visit a clinic or chemist today for a malaria rapid diagnostic test (RDT)."
        escalate = (
            "If fever rises above 39.5°C, you cannot keep fluids down, "
            "you feel confused, or symptoms worsen rapidly."
        )
    elif any(k in joined for k in ["uti", "urinary"]):
        home_care = [
            "Drink 2–3 litres of water per day.",
            "Do not hold your urine — urinate frequently.",
            "Avoid coffee, alcohol, and spicy food until recovered.",
            "Take prescribed antibiotics for the full course — do not stop early.",
        ]
        action = "See a doctor within 24 hours for a urine test and antibiotic prescription."
        escalate = (
            "If you develop fever above 38.5°C, back or flank pain, "
            "blood in urine, or symptoms do not improve within 48 hours of antibiotics."
        )
    elif any(k in joined for k in ["gastroenteritis", "gi illness", "vomiting", "diarrhea", "diarrhoea"]):
        home_care = [
            "Rehydrate with ORS (oral rehydration salts) — available at any chemist.",
            "Take small sips frequently rather than large amounts at once.",
            "Eat bland foods — plain rice, bananas, toast — when appetite returns.",
            "Wash hands thoroughly and regularly.",
            "Avoid dairy, fatty, and spicy foods until recovered.",
        ]
        action = "See a doctor if vomiting/diarrhoea persists beyond 24 hours or you cannot keep fluids down."
        escalate = (
            "If you cannot keep any fluids down, have bloody diarrhoea, "
            "fever above 38.5°C, or symptoms persist beyond 48 hours."
        )
    elif any(k in joined for k in ["respiratory", "cough", "chest infection", "pneumonia", "bronchitis"]):
        home_care = [
            "Rest and avoid cold air and dust.",
            "Stay well hydrated — warm liquids (tea with honey, warm water with lemon).",
            "Steam inhalation can ease congestion.",
            "Take paracetamol for fever and discomfort.",
            "Do not smoke — this worsens respiratory conditions significantly.",
        ]
        action = "Book a clinic appointment within 24–48 hours for clinical examination."
        escalate = (
            "If you develop difficulty breathing, cough up blood, "
            "fever rises above 39.5°C, or symptoms worsen after 3 days."
        )
    elif any(k in joined for k in ["wound infection", "cellulitis"]):
        home_care = [
            "Keep the wound clean and covered with a sterile dressing.",
            "Do NOT squeeze pus — this can spread infection.",
            "Elevate the affected limb if swollen.",
            "Watch for red streaks spreading from the wound — this means worsening infection.",
        ]
        action = "See a doctor today — wound infections can spread rapidly and require antibiotics."
        escalate = (
            "If red streaks appear, fever develops, the wound is warm and rapidly expanding, "
            "or you feel unwell systemically."
        )
    elif any(k in joined for k in ["influenza", "viral illness", "flu"]):
        home_care = [
            "Rest — your body needs energy to fight the infection.",
            "Drink plenty of fluids: water, ORS, warm broths, and fresh fruit juice.",
            "Take Panadol (paracetamol) for fever above 38.5°C — never aspirin for flu.",
            "Monitor your temperature every 4–6 hours.",
            "Avoid contact with elderly, young children, or immunocompromised people.",
        ]
        action = "Rest at home. See a doctor if symptoms worsen or do not improve within 5 days."
        escalate = (
            "If fever rises above 39.5°C, you develop difficulty breathing, "
            "chest pain, confusion, or cannot keep fluids down."
        )
    elif any(k in joined for k in ["kidney infection", "pyelonephritis"]):
        home_care = [
            "Increase fluid intake significantly.",
            "Take prescribed antibiotics for the full course.",
            "Rest — kidney infections can cause significant fatigue.",
        ]
        action = "See a doctor today — kidney infections require antibiotics and sometimes hospitalisation."
        escalate = (
            "If you develop rigors (shaking chills), very high fever, or feel very unwell — "
            "go to emergency room."
        )
    elif any(k in joined for k in ["migraine", "meningism"]):
        home_care = [
            "Rest in a dark, quiet room.",
            "Apply a cold compress to the forehead.",
            "Take prescribed migraine medication if available.",
            "Stay hydrated.",
        ]
        action = "See a doctor within 24 hours — especially if this is your worst-ever headache."
        escalate = (
            "If headache is the worst of your life, neck becomes stiff, "
            "you develop fever, rash, or vomiting — seek emergency care immediately."
        )
    else:
        home_care = [
            "Rest and allow your body to recover.",
            "Stay well hydrated.",
            "Take paracetamol for pain or fever above 38.5°C.",
            "Monitor your symptoms and note any changes.",
        ]
        action = "Book a clinic appointment within 1–2 days for a full clinical evaluation."
        escalate = (
            "If symptoms worsen significantly, you develop a high fever above 39°C, "
            "or new serious symptoms appear."
        )

    return {
        "immediate_action": action,
        "home_care": home_care,
        "when_to_escalate": escalate,
        "should_book_appointment": True,
        "emergency": False,
    }


def _mild_recs(symptoms_norm: List[str]) -> dict:
    joined = " ".join(symptoms_norm)
    home_care = [
        "Rest and get adequate sleep.",
        "Stay well hydrated — aim for 8 glasses of water per day.",
    ]
    if any(k in joined for k in ["cold", "runny nose", "blocked nose", "sore throat"]):
        home_care += [
            "Gargle with warm salt water for throat relief.",
            "Steam inhalation to ease congestion.",
            "Vitamin C and zinc supplements may help shorten cold duration.",
        ]
    elif any(k in joined for k in ["headache"]):
        home_care += [
            "Take paracetamol or ibuprofen for headache relief.",
            "Ensure you are well hydrated — dehydration is a common headache trigger.",
            "Rest in a quiet, dimly lit room.",
        ]
    elif any(k in joined for k in ["stomach", "nausea", "indigestion"]):
        home_care += [
            "Eat small, bland meals — plain rice, toast, or bananas.",
            "Avoid spicy, fatty, or acidic foods.",
            "Peppermint tea or ginger tea may help nausea.",
        ]
    elif any(k in joined for k in ["rash", "skin", "itch"]):
        home_care += [
            "Avoid scratching to prevent secondary infection.",
            "Keep the affected area clean and moisturised.",
            "Over-the-counter antihistamine (e.g. cetirizine) may relieve itching.",
        ]
    else:
        home_care += [
            "Take over-the-counter medication for symptom relief if needed.",
            "Avoid strenuous exercise until you feel better.",
        ]

    return {
        "immediate_action": "Rest at home and monitor your symptoms.",
        "home_care": home_care,
        "when_to_escalate": (
            "If symptoms worsen, persist beyond 5 days, or you develop fever above 38.5°C, "
            "difficulty breathing, or severe pain."
        ),
        "should_book_appointment": False,
        "emergency": False,
    }


# ── Dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class TriageRecommendations:
    immediate_action: str
    home_care: List[str]
    when_to_escalate: str
    should_book_appointment: bool
    emergency: bool


@dataclass
class TriageResult:
    severity: str                         # mild | moderate | urgent
    confidence: float                     # 0.0 – 1.0
    matched_conditions: List[str]
    recommendations: TriageRecommendations
    suggested_specializations: List[str]
    disclaimer: str = DISCLAIMER
    session_id: str = ""

    def to_dict(self) -> dict:
        return {
            "severity": self.severity,
            "confidence": round(self.confidence, 2),
            "matched_conditions": self.matched_conditions,
            "recommendations": {
                "immediate_action": self.recommendations.immediate_action,
                "home_care": self.recommendations.home_care,
                "when_to_escalate": self.recommendations.when_to_escalate,
                "should_book_appointment": self.recommendations.should_book_appointment,
                "emergency": self.recommendations.emergency,
            },
            "suggested_specializations": self.suggested_specializations,
            "disclaimer": self.disclaimer,
            "session_id": self.session_id,
        }


# ── Engine ────────────────────────────────────────────────────────────────────

class TriageEngine:
    """
    Conservative rule-based triage.
    All public method parameters are plain Python types so the engine
    has zero FastAPI / SQLAlchemy dependencies and is fully unit-testable.
    """

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def analyze(
        self,
        symptoms: List[str],
        age: Optional[int] = None,
        gender: Optional[str] = None,
        duration_days: int = 1,
        pre_existing_conditions: Optional[List[str]] = None,
        county: Optional[str] = None,
    ) -> TriageResult:
        # ── Validate ──────────────────────────────────────────────────
        if not symptoms:
            return self._empty_result()

        # ── Normalise ─────────────────────────────────────────────────
        syms = self._normalise(symptoms)
        conditions = self._normalise(pre_existing_conditions or [])
        county_lower = (county or "").lower().strip()

        matched: List[str] = []

        # ── Step 1: pre-existing condition escalation ─────────────────
        prex_urgent, prex_label = self._check_preexisting(syms, conditions)
        if prex_urgent:
            matched.append(prex_label)
            recs = _urgent_recs(prex_label)
            return self._build("urgent", matched, recs,
                               self._specializations_for(matched),
                               confidence=0.91)

        # ── Step 2: red flag detection ────────────────────────────────
        red_flags = self._match_red_flags(syms)
        if red_flags:
            matched = red_flags
            primary = matched[0]
            conf = min(0.99, 0.92 + 0.02 * len(matched))
            recs = _urgent_recs(primary)
            return self._build("urgent", matched, recs,
                               self._specializations_for(matched), conf)

        # ── Step 3: age-specific escalation ──────────────────────────
        age_urgent, age_label = self._check_age_escalation(
            age, syms, duration_days
        )

        # ── Step 4: county-based malaria escalation ───────────────────
        malaria_risk = (
            county_lower in HIGH_MALARIA_RISK_COUNTIES
            and self._has_fever(syms)
        )
        if malaria_risk:
            matched.append("Malaria risk elevated — high-prevalence county with fever")

        # ── Step 5: moderate combination rules ────────────────────────
        moderate_combo = self._match_combos(syms, duration_days)

        # ── Step 6: moderate single-symptom rules ─────────────────────
        moderate_single = self._match_single_moderate(syms)

        all_moderate = moderate_combo + moderate_single + matched

        if all_moderate or age_urgent:
            if age_urgent:
                all_moderate.append(age_label)
            recs_dict = _moderate_recs(all_moderate)
            conf = self._moderate_confidence(all_moderate, syms)
            specs = self._specializations_for(all_moderate)
            return self._build("moderate", all_moderate, recs_dict, specs, conf)

        # ── Step 7: mild ──────────────────────────────────────────────
        mild_tags = self._classify_mild(syms)
        recs_dict = _mild_recs(syms)
        conf = 0.75 if mild_tags else 0.62
        return self._build("mild", mild_tags or ["Mild symptoms — no red flags detected"],
                           recs_dict,
                           self._specializations_for(mild_tags),
                           conf)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalise(items: List[str]) -> List[str]:
        """Lower-case, strip, collapse whitespace."""
        return [re.sub(r"\s+", " ", s.lower().strip()) for s in items if s]

    def _match_red_flags(self, syms: List[str]) -> List[str]:
        matched = []
        text = " ".join(syms)
        for keywords, label in RED_FLAG_RULES:
            if any(kw in text for kw in keywords):
                matched.append(label)
        return matched

    def _match_combos(self, syms: List[str], duration_days: int) -> List[str]:
        matched = []
        text = " ".join(syms)
        for group_a, group_b, label in MODERATE_COMBO_RULES:
            hit_a = any(kw in text for kw in group_a)
            hit_b = any(kw in text for kw in group_b)
            if hit_a and hit_b:
                # Duration factor: cough + fever for 3+ days → more confident
                if "persistent cough" in label.lower() and duration_days < 3:
                    continue
                matched.append(label)
        return matched

    def _match_single_moderate(self, syms: List[str]) -> List[str]:
        matched = []
        text = " ".join(syms)
        for keywords, label in MODERATE_SINGLE_RULES:
            if any(kw in text for kw in keywords):
                matched.append(label)
        return matched

    def _check_preexisting(
        self, syms: List[str], conditions: List[str]
    ) -> Tuple[bool, str]:
        if not conditions:
            return False, ""
        text = " ".join(syms)
        for cond in conditions:
            cond_lower = cond.lower()
            for key, (triggers, label) in PREEXISTING_ESCALATORS.items():
                if key in cond_lower:
                    if any(t in text for t in triggers):
                        return True, label
        return False, ""

    def _check_age_escalation(
        self, age: Optional[int], syms: List[str], duration_days: int
    ) -> Tuple[bool, str]:
        if age is None:
            return False, ""
        fever = self._has_fever(syms)
        if age < 3:
            return True, "Child under 3 years — paediatric assessment strongly recommended"
        if age < 5 and fever:
            return True, "Child under 5 with fever — always requires clinical evaluation"
        if age >= 65 and fever and duration_days >= 2:
            return True, "Patient aged 65+ with fever lasting 2+ days — higher escalation threshold"
        if age >= 65 and duration_days >= 3:
            return True, "Patient aged 65+ — earlier medical review recommended"
        return False, ""

    @staticmethod
    def _has_fever(syms: List[str]) -> bool:
        text = " ".join(syms)
        return any(k in text for k in ["fever", "high temperature", "temperature", "febrile"])

    def _classify_mild(self, syms: List[str]) -> List[str]:
        text = " ".join(syms)
        tags = []
        mild_map = [
            (["cold", "common cold"], "Common cold"),
            (["runny nose", "blocked nose", "nasal congestion", "sneezing"], "Upper respiratory tract symptoms"),
            (["sore throat", "mild sore throat"], "Mild sore throat"),
            (["mild headache", "headache"], "Mild headache"),
            (["mild stomach", "indigestion", "heartburn", "bloating"], "Mild gastrointestinal discomfort"),
            (["minor rash", "mild rash", "skin irritation"], "Minor skin irritation"),
            (["fatigue", "mild fatigue", "tired", "tiredness"], "Fatigue"),
            (["muscle ache", "mild muscle ache", "muscle pain"], "Mild muscle ache"),
            (["minor pain"], "Minor pain"),
        ]
        for keywords, tag in mild_map:
            if any(kw in text for kw in keywords):
                tags.append(tag)
        return tags

    @staticmethod
    def _moderate_confidence(matched: List[str], syms: List[str]) -> float:
        base = 0.72
        bonus = min(0.15, len(matched) * 0.04)
        # Penalty for many unmatched symptoms (uncertainty)
        unmatched = max(0, len(syms) - len(matched) * 2)
        penalty = min(0.08, unmatched * 0.02)
        return round(min(0.90, base + bonus - penalty), 2)

    def _specializations_for(self, conditions: List[str]) -> List[str]:
        text = " ".join(conditions).lower()
        found: List[str] = []
        mapping = {
            "cardiac": "cardiac",
            "heart": "cardiac",
            "chest pain": "cardiac",
            "respiratory": "respiratory",
            "breathing": "respiratory",
            "pulmonol": "respiratory",
            "stroke": "stroke",
            "neurolog": "neurological",
            "facial drooping": "stroke",
            "arm weakness": "stroke",
            "speech": "stroke",
            "flu": "flu",
            "influenza": "flu",
            "malaria": "malaria",
            "tropical": "malaria",
            "dengue": "malaria",
            "typhoid": "malaria",
            "uti": "uti",
            "urinary": "uti",
            "gastro": "gastroenteritis",
            "diarrhea": "gastroenteritis",
            "diarrhoea": "gastroenteritis",
            "vomiting": "gastroenteritis",
            "wound": "wound infection",
            "cellulitis": "wound infection",
            "ear": "ear infection",
            "eye": "eye condition",
            "kidney": "kidney infection",
            "pyelonephritis": "kidney infection",
            "gynaecolog": "gynaecological",
            "obstetric": "obstetric",
            "pregnancy": "obstetric",
            "child": "paediatric",
            "paediatric": "paediatric",
            "under 5": "paediatric",
            "under 3": "paediatric",
            "rash": "skin",
            "skin": "skin",
            "dermato": "skin",
            "mental health": "mental health",
            "suicidal": "mental health",
            "dental": "dental",
            "toothache": "dental",
            "weight loss": "weight loss",
        }
        used_keys: set[str] = set()
        for keyword, spec_key in mapping.items():
            if keyword in text and spec_key not in used_keys:
                specs = CONDITION_SPECIALIZATIONS.get(spec_key, [])
                for s in specs:
                    if s not in found:
                        found.append(s)
                used_keys.add(spec_key)
        if not found:
            found = CONDITION_SPECIALIZATIONS["default"]
        return found[:3]  # max 3 suggestions

    # ------------------------------------------------------------------
    # Builders
    # ------------------------------------------------------------------

    @staticmethod
    def _build(
        severity: str,
        matched: List[str],
        recs_dict: dict,
        specs: List[str],
        confidence: float,
    ) -> TriageResult:
        return TriageResult(
            severity=severity,
            confidence=confidence,
            matched_conditions=matched,
            recommendations=TriageRecommendations(**recs_dict),
            suggested_specializations=specs,
        )

    @staticmethod
    def _empty_result() -> TriageResult:
        """Returned when no symptoms are provided."""
        return TriageResult(
            severity="mild",
            confidence=0.50,
            matched_conditions=["No symptoms provided"],
            recommendations=TriageRecommendations(
                immediate_action="Please describe your symptoms to receive guidance.",
                home_care=["Describe what you are experiencing and re-submit."],
                when_to_escalate="At any time if you feel unwell.",
                should_book_appointment=False,
                emergency=False,
            ),
            suggested_specializations=["General Practice"],
        )
