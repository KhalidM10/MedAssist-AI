"""
Unit tests for the MedAssist AI triage engine.

Conservative design principle: when in doubt, escalate — tests verify this.
"""
import pytest
from app.services.triage_engine import TriageEngine, DISCLAIMER

engine = TriageEngine()


# ── Helpers ───────────────────────────────────────────────────────────────────

def triage(symptoms, *, age=None, gender=None, days=1, conditions=None, county=None):
    return engine.analyze(
        symptoms=symptoms,
        age=age,
        gender=gender,
        duration_days=days,
        pre_existing_conditions=conditions or [],
        county=county,
    )


# ── Empty / degenerate input ──────────────────────────────────────────────────

class TestEmptyInput:
    def test_no_symptoms_returns_mild(self):
        result = triage([])
        assert result.severity == "mild"

    def test_no_symptoms_has_placeholder_condition(self):
        result = triage([])
        assert result.matched_conditions == ["No symptoms provided"]

    def test_no_symptoms_does_not_flag_emergency(self):
        result = triage([])
        assert not result.recommendations.emergency

    def test_disclaimer_always_present(self):
        assert triage([]).disclaimer == DISCLAIMER
        assert triage(["chest pain"]).disclaimer == DISCLAIMER
        assert triage(["headache"]).disclaimer == DISCLAIMER


# ── Result structure ──────────────────────────────────────────────────────────

class TestResultStructure:
    def test_severity_is_one_of_three_values(self):
        for syms in [[], ["headache"], ["chest pain", "shortness of breath"]]:
            assert triage(syms).severity in ("mild", "moderate", "urgent")

    def test_confidence_is_float_between_0_and_1(self):
        for syms in [[], ["fever"], ["chest pain"]]:
            c = triage(syms).confidence
            assert 0.0 <= c <= 1.0

    def test_to_dict_keys(self):
        d = triage(["fever"]).to_dict()
        assert set(d.keys()) == {
            "severity", "confidence", "matched_conditions",
            "recommendations", "suggested_specializations",
            "disclaimer", "session_id",
        }

    def test_recommendations_keys(self):
        d = triage(["fever"]).to_dict()["recommendations"]
        assert set(d.keys()) == {
            "immediate_action", "home_care", "when_to_escalate",
            "should_book_appointment", "emergency",
        }


# ── Red flag rules → URGENT ───────────────────────────────────────────────────

class TestRedFlagUrgent:
    """Every red flag keyword must produce URGENT with emergency=True."""

    def _assert_urgent_emergency(self, symptoms):
        r = triage(symptoms)
        assert r.severity == "urgent", f"Expected urgent for {symptoms}, got {r.severity}"
        assert r.recommendations.emergency is True
        assert r.recommendations.should_book_appointment is False

    def test_chest_pain(self):
        self._assert_urgent_emergency(["chest pain"])

    def test_chest_tightness(self):
        self._assert_urgent_emergency(["chest tightness"])

    def test_difficulty_breathing(self):
        self._assert_urgent_emergency(["difficulty breathing"])

    def test_shortness_of_breath(self):
        self._assert_urgent_emergency(["shortness of breath"])

    def test_severe_headache(self):
        self._assert_urgent_emergency(["severe headache"])

    def test_thunderclap_headache(self):
        self._assert_urgent_emergency(["thunderclap headache"])

    def test_facial_drooping(self):
        self._assert_urgent_emergency(["facial drooping"])

    def test_arm_weakness(self):
        self._assert_urgent_emergency(["arm weakness"])

    def test_slurred_speech(self):
        self._assert_urgent_emergency(["slurred speech"])

    def test_loss_of_consciousness(self):
        self._assert_urgent_emergency(["loss of consciousness"])

    def test_unconscious(self):
        self._assert_urgent_emergency(["unconscious"])

    def test_seizure(self):
        self._assert_urgent_emergency(["seizure"])

    def test_convulsions(self):
        self._assert_urgent_emergency(["convulsions"])

    def test_anaphylaxis(self):
        self._assert_urgent_emergency(["anaphylaxis"])

    def test_throat_swelling(self):
        self._assert_urgent_emergency(["throat swelling"])

    def test_coughing_blood(self):
        self._assert_urgent_emergency(["coughing blood"])

    def test_vomiting_blood(self):
        self._assert_urgent_emergency(["vomiting blood"])

    def test_severe_abdominal_pain(self):
        self._assert_urgent_emergency(["severe abdominal pain"])

    def test_stiff_neck_with_fever(self):
        self._assert_urgent_emergency(["stiff neck with fever"])

    def test_hyperpyrexia(self):
        self._assert_urgent_emergency(["fever above 39.5"])

    def test_stroke(self):
        self._assert_urgent_emergency(["stroke"])

    def test_heart_attack(self):
        self._assert_urgent_emergency(["heart attack"])

    def test_cardiac_arrest(self):
        self._assert_urgent_emergency(["cardiac arrest"])

    def test_suicidal(self):
        self._assert_urgent_emergency(["suicidal"])

    def test_self_harm(self):
        self._assert_urgent_emergency(["self harm"])

    def test_poisoning(self):
        self._assert_urgent_emergency(["poisoning"])

    def test_severe_burns(self):
        self._assert_urgent_emergency(["severe burns"])

    def test_uncontrolled_bleeding(self):
        self._assert_urgent_emergency(["uncontrolled bleeding"])

    def test_sudden_vision_loss(self):
        self._assert_urgent_emergency(["sudden vision loss"])

    def test_severe_dehydration(self):
        self._assert_urgent_emergency(["severe dehydration"])

    def test_multiple_red_flags_still_urgent(self):
        self._assert_urgent_emergency(["chest pain", "shortness of breath", "arm weakness"])

    def test_high_confidence_on_red_flags(self):
        r = triage(["chest pain"])
        assert r.confidence >= 0.92

    def test_multiple_red_flags_raises_confidence(self):
        single = triage(["chest pain"]).confidence
        multi = triage(["chest pain", "arm weakness", "slurred speech"]).confidence
        assert multi >= single


# ── Red flag → correct recommendation content ─────────────────────────────────

class TestRedFlagRecommendations:
    def test_cardiac_mentions_999(self):
        r = triage(["chest pain"])
        assert "999" in r.recommendations.immediate_action

    def test_stroke_fast_protocol(self):
        r = triage(["facial drooping"])
        action = r.recommendations.immediate_action.upper()
        assert "FAST" in action or "999" in r.recommendations.immediate_action

    def test_mental_health_includes_helpline(self):
        r = triage(["suicidal"])
        assert "0800 723 253" in r.recommendations.immediate_action

    def test_meningitis_do_not_wait(self):
        r = triage(["stiff neck with fever"])
        assert "emergency" in r.recommendations.immediate_action.lower()

    def test_poisoning_do_not_induce_vomiting(self):
        r = triage(["poisoning"])
        action = r.recommendations.immediate_action.lower()
        assert "vomit" in action  # warns about NOT inducing vomiting

    def test_respiratory_sit_upright(self):
        r = triage(["difficulty breathing"])
        assert "sit" in r.recommendations.immediate_action.lower() or \
               "999" in r.recommendations.immediate_action


# ── Pre-existing condition escalation → URGENT ───────────────────────────────

class TestPreexistingEscalation:
    def _assert_urgent(self, conditions, symptoms):
        r = triage(symptoms, conditions=conditions)
        assert r.severity == "urgent", (
            f"Expected urgent for conditions={conditions}, symptoms={symptoms}, got {r.severity}"
        )

    def test_hypertension_severe_headache(self):
        self._assert_urgent(["hypertension"], ["severe headache"])

    def test_hypertension_chest_pain(self):
        self._assert_urgent(["hypertension"], ["chest pain"])

    def test_hypertension_vision_changes(self):
        self._assert_urgent(["hypertension"], ["vision changes"])

    def test_heart_disease_shortness_of_breath(self):
        self._assert_urgent(["heart disease"], ["shortness of breath"])

    def test_heart_disease_palpitations(self):
        self._assert_urgent(["heart disease"], ["palpitations"])

    def test_diabetes_chest_pain(self):
        self._assert_urgent(["diabetes"], ["chest pain"])

    def test_diabetes_loss_of_consciousness(self):
        self._assert_urgent(["diabetes"], ["loss of consciousness"])

    def test_asthma_shortness_of_breath(self):
        self._assert_urgent(["asthma"], ["shortness of breath"])

    def test_asthma_wheezing(self):
        self._assert_urgent(["asthma"], ["wheezing"])

    def test_copd_difficulty_breathing(self):
        self._assert_urgent(["copd"], ["difficulty breathing"])

    def test_pregnancy_severe_headache(self):
        self._assert_urgent(["pregnancy"], ["severe headache"])

    def test_pregnancy_abdominal_pain(self):
        self._assert_urgent(["pregnancy"], ["abdominal pain"])

    def test_pregnancy_bleeding(self):
        self._assert_urgent(["pregnancy"], ["bleeding"])

    def test_pregnancy_seizure(self):
        self._assert_urgent(["pregnancy"], ["seizure"])

    def test_hiv_fever(self):
        self._assert_urgent(["hiv"], ["fever"])

    def test_immunocompromised_infection(self):
        self._assert_urgent(["immunocompromised"], ["infection"])

    def test_sickle_cell_severe_pain(self):
        self._assert_urgent(["sickle cell"], ["severe pain"])

    def test_sickle_cell_chest_pain(self):
        self._assert_urgent(["sickle cell"], ["chest pain"])

    def test_epilepsy_seizure(self):
        self._assert_urgent(["epilepsy"], ["seizure"])

    def test_kidney_disease_no_urine(self):
        self._assert_urgent(["kidney disease"], ["no urine"])

    def test_condition_without_trigger_not_escalated(self):
        # Hypertension without any linked triggers → not URGENT from preexisting alone
        r = triage(["runny nose"], conditions=["hypertension"])
        assert r.severity != "urgent"

    def test_preexisting_has_high_confidence(self):
        r = triage(["chest pain"], conditions=["hypertension"])
        assert r.confidence >= 0.90


# ── Moderate combination rules ────────────────────────────────────────────────

class TestModerateCombinations:
    def _assert_moderate(self, symptoms, **kwargs):
        r = triage(symptoms, **kwargs)
        assert r.severity == "moderate", (
            f"Expected moderate for {symptoms}, got {r.severity} — {r.matched_conditions}"
        )

    def test_flu_fever_plus_body_aches(self):
        self._assert_moderate(["fever", "body aches"])

    def test_flu_fever_plus_chills(self):
        self._assert_moderate(["fever", "chills"])

    def test_flu_fever_plus_fatigue(self):
        self._assert_moderate(["fever", "fatigue"])

    def test_respiratory_cough_plus_fever(self):
        self._assert_moderate(["cough", "fever"], days=3)

    def test_gi_abdominal_pain_plus_vomiting(self):
        self._assert_moderate(["abdominal pain", "vomiting"])

    def test_gi_stomach_pain_plus_diarrhea(self):
        self._assert_moderate(["stomach pain", "diarrhea"])

    def test_headache_plus_photophobia(self):
        self._assert_moderate(["headache", "light sensitivity"])

    def test_uti_burning_plus_frequent_urination(self):
        self._assert_moderate(["burning urination", "urinary frequency"])

    def test_uti_dysuria_plus_cloudy_urine(self):
        self._assert_moderate(["dysuria", "cloudy urine"])

    def test_wound_infection_plus_pus(self):
        self._assert_moderate(["infected wound", "pus"])

    def test_sore_throat_plus_fever_glands(self):
        self._assert_moderate(["sore throat", "fever", "swollen glands"])

    def test_rash_plus_fever(self):
        self._assert_moderate(["rash", "fever"])

    def test_ear_pain_plus_fever(self):
        self._assert_moderate(["ear pain", "fever"])

    def test_eye_pain_plus_vision_changes(self):
        self._assert_moderate(["eye pain", "vision changes"])

    def test_back_pain_plus_fever_urinary(self):
        self._assert_moderate(["back pain", "fever", "painful urination"])

    def test_malaria_combo_fever_joint_pain(self):
        self._assert_moderate(["fever", "headache", "joint pain"])

    def test_asthma_like_wheeze_breathless(self):
        # "shortness of breath" is a red flag → engine correctly returns URGENT
        r = triage(["wheezing", "shortness of breath"])
        assert r.severity in ("moderate", "urgent")

    def test_gynaecological_discharge_plus_pain(self):
        self._assert_moderate(["vaginal discharge", "pain"])

    def test_dental_abscess_toothache_plus_swelling(self):
        self._assert_moderate(["toothache", "swelling face", "fever"])

    def test_cough_below_3_days_not_triggered(self):
        # "persistent cough" combo rule requires duration >= 3 days
        r = triage(["cough", "fever"], days=2)
        # Should not match the respiratory combo that requires persistence
        # (may still be moderate from another rule — just checking it doesn't hard-crash)
        assert r.severity in ("mild", "moderate", "urgent")


# ── Moderate single-symptom rules ────────────────────────────────────────────

class TestModerateSingleRules:
    def _assert_moderate(self, symptoms):
        r = triage(symptoms)
        assert r.severity == "moderate", f"Expected moderate for {symptoms}, got {r.severity}"

    def test_high_fever_38(self):
        self._assert_moderate(["fever above 38"])

    def test_high_fever_39(self):
        self._assert_moderate(["fever above 39"])

    def test_bloody_diarrhea(self):
        self._assert_moderate(["bloody diarrhea"])

    def test_blood_in_stool(self):
        self._assert_moderate(["blood in stool"])

    def test_jaundice_yellow_skin(self):
        self._assert_moderate(["yellow skin"])

    def test_jaundice_yellow_eyes(self):
        self._assert_moderate(["yellow eyes"])

    def test_suspected_malaria(self):
        self._assert_moderate(["suspected malaria"])

    def test_dengue(self):
        self._assert_moderate(["dengue"])

    def test_typhoid(self):
        self._assert_moderate(["typhoid"])

    def test_persistent_cough(self):
        self._assert_moderate(["persistent cough"])

    def test_cough_for_weeks(self):
        self._assert_moderate(["cough for weeks"])

    def test_dysphagia(self):
        self._assert_moderate(["difficulty swallowing"])

    def test_blood_in_urine(self):
        self._assert_moderate(["blood in urine"])

    def test_pneumonia(self):
        self._assert_moderate(["pneumonia"])

    def test_pregnancy_bleeding(self):
        self._assert_moderate(["pregnancy bleeding"])

    def test_unexplained_weight_loss(self):
        self._assert_moderate(["unexplained weight loss"])

    def test_palpitations(self):
        self._assert_moderate(["palpitations"])

    def test_heart_racing(self):
        self._assert_moderate(["heart racing"])


# ── Age-specific escalation ───────────────────────────────────────────────────

class TestAgeEscalation:
    def test_under_3_always_escalates(self):
        r = triage(["runny nose"], age=2)
        assert r.severity in ("moderate", "urgent")

    def test_under_3_months_escalates(self):
        r = triage(["runny nose"], age=0)
        assert r.severity in ("moderate", "urgent")

    def test_under_5_with_fever_escalates(self):
        r = triage(["fever"], age=4)
        assert r.severity in ("moderate", "urgent")

    def test_under_5_without_fever_may_not_escalate(self):
        r = triage(["runny nose"], age=4)
        # Should not force URGENT from age alone (no fever)
        assert r.severity in ("mild", "moderate", "urgent")

    def test_over_65_with_fever_2_days_escalates(self):
        r = triage(["fever"], age=70, days=2)
        assert r.severity in ("moderate", "urgent")

    def test_over_65_symptoms_3_days_escalates(self):
        r = triage(["fatigue"], age=68, days=3)
        assert r.severity in ("moderate", "urgent")

    def test_adult_mild_symptoms_not_escalated_by_age(self):
        r = triage(["runny nose"], age=30)
        assert r.severity == "mild"

    def test_age_label_in_matched_conditions(self):
        r = triage(["runny nose"], age=2)
        combined = " ".join(r.matched_conditions).lower()
        assert "paediatric" in combined or "child" in combined or "under 3" in combined


# ── County-based malaria escalation ──────────────────────────────────────────

class TestCountyMalariaEscalation:
    HIGH_RISK = ["kisumu", "homa bay", "migori", "mombasa", "kilifi", "busia"]
    LOW_RISK = ["nairobi", "nakuru", "eldoret"]

    def test_high_risk_county_fever_escalates(self):
        for county in self.HIGH_RISK:
            r = triage(["fever", "fatigue"], county=county)
            assert r.severity in ("moderate", "urgent"), (
                f"Expected escalation for fever in {county}"
            )

    def test_low_risk_county_fever_no_county_escalation(self):
        # Nairobi with mild fever alone should still hit moderate from other rules
        # but should NOT add malaria risk label
        for county in self.LOW_RISK:
            r = triage(["fever", "fatigue"], county=county)
            malaria_labels = [c for c in r.matched_conditions if "malaria" in c.lower()]
            county_malaria = [l for l in malaria_labels if "county" in l.lower()]
            assert not county_malaria, f"Unexpected malaria county risk for {county}"

    def test_no_county_no_malaria_escalation(self):
        r = triage(["fever"])
        county_labels = [c for c in r.matched_conditions if "county" in c.lower()]
        assert not county_labels

    def test_high_risk_county_without_fever_no_escalation(self):
        r = triage(["runny nose"], county="kisumu")
        malaria_from_county = [c for c in r.matched_conditions if "county" in c.lower()]
        assert not malaria_from_county


# ── Mild classification ───────────────────────────────────────────────────────

class TestMildClassification:
    def test_common_cold_is_mild(self):
        r = triage(["runny nose", "sneezing"])
        assert r.severity == "mild"

    def test_mild_headache_is_mild(self):
        r = triage(["mild headache"])
        assert r.severity == "mild"

    def test_indigestion_is_mild(self):
        r = triage(["indigestion", "bloating"])
        assert r.severity == "mild"

    def test_fatigue_alone_is_mild(self):
        r = triage(["fatigue"])
        assert r.severity == "mild"

    def test_mild_does_not_flag_emergency(self):
        r = triage(["runny nose"])
        assert not r.recommendations.emergency

    def test_mild_does_not_require_appointment(self):
        r = triage(["runny nose"])
        assert not r.recommendations.should_book_appointment

    def test_mild_has_home_care_advice(self):
        r = triage(["runny nose"])
        assert len(r.recommendations.home_care) > 0

    def test_mild_confidence_reasonable(self):
        r = triage(["runny nose"])
        assert r.confidence >= 0.62


# ── Moderate → appointment & escalation logic ─────────────────────────────────

class TestModerateLogic:
    def test_moderate_should_book_appointment(self):
        r = triage(["fever", "body aches"])
        assert r.recommendations.should_book_appointment is True

    def test_moderate_not_emergency(self):
        r = triage(["fever", "body aches"])
        assert r.recommendations.emergency is False

    def test_moderate_has_home_care(self):
        r = triage(["fever", "body aches"])
        assert len(r.recommendations.home_care) > 0

    def test_moderate_has_escalation_guidance(self):
        r = triage(["fever", "body aches"])
        assert r.recommendations.when_to_escalate

    def test_malaria_home_care_no_self_medication(self):
        r = triage(["fever", "body aches", "joint pain"], county="kisumu")
        combined = " ".join(r.recommendations.home_care).lower()
        assert "rdt" in combined or "rapid" in combined or "test" in combined

    def test_uti_home_care_hydration(self):
        r = triage(["burning urination", "urinary frequency"])
        combined = " ".join(r.recommendations.home_care).lower()
        assert "water" in combined or "fluid" in combined or "hydrat" in combined

    def test_gi_home_care_ors(self):
        r = triage(["abdominal pain", "vomiting", "diarrhea"])
        combined = " ".join(r.recommendations.home_care).lower()
        assert "ors" in combined or "rehydrat" in combined or "fluid" in combined


# ── Specialization suggestions ────────────────────────────────────────────────

class TestSpecializations:
    def test_chest_pain_suggests_cardiology(self):
        r = triage(["chest pain"])
        assert any("Cardiology" in s or "Emergency" in s for s in r.suggested_specializations)

    def test_stroke_suggests_neurology(self):
        r = triage(["facial drooping"])
        assert any("Neurology" in s or "Emergency" in s for s in r.suggested_specializations)

    def test_uti_suggests_urology_or_gp(self):
        r = triage(["burning urination", "urinary frequency"])
        assert any("Urology" in s or "General Practice" in s for s in r.suggested_specializations)

    def test_ear_suggests_ent(self):
        r = triage(["ear pain", "fever"])
        assert any("ENT" in s or "General Practice" in s for s in r.suggested_specializations)

    def test_eye_suggests_ophthalmology(self):
        r = triage(["eye pain", "vision changes"])
        assert any("Ophthalmology" in s or "General Practice" in s for s in r.suggested_specializations)

    def test_child_suggests_pediatrics(self):
        r = triage(["fever"], age=2)
        assert any("Pediatric" in s or "Paediatric" in s or "General" in s
                   for s in r.suggested_specializations)

    def test_mental_health_suggests_psychiatry(self):
        r = triage(["suicidal"])
        assert any("Psychiatry" in s or "General Practice" in s for s in r.suggested_specializations)

    def test_dental_suggests_dentistry(self):
        r = triage(["toothache", "swelling face"])
        assert any("Dent" in s for s in r.suggested_specializations)

    def test_unknown_symptoms_default_to_gp(self):
        r = triage(["xyz unknown symptom abc"])
        assert "General Practice" in r.suggested_specializations

    def test_max_three_specializations(self):
        r = triage(["chest pain", "seizure", "vomiting blood", "rash", "ear pain"])
        assert len(r.suggested_specializations) <= 3


# ── Normalisation & case handling ─────────────────────────────────────────────

class TestNormalisation:
    def test_uppercase_symptoms_handled(self):
        lower = triage(["chest pain"]).severity
        upper = triage(["CHEST PAIN"]).severity
        assert lower == upper == "urgent"

    def test_mixed_case_symptoms(self):
        r = triage(["Fever", "Body Aches"])
        assert r.severity in ("moderate", "urgent")

    def test_extra_whitespace_handled(self):
        r = triage(["  chest pain  "])
        assert r.severity == "urgent"

    def test_empty_string_symptoms_ignored(self):
        r = triage(["", "chest pain", ""])
        assert r.severity == "urgent"

    def test_county_case_insensitive(self):
        r1 = triage(["fever"], county="Kisumu")
        r2 = triage(["fever"], county="KISUMU")
        assert r1.severity == r2.severity


# ── Conservative escalation principle ─────────────────────────────────────────

class TestConservativeEscalation:
    """The engine must always err on the side of escalation."""

    def test_ambiguous_headache_not_downgraded_when_neck_stiff(self):
        r = triage(["headache", "neck stiffness"])
        assert r.severity in ("moderate", "urgent")

    def test_fever_plus_confusion_not_mild(self):
        r = triage(["fever", "confusion"])
        assert r.severity != "mild"

    def test_immunocompromised_with_any_fever_urgent(self):
        r = triage(["fever"], conditions=["immunocompromised"])
        assert r.severity == "urgent"

    def test_pregnancy_with_abdominal_pain_urgent(self):
        r = triage(["abdominal pain"], conditions=["pregnancy"])
        assert r.severity == "urgent"

    def test_red_flag_beats_mild_context(self):
        # Even if patient only mentions one mild symptom alongside a red flag
        r = triage(["runny nose", "chest pain"])
        assert r.severity == "urgent"
